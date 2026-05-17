import { fetchRemoteResourceInventory, type ResourceUnitRow } from '../../apis/resourceInventoryClient';
import {
  legacyActionPlanToMobile,
  normalizeAnalysisForMobile,
  ruleBasedContextualPlan,
} from '../normalizeMobileAgentOutputs';
import { runActionPlanAgent } from './actionPlanAgent';
import { runAlertQueueAnalysisAgent } from './alertQueueAnalysisAgent';
import { runAlertTriageAgent } from './alertTriageAgent';
import { runContextualResourcePlanAgent } from './contextualResourcePlanAgent';
import { runCrisisAnalysisAgent } from './crisisAnalysisAgent';
import type { FlatSignalInput } from './types';
import type { ContextualAlertPlanResult } from './contextualTypes';

const now = () => new Date().toISOString();

export async function runContextualAlertOrchestrator(
  focusSignal: FlatSignalInput,
  allSignals: FlatSignalInput[],
): Promise<ContextualAlertPlanResult> {
  const crisisId = focusSignal.id.startsWith('pk-') ? focusSignal.id : `pk-${focusSignal.id}`;
  const queue = allSignals.length > 0 ? allSignals : [focusSignal];
  const degraded: string[] = [];

  let inventoryUnits: ResourceUnitRow[] = [];
  try {
    const inv = await fetchRemoteResourceInventory(false);
    inventoryUnits = inv.units ?? [];
  } catch (e) {
    console.warn('[ContextualAlertOrchestrator] inventory fetch failed:', (e as Error).message);
  }

  try {
    const globalPrioritization = await runAlertQueueAnalysisAgent(queue, degraded);
    const focusRow =
      globalPrioritization.find((r) => r.signalId === focusSignal.id) ?? globalPrioritization[0];

    const [triage, analysisRaw] = await Promise.all([
      runAlertTriageAgent(focusSignal, degraded),
      runCrisisAnalysisAgent(focusSignal, crisisId, degraded),
    ]);

    const focusPriority = triage.priority;
    const analysis = normalizeAnalysisForMobile(
      analysisRaw as unknown as Record<string, unknown>,
      crisisId,
      focusSignal.id,
      analysisRaw.agentName ?? 'CrisisAnalysisAgent',
      analysisRaw.degradedMode,
    );

    const actionPlanRaw = await runActionPlanAgent(focusSignal, crisisId, degraded, {
      triage: {
        priority: triage.priority,
        disposition: triage.disposition,
        headline: triage.headline,
        recommendedNextSteps: triage.recommendedNextSteps,
      },
      analysisSummary: analysis.executiveSummary,
      globalPrioritization: globalPrioritization.slice(0, 12),
      resourceCount: inventoryUnits.length,
    });

    const actionPlan = legacyActionPlanToMobile(actionPlanRaw, focusPriority);

    const resourcePlan = await runContextualResourcePlanAgent(
      focusSignal,
      crisisId,
      triage,
      analysis,
      globalPrioritization,
      inventoryUnits,
      degraded,
    );

    return {
      focusSignalId: focusSignal.id,
      crisisId,
      focusPriority,
      focusRank: focusRow?.rank ?? 1,
      globalPrioritization,
      triage,
      analysis,
      actionPlan,
      recommendations: resourcePlan.recommendations,
      resourceAssignments: resourcePlan.resourceAssignments,
      competingAlertsNote: resourcePlan.competingAlertsNote,
      degradedMode: degraded.length > 0,
      degradedAgents: [...new Set(degraded)],
      generatedAt: now(),
      agentName: 'ContextualAlertOrchestrator',
    };
  } catch (e) {
    console.warn('[ContextualAlertOrchestrator] pipeline failed:', (e as Error).message);
    const fallback = ruleBasedContextualPlan(focusSignal, queue, crisisId);
    return { ...fallback, degradedAgents: ['ContextualAlertOrchestrator'] };
  }
}

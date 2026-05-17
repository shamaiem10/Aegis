import { fetchRemoteResourceInventory, type ResourceUnitRow } from '../../apis/resourceInventoryClient';
import { runCrisisSimulationAnalysisAgent } from './crisisSimulationAnalysisAgent';
import { runResourceScenarioPlanningAgent } from './resourceScenarioPlanningAgent';
import type { FlatSignalInput } from './types';

export type ResourceScenarioAdjustment = {
  resourceId: string;
  name: string;
  quantityDelta: number;
  newQuantityAvailable?: number;
};

export type HighPriorityImpact = {
  signalId: string;
  headline: string;
  priorityBefore: string;
  priorityAfter: string;
  impact: string;
};

export type CrisisSimulationResult = {
  focusSignalId: string;
  focusHeadline: string;
  focusAlertBefore: string;
  focusAlertAfter: string;
  focusPriorityBefore: string;
  focusPriorityAfter: string;
  focusResponseBefore: string;
  focusResponseAfter: string;
  crisisImpactSummary: string;
  overallRiskBefore: number;
  overallRiskAfter: number;
  highPriorityImpacts: HighPriorityImpact[];
  resourceNotes: { resourceId: string; name: string; note: string }[];
  recommendedActions: string[];
  degradedMode: boolean;
  degradedAgents: string[];
  generatedAt: string;
  agentName: string;
};

function applyAdjustments(
  units: ResourceUnitRow[],
  adjustments: ResourceScenarioAdjustment[],
): ResourceUnitRow[] {
  const byId = new Map(units.map((u) => [u.resource_id, { ...u }]));
  for (const adj of adjustments) {
    const u = byId.get(adj.resourceId);
    if (!u) continue;
    const next =
      adj.newQuantityAvailable != null
        ? adj.newQuantityAvailable
        : Math.max(0, u.quantity_available + adj.quantityDelta);
    byId.set(adj.resourceId, { ...u, quantity_available: next });
  }
  return [...byId.values()];
}

function sevToPriority(sev: number): string {
  if (sev >= 8.5) return 'CRITICAL';
  if (sev >= 7) return 'HIGH';
  if (sev >= 4.5) return 'MEDIUM';
  return 'LOW';
}

function ruleBased(
  focus: FlatSignalInput,
  allSignals: FlatSignalInput[],
  adjustments: ResourceScenarioAdjustment[],
): CrisisSimulationResult {
  const sev = Number(focus.severity_hint) || 5;
  const priBefore = sevToPriority(sev);
  const delta = adjustments.reduce((s, a) => s + a.quantityDelta, 0);
  const priAfter = delta > 2 ? priBefore : delta < -2 && priBefore === 'HIGH' ? 'MEDIUM' : priBefore;
  const headline = String(focus.text ?? focus.kind ?? 'Alert').slice(0, 80);

  const highOthers = allSignals
    .filter((s) => s.id !== focus.id && (Number(s.severity_hint) || 0) >= 7)
    .slice(0, 5)
    .map((s) => ({
      signalId: s.id,
      headline: String(s.text ?? s.kind).slice(0, 70),
      priorityBefore: sevToPriority(Number(s.severity_hint) || 5),
      priorityAfter:
        delta > 0 && s.id !== focus.id
          ? (Number(s.severity_hint) || 0) >= 8
            ? 'HIGH'
            : 'MEDIUM'
          : sevToPriority(Number(s.severity_hint) || 5),
      impact:
        delta > 0
          ? 'Competes for same pools — may see slower staging.'
          : 'Neutral in rule-based fallback.',
    }));

  return {
    focusSignalId: focus.id,
    focusHeadline: headline,
    focusAlertBefore: `Baseline response for severity ${sev}/10. Resources not yet reallocated.`,
    focusAlertAfter:
      delta > 0
        ? `Added capacity improves staging and field verification for this incident.`
        : `Reduced capacity may delay dispatch and on-scene command.`,
    focusPriorityBefore: priBefore,
    focusPriorityAfter: priAfter,
    focusResponseBefore: 'Standard queue position',
    focusResponseAfter: delta > 0 ? 'Faster ETA expected' : 'ETA may slip 10–20 min',
    crisisImpactSummary: `Resource Δ ${delta} units across ${adjustments.length} pool(s).`,
    overallRiskBefore: Math.min(100, sev * 10),
    overallRiskAfter: Math.max(0, Math.min(100, sev * 10 - Math.round(delta / 2))),
    highPriorityImpacts: highOthers,
    resourceNotes: adjustments.map((a) => ({
      resourceId: a.resourceId,
      name: a.name,
      note: `Δ ${a.quantityDelta}`,
    })),
    recommendedActions: ['Connect Groq for full alert-specific simulation.'],
    degradedMode: true,
    degradedAgents: ['ResourceScenarioPlanningAgent', 'CrisisSimulationAnalysisAgent'],
    generatedAt: new Date().toISOString(),
    agentName: 'CrisisSimulationAgent',
  };
}

export async function runCrisisSimulationAgent(input: {
  focusSignal: FlatSignalInput;
  adjustments: ResourceScenarioAdjustment[];
  signals: FlatSignalInput[];
  crises: Record<string, unknown>[];
}): Promise<CrisisSimulationResult> {
  const focus = input.focusSignal;
  const degraded: string[] = [];

  let units: ResourceUnitRow[] = [];
  try {
    const inv = await fetchRemoteResourceInventory(false);
    units = inv.units ?? [];
  } catch {
    units = [];
  }

  const beforeUnits = units;
  const afterUnits = applyAdjustments(units, input.adjustments);

  const otherHigh = input.signals
    .filter((s) => s.id !== focus.id && (Number(s.severity_hint) || 0) >= 7)
    .slice(0, 8)
    .map((s) => ({
      id: s.id,
      text: String(s.text ?? '').slice(0, 90),
      severity_hint: s.severity_hint,
      priority: sevToPriority(Number(s.severity_hint) || 5),
    }));

  try {
    const scenarioPlan = await runResourceScenarioPlanningAgent(
      focus,
      input.adjustments,
      beforeUnits,
      afterUnits,
      otherHigh,
      degraded,
    );

    const result = await runCrisisSimulationAnalysisAgent(
      focus,
      scenarioPlan,
      otherHigh,
      input.adjustments,
      degraded,
    );

    return {
      ...result,
      degradedMode: degraded.length > 0 || result.degradedMode,
      degradedAgents: [...new Set(degraded)],
      agentName: 'CrisisSimulationAgent',
    };
  } catch (e) {
    console.warn('[CrisisSimulationAgent] pipeline fallback:', (e as Error).message);
    return ruleBased(focus, input.signals, input.adjustments);
  }
}

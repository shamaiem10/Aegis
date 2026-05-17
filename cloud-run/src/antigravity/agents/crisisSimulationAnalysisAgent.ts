import { callAntigravityAgent } from '../agentClient';
import type { FlatSignalInput } from './types';
import type {
  CrisisSimulationResult,
  HighPriorityImpact,
  ResourceScenarioAdjustment,
} from './crisisSimulationAgent';
import type { ResourceScenarioPlan } from './resourceScenarioPlanningAgent';

const INSTRUCTION = `Role: Analyze impact of a resource scenario on the FOCUS alert and OTHER HIGH alerts.
Input: { focusSignal, scenarioPlan, otherHighPriorityAlerts }
Output: {
  "focusSignalId": "",
  "focusHeadline": "",
  "focusAlertBefore": "2-3 sentences",
  "focusAlertAfter": "2-3 sentences",
  "focusPriorityBefore": "CRITICAL|HIGH|MEDIUM|LOW",
  "focusPriorityAfter": "CRITICAL|HIGH|MEDIUM|LOW",
  "focusResponseBefore": "one line",
  "focusResponseAfter": "one line",
  "crisisImpactSummary": "1-2 sentences",
  "overallRiskBefore": 0-100,
  "overallRiskAfter": 0-100,
  "highPriorityImpacts": [{ "signalId", "headline", "priorityBefore", "priorityAfter", "impact" }],
  "resourceNotes": [{ "resourceId", "name", "note" }],
  "recommendedActions": ["3-4 bullets"]
}
Rules: focus alert is main story; max 5 other HIGH/CRITICAL impacts.`;

function sevToPriority(sev: number): string {
  if (sev >= 8.5) return 'CRITICAL';
  if (sev >= 7) return 'HIGH';
  if (sev >= 4.5) return 'MEDIUM';
  return 'LOW';
}

export async function runCrisisSimulationAnalysisAgent(
  focus: FlatSignalInput,
  scenarioPlan: ResourceScenarioPlan,
  otherHigh: { id: string; text: string; severity_hint?: number; priority: string }[],
  adjustments: ResourceScenarioAdjustment[],
  degraded: string[],
): Promise<CrisisSimulationResult> {
  const sev = Number(focus.severity_hint) || 5;
  const priBefore = sevToPriority(sev);

  try {
    const parsed = await callAntigravityAgent(
      'CrisisSimulationAnalysisAgent',
      INSTRUCTION,
      {
        focusSignal: {
          id: focus.id,
          text: focus.text,
          severity_hint: focus.severity_hint,
          region: focus.region,
        },
        scenarioPlan,
        otherHighPriorityAlerts: otherHigh,
      },
      degraded,
    );

    const clamp = (n: unknown, d: number) => {
      const v = Number(n);
      return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : d;
    };

    return {
      focusSignalId: String(parsed.focusSignalId ?? focus.id),
      focusHeadline: String(parsed.focusHeadline ?? focus.text?.slice(0, 80) ?? 'Alert'),
      focusAlertBefore: String(parsed.focusAlertBefore ?? ''),
      focusAlertAfter: String(parsed.focusAlertAfter ?? ''),
      focusPriorityBefore: String(parsed.focusPriorityBefore ?? priBefore),
      focusPriorityAfter: String(parsed.focusPriorityAfter ?? priBefore),
      focusResponseBefore: String(parsed.focusResponseBefore ?? scenarioPlan.focusResponsePlan),
      focusResponseAfter: String(parsed.focusResponseAfter ?? scenarioPlan.focusResponsePlan),
      crisisImpactSummary: String(parsed.crisisImpactSummary ?? scenarioPlan.scenarioSummary),
      overallRiskBefore: clamp(parsed.overallRiskBefore, Math.min(100, sev * 10)),
      overallRiskAfter: clamp(parsed.overallRiskAfter, Math.min(100, sev * 10)),
      highPriorityImpacts: Array.isArray(parsed.highPriorityImpacts)
        ? (parsed.highPriorityImpacts as HighPriorityImpact[]).slice(0, 6)
        : [],
      resourceNotes: Array.isArray(parsed.resourceNotes)
        ? (parsed.resourceNotes as { resourceId?: string; resource_id?: string; name?: string; note?: string }[]).map(
            (r) => ({
              resourceId: String(r.resourceId ?? r.resource_id ?? ''),
              name: String(r.name ?? ''),
              note: String(r.note ?? ''),
            }),
          )
        : scenarioPlan.plannedMoves.map((m) => ({
            resourceId: m.resourceId,
            name: m.name,
            note: m.deltaNote,
          })),
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.map(String).slice(0, 6)
        : [],
      degradedMode: degraded.length > 0,
      degradedAgents: [...new Set(degraded)],
      generatedAt: new Date().toISOString(),
      agentName: 'CrisisSimulationAnalysisAgent',
    };
  } catch {
    throw new Error('CrisisSimulationAnalysisAgent failed');
  }
}

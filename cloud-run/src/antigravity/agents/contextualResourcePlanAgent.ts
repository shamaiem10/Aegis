import { callAntigravityAgent } from '../agentClient';
import type { ResourceUnitRow } from '../../apis/resourceInventoryClient';
import type {
  AlertPriorityRank,
  MobileCrisisAnalysisResult,
  ResourceAssignment,
} from './contextualTypes';
import type { AlertTriageResult, FlatSignalInput } from './types';

const INSTRUCTION = `Role: Assign emergency resources and operator recommendations for Pakistan EOC.
Input: { focusSignal, crisisId, triage, analysisSummary, globalPrioritization, resources }
Output: {
  "resourceAssignments": [{ "resourceId", "resourceName", "quantity", "assignedToSignalId", "rationale" }],
  "recommendations": ["3-5 bullets"],
  "competingAlertsNote": "one sentence on queue contention"
}
Rules: use real resource_id from inventory; do not double-book units unless quantity allows.`;

function compactResources(units: ResourceUnitRow[]) {
  return units.slice(0, 50).map((u) => ({
    resource_id: u.resource_id,
    name: u.name,
    kind: u.kind,
    agency: u.agency,
    quantity_available: u.quantity_available,
  }));
}

export type ContextualResourcePlan = {
  resourceAssignments: ResourceAssignment[];
  recommendations: string[];
  competingAlertsNote: string;
};

export async function runContextualResourcePlanAgent(
  focusSignal: FlatSignalInput,
  crisisId: string,
  triage: AlertTriageResult,
  analysis: MobileCrisisAnalysisResult,
  globalPrioritization: AlertPriorityRank[],
  resources: ResourceUnitRow[],
  degraded: string[],
): Promise<ContextualResourcePlan> {
  try {
    const parsed = await callAntigravityAgent(
      'ContextualResourcePlanAgent',
      INSTRUCTION,
      {
        focusSignal: { id: focusSignal.id, text: focusSignal.text?.slice(0, 140), severity_hint: focusSignal.severity_hint },
        crisisId,
        triage: {
          priority: triage.priority,
          disposition: triage.disposition,
          headline: triage.headline,
        },
        analysisSummary: analysis.executiveSummary,
        globalPrioritization: globalPrioritization.slice(0, 12),
        resources: compactResources(resources),
      },
      degraded,
    );

    const resourceAssignments: ResourceAssignment[] = Array.isArray(parsed.resourceAssignments)
      ? (parsed.resourceAssignments as Record<string, unknown>[]).map((a) => ({
          resourceId: String(a.resourceId ?? a.resource_id ?? ''),
          resourceName: String(a.resourceName ?? a.name ?? ''),
          quantity: Number(a.quantity ?? 1),
          assignedToSignalId: String(a.assignedToSignalId ?? focusSignal.id),
          rationale: String(a.rationale ?? ''),
        }))
      : [];

    return {
      resourceAssignments: resourceAssignments.filter((a) => a.resourceId),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String).slice(0, 8)
        : [],
      competingAlertsNote: String(
        parsed.competingAlertsNote ??
          `${Math.max(0, globalPrioritization.length - 1)} other alert(s) in queue.`,
      ),
    };
  } catch {
    return {
      resourceAssignments: [],
      recommendations: [
        'Confirm field verification before dispatch.',
        `Focus alert priority: ${triage.priority}.`,
      ],
      competingAlertsNote: `${Math.max(0, globalPrioritization.length - 1)} other alert(s) compete for shared pools.`,
    };
  }
}

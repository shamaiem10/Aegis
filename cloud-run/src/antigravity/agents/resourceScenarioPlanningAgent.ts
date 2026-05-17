import { callAntigravityAgent } from '../agentClient';
import type { ResourceUnitRow } from '../../apis/resourceInventoryClient';
import type { FlatSignalInput } from './types';
import type { ResourceScenarioAdjustment } from './crisisSimulationAgent';

const INSTRUCTION = `Role: Plan resource reallocation scenario for one focus alert (Pakistan EOC).
Input: { focusSignal, adjustments, resourcesBefore, resourcesAfter, otherHighPriorityAlerts }
Output: {
  "scenarioSummary": "2-3 sentences on planned moves",
  "plannedMoves": [{ "resourceId", "name", "deltaNote" }],
  "focusResponsePlan": "one line ETA/coverage intent after changes"
}`;

export type ResourceScenarioPlan = {
  scenarioSummary: string;
  plannedMoves: { resourceId: string; name: string; deltaNote: string }[];
  focusResponsePlan: string;
};

export async function runResourceScenarioPlanningAgent(
  focus: FlatSignalInput,
  adjustments: ResourceScenarioAdjustment[],
  beforeUnits: ResourceUnitRow[],
  afterUnits: ResourceUnitRow[],
  otherHigh: { id: string; text: string; priority: string }[],
  degraded: string[],
): Promise<ResourceScenarioPlan> {
  const compact = (units: ResourceUnitRow[]) =>
    units.slice(0, 25).map((u) => ({
      resource_id: u.resource_id,
      name: u.name,
      quantity_available: u.quantity_available,
    }));

  try {
    const parsed = await callAntigravityAgent(
      'ResourceScenarioPlanningAgent',
      INSTRUCTION,
      {
        focusSignal: {
          id: focus.id,
          text: String(focus.text ?? '').slice(0, 120),
          severity_hint: focus.severity_hint,
        },
        adjustments,
        resourcesBefore: compact(beforeUnits),
        resourcesAfter: compact(afterUnits),
        otherHighPriorityAlerts: otherHigh,
      },
      degraded,
    );

    const plannedMoves = Array.isArray(parsed.plannedMoves)
      ? (parsed.plannedMoves as Record<string, unknown>[]).map((m) => ({
          resourceId: String(m.resourceId ?? m.resource_id ?? ''),
          name: String(m.name ?? ''),
          deltaNote: String(m.deltaNote ?? m.note ?? ''),
        }))
      : adjustments.map((a) => ({
          resourceId: a.resourceId,
          name: a.name,
          deltaNote: `Δ ${a.quantityDelta}`,
        }));

    return {
      scenarioSummary: String(parsed.scenarioSummary ?? 'Resource scenario planned.'),
      plannedMoves,
      focusResponsePlan: String(parsed.focusResponsePlan ?? 'Revised staging per pool changes.'),
    };
  } catch {
    const delta = adjustments.reduce((s, a) => s + a.quantityDelta, 0);
    return {
      scenarioSummary: `Adjust ${adjustments.length} pool(s) with net Δ ${delta} units for focus alert.`,
      plannedMoves: adjustments.map((a) => ({
        resourceId: a.resourceId,
        name: a.name,
        deltaNote: `Δ ${a.quantityDelta}`,
      })),
      focusResponsePlan: delta > 0 ? 'Faster staging expected' : 'ETA may slip',
    };
  }
}

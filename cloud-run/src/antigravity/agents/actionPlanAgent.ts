import { callAntigravityAgent } from '../agentClient';
import type { ActionPlanResult, FlatSignalInput } from './types';

const INSTRUCTION = `Role: Operational action plan for one crisis.
Input: { signal, crisisId }
Output: { "actionPlan": { "crisisId", "phases": [{ "name", "actions", "owner", "etaMin" }], "resourceNeeds", "risks" } }`;

export async function runActionPlanAgent(
  signal: FlatSignalInput,
  crisisId: string,
  degraded: string[],
): Promise<ActionPlanResult> {
  const parsed = await callAntigravityAgent(
    'ActionPlanAgent',
    INSTRUCTION,
    { signal, crisisId },
    degraded,
  );
  const actionPlan = parsed.actionPlan as ActionPlanResult | undefined;
  if (actionPlan?.crisisId && Array.isArray(actionPlan.phases)) {
    return {
      ...actionPlan,
      signalId: actionPlan.signalId ?? signal.id,
      degradedMode: false,
      generatedAt: new Date().toISOString(),
      agentName: 'ActionPlanAgent',
    };
  }
  throw new Error('ActionPlanAgent returned invalid JSON (missing actionPlan.phases)');
}

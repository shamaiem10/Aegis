import { callAntigravityAgent } from '../agentClient';
import type { AlertTriageResult, FlatSignalInput } from './types';

const INSTRUCTION = `Role: Triage ONE signal for the response desk.
Input: { signal: FlatSignalInput }
Output: { "triage": { "signalId", "disposition", "priority", "confidencePct", "headline", "rationale", "recommendedNextSteps", "assignTo" } }
severity_hint >= 8 → usually escalate CRITICAL.`;

export async function runAlertTriageAgent(
  signal: FlatSignalInput,
  degraded: string[],
): Promise<AlertTriageResult> {
  const parsed = await callAntigravityAgent(
    'AlertTriageAgent',
    INSTRUCTION,
    { signal },
    degraded,
  );
  const triage = parsed.triage as AlertTriageResult | undefined;
  if (triage?.signalId) {
    return {
      ...triage,
      degradedMode: false,
      generatedAt: new Date().toISOString(),
      agentName: 'AlertTriageAgent',
    };
  }
  throw new Error('AlertTriageAgent returned invalid JSON (missing triage.signalId)');
}

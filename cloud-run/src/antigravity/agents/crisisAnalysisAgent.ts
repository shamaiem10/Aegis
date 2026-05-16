import { callAntigravityAgent } from '../agentClient';
import type { CrisisAnalysisResult, FlatSignalInput } from './types';

const INSTRUCTION = `Role: Deep analysis for one signal tied to crisisId.
Input: { signal, crisisId }
Output: { "analysis": { "crisisId", "hypothesis", "evidence", "gaps", "recommendedActions", "stakeholderAlerts" } }`;

export async function runCrisisAnalysisAgent(
  signal: FlatSignalInput,
  crisisId: string,
  degraded: string[],
): Promise<CrisisAnalysisResult> {
  const parsed = await callAntigravityAgent(
    'CrisisAnalysisAgent',
    INSTRUCTION,
    { signal, crisisId },
    degraded,
  );
  const analysis = parsed.analysis as CrisisAnalysisResult | undefined;
  if (analysis?.crisisId) {
    return {
      ...analysis,
      signalId: analysis.signalId ?? signal.id,
      degradedMode: false,
      generatedAt: new Date().toISOString(),
      agentName: 'CrisisAnalysisAgent',
    };
  }
  throw new Error('CrisisAnalysisAgent returned invalid JSON (missing analysis.crisisId)');
}

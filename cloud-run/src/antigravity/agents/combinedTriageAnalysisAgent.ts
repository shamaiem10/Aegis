import { generateGeminiJson } from '../geminiGenerate';
import type { AlertTriageResult, CrisisAnalysisResult, FlatSignalInput } from './types';

const INSTRUCTION = `AEGIS Pakistan — return compact JSON only:
{"triage":{"signalId":"","disposition":"escalate|monitor|dismiss_candidate","priority":"CRITICAL|HIGH|MEDIUM|LOW","confidencePct":0,"headline":"","rationale":"","recommendedNextSteps":[],"assignTo":[]},"analysis":{"crisisId":"","executiveSummary":"","keyRisks":[],"affectedDomains":[],"coordinationNotes":[],"stakeholderAlerts":[{"audience":"","message":"","urgency":"HIGH"}]}}
Max 2 sentences per text field. 3 risks, 3 steps, 2 stakeholder alerts.`;

const now = () => new Date().toISOString();

/** Alert screen only — no action plan (faster). */
export async function runCombinedTriageAnalysisAgent(
  signal: FlatSignalInput,
  crisisId: string,
): Promise<{ triage: AlertTriageResult; analysis: CrisisAnalysisResult }> {
  const parsed = await generateGeminiJson({
    instruction: INSTRUCTION,
    input: { signal, crisisId },
  });

  const triage = parsed.triage as AlertTriageResult | undefined;
  const analysis = parsed.analysis as CrisisAnalysisResult | undefined;
  if (!triage?.signalId || !analysis?.crisisId) {
    throw new Error('CombinedTriageAnalysisAgent incomplete JSON');
  }

  return {
    triage: {
      ...triage,
      signalId: signal.id,
      degradedMode: false,
      generatedAt: now(),
      agentName: 'CombinedTriageAnalysisAgent',
    },
    analysis: {
      ...analysis,
      crisisId,
      signalId: signal.id,
      degradedMode: false,
      generatedAt: now(),
      agentName: 'CombinedTriageAnalysisAgent',
    },
  };
}

import { callAntigravityAgent } from '../agentClient';
import type { AlertPriorityRank } from './contextualTypes';
import type { AgentPriority, FlatSignalInput } from './types';
import { priorityFromSeverity } from '../normalizeMobileAgentOutputs';

const INSTRUCTION = `Role: Rank ALL active alerts for Pakistan EOC queue.
Input: { alerts: [{ id, kind, text, region, severity_hint, source }] }
Output: { "globalPrioritization": [{ "signalId", "headline", "priority": "CRITICAL|HIGH|MEDIUM|LOW", "rank", "score": 0-100, "rationale" }] }
Rules: life-safety and official feeds outrank routine traffic; one entry per alert id.`;

function compactAlerts(signals: FlatSignalInput[]) {
  return signals.slice(0, 30).map((s) => ({
    id: s.id,
    kind: s.kind,
    text: String(s.text ?? '').slice(0, 120),
    region: s.region,
    severity_hint: s.severity_hint,
    source: s.source,
  }));
}

function parseQueue(raw: unknown, signals: FlatSignalInput[]): AlertPriorityRank[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(signals.map((s) => [s.id, s]));
  return raw
    .map((row, i) => {
      const r = row as Record<string, unknown>;
      const signalId = String(r.signalId ?? r.id ?? '');
      const sig = byId.get(signalId);
      return {
        signalId,
        headline: String(r.headline ?? sig?.text?.slice(0, 80) ?? signalId),
        priority: (r.priority as AgentPriority) ?? priorityFromSeverity(Number(sig?.severity_hint) || 5),
        rank: Number(r.rank ?? i + 1),
        score: Number(r.score ?? 50),
        rationale: String(r.rationale ?? ''),
      };
    })
    .filter((r) => r.signalId)
    .sort((a, b) => a.rank - b.rank);
}

export function defaultQueueRanking(signals: FlatSignalInput[]): AlertPriorityRank[] {
  return [...signals]
    .map((s) => ({
      signalId: s.id,
      headline: (s.text || s.kind || 'Alert').slice(0, 80),
      sev: Number(s.severity_hint) || 5,
    }))
    .sort((a, b) => b.sev - a.sev)
    .map((r, i) => ({
      signalId: r.signalId,
      headline: r.headline,
      priority: priorityFromSeverity(r.sev),
      rank: i + 1,
      score: Math.round(r.sev * 10),
      rationale: `Severity ${r.sev}/10`,
    }));
}

export async function runAlertQueueAnalysisAgent(
  signals: FlatSignalInput[],
  degraded: string[],
): Promise<AlertPriorityRank[]> {
  if (signals.length === 0) return [];
  try {
    const parsed = await callAntigravityAgent(
      'AlertQueueAnalysisAgent',
      INSTRUCTION,
      { alerts: compactAlerts(signals) },
      degraded,
    );
    const ranked = parseQueue(parsed.globalPrioritization, signals);
    if (ranked.length > 0) return ranked;
    throw new Error('AlertQueueAnalysisAgent: empty prioritization');
  } catch {
    return defaultQueueRanking(signals);
  }
}

import { db } from '../firebase-admin';

import { generateAgentJson, hasOpenRouterCredentials } from './llmGenerate';
import { runRuleBasedFallback } from './agents/fallbacks';

/** These agents must use Gemini — no rule-based fallback. */
export const LIVE_ONLY_AGENTS = new Set([
  'AlertTriageAgent',
  'CrisisAnalysisAgent',
  'ActionPlanAgent',
]);

async function safeTraceWrite(agentName: string, payload: unknown, output: unknown, latencyMs: number) {
  try {
    await db.collection('traces').add({
      agentName,
      input: payload,
      output,
      timestamp: new Date().toISOString(),
      latencyMs,
    });
  } catch (e) {
    console.warn('[trace] Firestore write skipped:', (e as Error).message);
  }
}

export async function callAntigravityAgent(
  agentName: string,
  instruction: string,
  inputData: unknown,
  degradedAgentsTracker?: string[],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const startTime = Date.now();
  const payload = { instruction, input: inputData };

  const compactSuffix =
    '\nOUTPUT RULES: max 2 incidents, minified JSON, every string under 80 chars, omit empty arrays.';

  try {
    let parsed = await generateAgentJson(payload);

    if (
      agentName === 'CombinedOrchestrationAgent' &&
      !Array.isArray(parsed.incidents) &&
      hasOpenRouterCredentials()
    ) {
      parsed = await generateAgentJson(
        { instruction: `${instruction}${compactSuffix}`, input: inputData },
        { providers: ['openrouter'] },
      );
    }

    const latencyMs = Date.now() - startTime;
    await safeTraceWrite(agentName, payload, parsed, latencyMs);
    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${agentName}] Failed:`, message);

    if (degradedAgentsTracker) {
      degradedAgentsTracker.push(agentName);
    }

    try {
      await db.doc('apiHealth/antigravity').set(
        {
          status: 'degraded',
          error: message,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch {
      /* local dev without Firestore creds */
    }

    if (LIVE_ONLY_AGENTS.has(agentName)) {
      const hint = hasOpenRouterCredentials()
        ? 'Check GEMINI_API_KEY / OPENROUTER_API_KEY and model names in cloud-run/.env.'
        : 'Set GEMINI_API_KEY or OPENROUTER_API_KEY in cloud-run/.env.';
      throw new Error(`[${agentName}] ${message}. ${hint}`);
    }

    return runRuleBasedFallback(agentName, payload);
  }
}

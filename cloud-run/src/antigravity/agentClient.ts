import { db } from '../firebase-admin';

import {
  generateAgentJson,
  hasGroqCredentials,
  hasOpenRouterCredentials,
  type LlmProvider,
} from './llmGenerate';
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

    if (agentName === 'CombinedOrchestrationAgent' && !Array.isArray(parsed.incidents)) {
      const retryProviders = (
        ['groq', 'openrouter', 'gemini'] as LlmProvider[]
      ).filter((p) => p === 'groq' ? hasGroqCredentials() : p === 'openrouter' ? hasOpenRouterCredentials() : true);
      if (retryProviders.length) {
        parsed = await generateAgentJson(
          { instruction: `${instruction}${compactSuffix}`, input: inputData },
          { providers: retryProviders },
        );
      }
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

    // Always allow rule-based fallback so mobile never hits Pollinations/429 dead-ends.
    const fallback = runRuleBasedFallback(agentName, payload);
    if (LIVE_ONLY_AGENTS.has(agentName)) {
      const triage = fallback.triage as { degradedMode?: boolean } | undefined;
      const analysis = fallback.analysis as { degradedMode?: boolean } | undefined;
      const plan = fallback.actionPlan as { degradedMode?: boolean } | undefined;
      if (triage) triage.degradedMode = true;
      if (analysis) analysis.degradedMode = true;
      if (plan) plan.degradedMode = true;
    }
    return fallback;
  }
}

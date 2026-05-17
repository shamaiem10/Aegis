import { memoryGet, memorySet } from './agentMemoryCache';
import { crisisIdForSignal } from './runCrisisAgents';
import { runContextualAlertOrchestrator } from './agents/contextualAlertOrchestrator';
import type { ContextualAlertPlanResult } from './agents/contextualTypes';
import type { AgentArtifactBundle, FlatSignalInput } from './agents/types';
import { db } from '../firebase-admin';
import { sanitizeForFirestore } from '../utils/sanitizeFirestore';

const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(signalId: string, alertCount: number): string {
  return `ctx:${signalId}:${alertCount}`;
}

function isFresh(ctx: ContextualAlertPlanResult): boolean {
  const age = Date.now() - new Date(ctx.generatedAt).getTime();
  return age >= 0 && age < CACHE_TTL_MS;
}

async function persistContextual(
  artifactId: string,
  ctx: ContextualAlertPlanResult,
): Promise<void> {
  const bundle: AgentArtifactBundle & { contextual?: ContextualAlertPlanResult } = {
    signalId: artifactId,
    crisisId: ctx.crisisId,
    triage: ctx.triage,
    analysis: ctx.analysis as unknown as AgentArtifactBundle['analysis'],
    actionPlan: ctx.actionPlan as unknown as AgentArtifactBundle['actionPlan'],
    updatedAt: ctx.generatedAt,
    degradedAgents: ctx.degradedAgents?.length ? ctx.degradedAgents : ctx.degradedMode ? ['ContextualAlertOrchestrator'] : [],
    contextual: ctx,
  };

  void (async () => {
    try {
      await db
        .collection('agentArtifacts')
        .doc(artifactId)
        .set(sanitizeForFirestore(bundle), { merge: true });
    } catch (e) {
      console.warn('[contextual] Firestore persist skipped:', (e as Error).message);
    }
  })();
}

export function contextualToArtifactBundle(ctx: ContextualAlertPlanResult): AgentArtifactBundle & {
  contextual: ContextualAlertPlanResult;
} {
  return {
    signalId: ctx.focusSignalId,
    crisisId: ctx.crisisId,
    triage: ctx.triage,
    analysis: ctx.analysis as unknown as AgentArtifactBundle['analysis'],
    actionPlan: ctx.actionPlan as unknown as AgentArtifactBundle['actionPlan'],
    updatedAt: ctx.generatedAt,
    degradedAgents: ctx.degradedAgents?.length ? ctx.degradedAgents : ctx.degradedMode ? ['ContextualAlertOrchestrator'] : [],
    contextual: ctx,
  };
}

export async function enrichAlertWithContextualAgents(
  focusSignal: FlatSignalInput,
  allSignals?: FlatSignalInput[],
  options?: { skipCache?: boolean },
): Promise<{
  success: boolean;
  data: AgentArtifactBundle & { contextual: ContextualAlertPlanResult };
  error: string | null;
}> {
  const artifactId = focusSignal.id;
  const queue = (allSignals?.length ? allSignals : [focusSignal]).filter((s) => s?.id);
  const key = cacheKey(artifactId, queue.length);

  if (!options?.skipCache) {
    const mem = memoryGet(key) as (AgentArtifactBundle & { contextual?: ContextualAlertPlanResult }) | null;
    if (mem?.contextual && isFresh(mem.contextual)) {
      return { success: true, data: contextualToArtifactBundle(mem.contextual), error: null };
    }
  }

  try {
    const ctx = await runContextualAlertOrchestrator(focusSignal, queue);
    const data = contextualToArtifactBundle(ctx);
    memorySet(key, data);
    memorySet(artifactId, data);
    await persistContextual(artifactId, ctx);
    return { success: true, data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, data: null as never, error: message };
  }
}

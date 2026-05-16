import { db } from '../firebase-admin';
import { runActionPlanAgent } from './agents/actionPlanAgent';
import { runAlertTriageAgent } from './agents/alertTriageAgent';
import { runCombinedEnrichmentAgent } from './agents/combinedEnrichmentAgent';
import { runCombinedTriageAnalysisAgent } from './agents/combinedTriageAnalysisAgent';
import { runCrisisAnalysisAgent } from './agents/crisisAnalysisAgent';
import { memoryGet, memorySet } from './agentMemoryCache';
import type { AgentArtifactBundle, FlatSignalInput } from './agents/types';

const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheIsFresh(bundle: AgentArtifactBundle): boolean {
  if (!bundle.updatedAt) return false;
  const age = Date.now() - new Date(bundle.updatedAt).getTime();
  return age >= 0 && age < CACHE_TTL_MS;
}

async function loadAgentArtifactsFast(artifactId: string): Promise<AgentArtifactBundle | null> {
  try {
    const doc = await Promise.race([
      db.collection('agentArtifacts').doc(artifactId).get(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('fs_timeout')), 2500)),
    ]);
    if (!doc.exists) return null;
    return doc.data() as AgentArtifactBundle;
  } catch {
    return null;
  }
}

export function crisisIdForSignal(signalId: string): string {
  return signalId.startsWith('pk-') ? signalId : `pk-${signalId}`;
}

export async function loadAgentArtifacts(artifactId: string): Promise<AgentArtifactBundle | null> {
  return loadAgentArtifactsFast(artifactId);
}

async function persistArtifacts(
  artifactId: string,
  bundle: Partial<AgentArtifactBundle>,
): Promise<AgentArtifactBundle> {
  const ref = db.collection('agentArtifacts').doc(artifactId);
  const existing = (await ref.get()).data() as AgentArtifactBundle | undefined;
  const merged: AgentArtifactBundle = {
    signalId: bundle.signalId ?? existing?.signalId,
    crisisId: bundle.crisisId ?? existing?.crisisId,
    triage: bundle.triage ?? existing?.triage,
    analysis: bundle.analysis ?? existing?.analysis,
    actionPlan: bundle.actionPlan ?? existing?.actionPlan,
    updatedAt: new Date().toISOString(),
    degradedAgents: bundle.degradedAgents ?? existing?.degradedAgents ?? [],
  };
  void (async () => {
    try {
      await ref.set(merged, { merge: true });
      const crisisId = merged.crisisId || crisisIdForSignal(artifactId);
      await db
        .collection('crises')
        .doc(crisisId)
        .set(
          {
            agentEnrichment: {
              triage: merged.triage,
              analysis: merged.analysis,
              actionPlan: merged.actionPlan,
              updatedAt: merged.updatedAt,
            },
            updated_at: merged.updatedAt,
          },
          { merge: true },
        );
    } catch (e) {
      console.warn('[agentArtifacts] Firestore persist skipped:', (e as Error).message);
    }
  })();

  return merged;
}

/** Run triage + analysis + action plan for one signal; writes Firestore before return. */
export async function enrichSignalWithAgents(
  signal: FlatSignalInput,
  options?: { skipCache?: boolean; steps?: ('triage' | 'analysis' | 'actionPlan')[] },
): Promise<{ success: boolean; data: AgentArtifactBundle; error: string | null }> {
  const artifactId = signal.id;
  const crisisId = crisisIdForSignal(artifactId);
  const steps = options?.steps ?? ['triage', 'analysis', 'actionPlan'];

  const needsTriage = steps.includes('triage');
  const needsAnalysis = steps.includes('analysis');
  const needsPlan = steps.includes('actionPlan');

  if (!options?.skipCache) {
    const mem = memoryGet(artifactId);
    if (mem && cacheIsFresh(mem)) {
      const ok =
        (!needsTriage || mem.triage) && (!needsAnalysis || mem.analysis) && (!needsPlan || mem.actionPlan);
      if (ok) return { success: true, data: mem, error: null };
    }
    const cached = await loadAgentArtifactsFast(artifactId);
    if (cached && cacheIsFresh(cached)) {
      const ok =
        (!needsTriage || cached.triage) &&
        (!needsAnalysis || cached.analysis) &&
        (!needsPlan || cached.actionPlan);
      if (ok) {
        memorySet(artifactId, cached);
        return { success: true, data: cached, error: null };
      }
    }
  }

  const degraded: string[] = [];
  const partial: Partial<AgentArtifactBundle> = {
    signalId: artifactId,
    crisisId,
    degradedAgents: degraded,
  };

  try {
    const wantsAll = needsTriage && needsAnalysis && needsPlan;
    const wantsAnalysisOnly = needsTriage && needsAnalysis && !needsPlan;

    if (wantsAll) {
      const combined = await runCombinedEnrichmentAgent(signal, crisisId);
      partial.triage = combined.triage;
      partial.analysis = combined.analysis;
      partial.actionPlan = combined.actionPlan;
    } else if (wantsAnalysisOnly) {
      const ta = await runCombinedTriageAnalysisAgent(signal, crisisId);
      partial.triage = ta.triage;
      partial.analysis = ta.analysis;
    } else {
      const runTriage = steps.includes('triage')
        ? runAlertTriageAgent(signal, degraded).then((t) => {
            partial.triage = t;
          })
        : Promise.resolve();
      const runAnalysis = steps.includes('analysis')
        ? runCrisisAnalysisAgent(signal, crisisId, degraded).then((a) => {
            partial.analysis = a;
          })
        : Promise.resolve();
      const runPlan = steps.includes('actionPlan')
        ? runActionPlanAgent(signal, crisisId, degraded).then((p) => {
            partial.actionPlan = p;
          })
        : Promise.resolve();
      await Promise.all([runTriage, runAnalysis, runPlan]);
    }

    partial.degradedAgents = degraded;
    const data = await persistArtifacts(artifactId, partial);
    memorySet(artifactId, data);
    return { success: true, data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, data: partial as AgentArtifactBundle, error: message };
  }
}

export async function enrichCrisisById(
  crisisId: string,
  signal?: FlatSignalInput,
): Promise<{ success: boolean; data: AgentArtifactBundle | null; error: string | null }> {
  const crisisDoc = await db.collection('crises').doc(crisisId).get();
  const crisisData = crisisDoc.data();

  let resolvedSignal = signal;
  if (!resolvedSignal) {
    const fused = crisisData?.fused?.[0] ?? crisisData?.agentEnrichment;
    const sid =
      (crisisData?.meta?.pk_mock_signal_id as string) ||
      (fused?.id as string) ||
      crisisId.replace(/^pk-/, '');
    resolvedSignal = {
      id: sid,
      text: String(fused?.summary ?? crisisData?.display_name ?? 'Crisis incident'),
      region: String(fused?.region ?? 'Pakistan'),
      severity_hint: Number(crisisData?.severity?.score ?? fused?.fused_severity_hint ?? 6),
      kind: String(crisisData?.classification?.category ?? 'incident'),
      source: String(crisisData?.meta?.feed_source ?? 'aegis'),
      recorded_at: String(crisisData?.created_at ?? new Date().toISOString()),
    };
  }

  return enrichSignalWithAgents(resolvedSignal);
}

export async function getActionPlanForArtifact(
  artifactId: string,
): Promise<{ success: boolean; data: AgentArtifactBundle | null; error: string | null }> {
  const cached = await loadAgentArtifacts(artifactId);
  if (cached?.actionPlan) {
    return { success: true, data: cached, error: null };
  }
  return { success: false, data: null, error: 'action_plan_not_generated' };
}

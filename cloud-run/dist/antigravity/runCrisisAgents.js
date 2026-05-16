"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crisisIdForSignal = crisisIdForSignal;
exports.loadAgentArtifacts = loadAgentArtifacts;
exports.enrichSignalWithAgents = enrichSignalWithAgents;
exports.enrichCrisisById = enrichCrisisById;
exports.getActionPlanForArtifact = getActionPlanForArtifact;
const firebase_admin_1 = require("../firebase-admin");
const actionPlanAgent_1 = require("./agents/actionPlanAgent");
const alertTriageAgent_1 = require("./agents/alertTriageAgent");
const combinedEnrichmentAgent_1 = require("./agents/combinedEnrichmentAgent");
const combinedTriageAnalysisAgent_1 = require("./agents/combinedTriageAnalysisAgent");
const crisisAnalysisAgent_1 = require("./agents/crisisAnalysisAgent");
const agentMemoryCache_1 = require("./agentMemoryCache");
const CACHE_TTL_MS = 15 * 60 * 1000;
function cacheIsFresh(bundle) {
    if (!bundle.updatedAt)
        return false;
    const age = Date.now() - new Date(bundle.updatedAt).getTime();
    return age >= 0 && age < CACHE_TTL_MS;
}
async function loadAgentArtifactsFast(artifactId) {
    try {
        const doc = await Promise.race([
            firebase_admin_1.db.collection('agentArtifacts').doc(artifactId).get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('fs_timeout')), 2500)),
        ]);
        if (!doc.exists)
            return null;
        return doc.data();
    }
    catch {
        return null;
    }
}
function crisisIdForSignal(signalId) {
    return signalId.startsWith('pk-') ? signalId : `pk-${signalId}`;
}
async function loadAgentArtifacts(artifactId) {
    return loadAgentArtifactsFast(artifactId);
}
async function persistArtifacts(artifactId, bundle) {
    const ref = firebase_admin_1.db.collection('agentArtifacts').doc(artifactId);
    const existing = (await ref.get()).data();
    const merged = {
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
            await firebase_admin_1.db
                .collection('crises')
                .doc(crisisId)
                .set({
                agentEnrichment: {
                    triage: merged.triage,
                    analysis: merged.analysis,
                    actionPlan: merged.actionPlan,
                    updatedAt: merged.updatedAt,
                },
                updated_at: merged.updatedAt,
            }, { merge: true });
        }
        catch (e) {
            console.warn('[agentArtifacts] Firestore persist skipped:', e.message);
        }
    })();
    return merged;
}
/** Run triage + analysis + action plan for one signal; writes Firestore before return. */
async function enrichSignalWithAgents(signal, options) {
    const artifactId = signal.id;
    const crisisId = crisisIdForSignal(artifactId);
    const steps = options?.steps ?? ['triage', 'analysis', 'actionPlan'];
    const needsTriage = steps.includes('triage');
    const needsAnalysis = steps.includes('analysis');
    const needsPlan = steps.includes('actionPlan');
    if (!options?.skipCache) {
        const mem = (0, agentMemoryCache_1.memoryGet)(artifactId);
        if (mem && cacheIsFresh(mem)) {
            const ok = (!needsTriage || mem.triage) && (!needsAnalysis || mem.analysis) && (!needsPlan || mem.actionPlan);
            if (ok)
                return { success: true, data: mem, error: null };
        }
        const cached = await loadAgentArtifactsFast(artifactId);
        if (cached && cacheIsFresh(cached)) {
            const ok = (!needsTriage || cached.triage) &&
                (!needsAnalysis || cached.analysis) &&
                (!needsPlan || cached.actionPlan);
            if (ok) {
                (0, agentMemoryCache_1.memorySet)(artifactId, cached);
                return { success: true, data: cached, error: null };
            }
        }
    }
    const degraded = [];
    const partial = {
        signalId: artifactId,
        crisisId,
        degradedAgents: degraded,
    };
    try {
        const wantsAll = needsTriage && needsAnalysis && needsPlan;
        const wantsAnalysisOnly = needsTriage && needsAnalysis && !needsPlan;
        if (wantsAll) {
            const combined = await (0, combinedEnrichmentAgent_1.runCombinedEnrichmentAgent)(signal, crisisId);
            partial.triage = combined.triage;
            partial.analysis = combined.analysis;
            partial.actionPlan = combined.actionPlan;
        }
        else if (wantsAnalysisOnly) {
            const ta = await (0, combinedTriageAnalysisAgent_1.runCombinedTriageAnalysisAgent)(signal, crisisId);
            partial.triage = ta.triage;
            partial.analysis = ta.analysis;
        }
        else {
            const runTriage = steps.includes('triage')
                ? (0, alertTriageAgent_1.runAlertTriageAgent)(signal, degraded).then((t) => {
                    partial.triage = t;
                })
                : Promise.resolve();
            const runAnalysis = steps.includes('analysis')
                ? (0, crisisAnalysisAgent_1.runCrisisAnalysisAgent)(signal, crisisId, degraded).then((a) => {
                    partial.analysis = a;
                })
                : Promise.resolve();
            const runPlan = steps.includes('actionPlan')
                ? (0, actionPlanAgent_1.runActionPlanAgent)(signal, crisisId, degraded).then((p) => {
                    partial.actionPlan = p;
                })
                : Promise.resolve();
            await Promise.all([runTriage, runAnalysis, runPlan]);
        }
        partial.degradedAgents = degraded;
        const data = await persistArtifacts(artifactId, partial);
        (0, agentMemoryCache_1.memorySet)(artifactId, data);
        return { success: true, data, error: null };
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, data: partial, error: message };
    }
}
async function enrichCrisisById(crisisId, signal) {
    const crisisDoc = await firebase_admin_1.db.collection('crises').doc(crisisId).get();
    const crisisData = crisisDoc.data();
    let resolvedSignal = signal;
    if (!resolvedSignal) {
        const fused = crisisData?.fused?.[0] ?? crisisData?.agentEnrichment;
        const sid = crisisData?.meta?.pk_mock_signal_id ||
            fused?.id ||
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
async function getActionPlanForArtifact(artifactId) {
    const cached = await loadAgentArtifacts(artifactId);
    if (cached?.actionPlan) {
        return { success: true, data: cached, error: null };
    }
    return { success: false, data: null, error: 'action_plan_not_generated' };
}

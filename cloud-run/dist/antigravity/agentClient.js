"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_ONLY_AGENTS = void 0;
exports.callAntigravityAgent = callAntigravityAgent;
const firebase_admin_1 = require("../firebase-admin");
const llmGenerate_1 = require("./llmGenerate");
const fallbacks_1 = require("./agents/fallbacks");
/** These agents must use Gemini — no rule-based fallback. */
exports.LIVE_ONLY_AGENTS = new Set([
    'AlertTriageAgent',
    'CrisisAnalysisAgent',
    'ActionPlanAgent',
]);
async function safeTraceWrite(agentName, payload, output, latencyMs) {
    try {
        await firebase_admin_1.db.collection('traces').add({
            agentName,
            input: payload,
            output,
            timestamp: new Date().toISOString(),
            latencyMs,
        });
    }
    catch (e) {
        console.warn('[trace] Firestore write skipped:', e.message);
    }
}
async function callAntigravityAgent(agentName, instruction, inputData, degradedAgentsTracker) {
    const startTime = Date.now();
    const payload = { instruction, input: inputData };
    const compactSuffix = '\nOUTPUT RULES: max 2 incidents, minified JSON, every string under 80 chars, omit empty arrays.';
    try {
        let parsed = await (0, llmGenerate_1.generateAgentJson)(payload);
        if (agentName === 'CombinedOrchestrationAgent' && !Array.isArray(parsed.incidents)) {
            const retryProviders = ['groq', 'openrouter', 'gemini'].filter((p) => p === 'groq' ? (0, llmGenerate_1.hasGroqCredentials)() : p === 'openrouter' ? (0, llmGenerate_1.hasOpenRouterCredentials)() : true);
            if (retryProviders.length) {
                parsed = await (0, llmGenerate_1.generateAgentJson)({ instruction: `${instruction}${compactSuffix}`, input: inputData }, { providers: retryProviders });
            }
        }
        const latencyMs = Date.now() - startTime;
        await safeTraceWrite(agentName, payload, parsed, latencyMs);
        return parsed;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${agentName}] Failed:`, message);
        if (degradedAgentsTracker) {
            degradedAgentsTracker.push(agentName);
        }
        try {
            await firebase_admin_1.db.doc('apiHealth/antigravity').set({
                status: 'degraded',
                error: message,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }
        catch {
            /* local dev without Firestore creds */
        }
        // Always allow rule-based fallback so mobile never hits Pollinations/429 dead-ends.
        const fallback = (0, fallbacks_1.runRuleBasedFallback)(agentName, payload);
        if (exports.LIVE_ONLY_AGENTS.has(agentName)) {
            const triage = fallback.triage;
            const analysis = fallback.analysis;
            const plan = fallback.actionPlan;
            if (triage)
                triage.degradedMode = true;
            if (analysis)
                analysis.degradedMode = true;
            if (plan)
                plan.degradedMode = true;
        }
        return fallback;
    }
}

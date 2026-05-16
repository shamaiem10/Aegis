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
        if (agentName === 'CombinedOrchestrationAgent' &&
            !Array.isArray(parsed.incidents) &&
            (0, llmGenerate_1.hasOpenRouterCredentials)()) {
            parsed = await (0, llmGenerate_1.generateAgentJson)({ instruction: `${instruction}${compactSuffix}`, input: inputData }, { providers: ['openrouter'] });
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
        if (exports.LIVE_ONLY_AGENTS.has(agentName)) {
            const hint = (0, llmGenerate_1.hasOpenRouterCredentials)()
                ? 'Check GEMINI_API_KEY / OPENROUTER_API_KEY and model names in cloud-run/.env.'
                : 'Set GEMINI_API_KEY or OPENROUTER_API_KEY in cloud-run/.env.';
            throw new Error(`[${agentName}] ${message}. ${hint}`);
        }
        return (0, fallbacks_1.runRuleBasedFallback)(agentName, payload);
    }
}

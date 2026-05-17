"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCombinedTriageAnalysisAgent = runCombinedTriageAnalysisAgent;
const geminiGenerate_1 = require("../geminiGenerate");
const alertTriageAgent_1 = require("./alertTriageAgent");
const crisisAnalysisAgent_1 = require("./crisisAnalysisAgent");
const INSTRUCTION = `AEGIS Pakistan — return compact JSON only:
{"triage":{"signalId":"","disposition":"escalate|monitor|dismiss_candidate","priority":"CRITICAL|HIGH|MEDIUM|LOW","confidencePct":0,"headline":"","rationale":"","recommendedNextSteps":[],"assignTo":[]},"analysis":{"crisisId":"","executiveSummary":"","keyRisks":[],"affectedDomains":[],"coordinationNotes":[],"stakeholderAlerts":[{"audience":"","message":"","urgency":"HIGH"}]}}
Max 2 sentences per text field. 3 risks, 3 steps, 2 stakeholder alerts.`;
const now = () => new Date().toISOString();
/** Alert screen only — no action plan (faster). */
async function runCombinedTriageAnalysisAgent(signal, crisisId) {
    const degraded = [];
    try {
        const parsed = await (0, geminiGenerate_1.generateGeminiJson)({ instruction: INSTRUCTION, input: { signal, crisisId } }, { providers: (0, geminiGenerate_1.agentLlmProviders)() });
        const triage = parsed.triage;
        const analysis = parsed.analysis;
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
    catch (e) {
        console.warn('[CombinedTriageAnalysisAgent] LLM failed, sequential fallback:', e.message);
        degraded.push('CombinedTriageAnalysisAgent');
        const triage = await (0, alertTriageAgent_1.runAlertTriageAgent)(signal, degraded);
        const analysis = await (0, crisisAnalysisAgent_1.runCrisisAnalysisAgent)(signal, crisisId, degraded);
        return { triage, analysis };
    }
}

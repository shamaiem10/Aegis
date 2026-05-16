"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCrisisAnalysisAgent = runCrisisAnalysisAgent;
const agentClient_1 = require("../agentClient");
const INSTRUCTION = `Role: Deep analysis for one signal tied to crisisId.
Input: { signal, crisisId }
Output: { "analysis": { "crisisId", "hypothesis", "evidence", "gaps", "recommendedActions", "stakeholderAlerts" } }`;
async function runCrisisAnalysisAgent(signal, crisisId, degraded) {
    const parsed = await (0, agentClient_1.callAntigravityAgent)('CrisisAnalysisAgent', INSTRUCTION, { signal, crisisId }, degraded);
    const analysis = parsed.analysis;
    if (analysis?.crisisId) {
        return {
            ...analysis,
            signalId: analysis.signalId ?? signal.id,
            degradedMode: false,
            generatedAt: new Date().toISOString(),
            agentName: 'CrisisAnalysisAgent',
        };
    }
    throw new Error('CrisisAnalysisAgent returned invalid JSON (missing analysis.crisisId)');
}

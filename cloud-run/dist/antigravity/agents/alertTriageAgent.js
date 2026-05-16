"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAlertTriageAgent = runAlertTriageAgent;
const agentClient_1 = require("../agentClient");
const INSTRUCTION = `Role: Triage ONE signal for the response desk.
Input: { signal: FlatSignalInput }
Output: { "triage": { "signalId", "disposition", "priority", "confidencePct", "headline", "rationale", "recommendedNextSteps", "assignTo" } }
severity_hint >= 8 → usually escalate CRITICAL.`;
async function runAlertTriageAgent(signal, degraded) {
    const parsed = await (0, agentClient_1.callAntigravityAgent)('AlertTriageAgent', INSTRUCTION, { signal }, degraded);
    const triage = parsed.triage;
    if (triage?.signalId) {
        return {
            ...triage,
            degradedMode: false,
            generatedAt: new Date().toISOString(),
            agentName: 'AlertTriageAgent',
        };
    }
    throw new Error('AlertTriageAgent returned invalid JSON (missing triage.signalId)');
}

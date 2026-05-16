"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runActionPlanAgent = runActionPlanAgent;
const agentClient_1 = require("../agentClient");
const INSTRUCTION = `Role: Operational action plan for one crisis.
Input: { signal, crisisId }
Output: { "actionPlan": { "crisisId", "phases": [{ "name", "actions", "owner", "etaMin" }], "resourceNeeds", "risks" } }`;
async function runActionPlanAgent(signal, crisisId, degraded) {
    const parsed = await (0, agentClient_1.callAntigravityAgent)('ActionPlanAgent', INSTRUCTION, { signal, crisisId }, degraded);
    const actionPlan = parsed.actionPlan;
    if (actionPlan?.crisisId && Array.isArray(actionPlan.phases)) {
        return {
            ...actionPlan,
            signalId: actionPlan.signalId ?? signal.id,
            degradedMode: false,
            generatedAt: new Date().toISOString(),
            agentName: 'ActionPlanAgent',
        };
    }
    throw new Error('ActionPlanAgent returned invalid JSON (missing actionPlan.phases)');
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCombinedOrchestrationAgent = runCombinedOrchestrationAgent;
const agentClient_1 = require("../antigravity/agentClient");
const INSTRUCTION = `Role: Run classification, prediction, allocation, false-alarm, compound, alert drafting, and action planning in ONE minified JSON.
Input: { fusedSignals (max 10 compact rows), weather: { temp, alert }?, currentResources: [{...}] }
Output keys: incidents, predictions, allocations, falseAlarmChecks, compoundRisks, alertDrafts, actionPlans
Max 2 incidents. Every string <80 chars. id === crisisId. Valid JSON only.
actionPlans shape: [{ "crisisId", "phases": [{ "name", "actions", "owner", "etaMin", "assignedResourceUnitId" }] }]`;
/** Steps 2–7 in a single Gemini call (~30–45s vs ~2–3 min sequential). */
async function runCombinedOrchestrationAgent(fusedSignals, weatherForecast, degradedAgents, currentResources) {
    const sample = fusedSignals.slice(0, 10).map((fs) => {
        const row = fs;
        return {
            id: row.id,
            sourceType: row.sourceType,
            urgencyScore: row.urgencyScore,
            credibilityScore: row.credibilityScore,
            region: row.region ?? row.raw?.region,
        };
    });
    const weatherSnippet = weatherForecast && typeof weatherForecast === "object"
        ? {
            temp: weatherForecast.temperature,
            alert: weatherForecast.alertLevel,
        }
        : null;
    const units = currentResources?.unitsForAgent ??
        currentResources?.units ??
        [];
    return (0, agentClient_1.callAntigravityAgent)("CombinedOrchestrationAgent", INSTRUCTION, { fusedSignals: sample, weather: weatherSnippet, currentResources: units }, degradedAgents);
}

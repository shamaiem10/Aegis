"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCombinedEnrichmentAgent = runCombinedEnrichmentAgent;
const geminiGenerate_1 = require("../geminiGenerate");
const INSTRUCTION = `You are the AEGIS Pakistan combined enrichment agent.
Given ONE alert signal, produce triage, dossier analysis, and action plan in a SINGLE JSON object.

Return JSON only:
{
  "triage": {
    "signalId": "<id>",
    "disposition": "escalate" | "monitor" | "dismiss_candidate",
    "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    "confidencePct": 0-99,
    "headline": "one line",
    "rationale": "2 sentences max",
    "recommendedNextSteps": ["3-4 short steps"],
    "assignTo": ["agencies"]
  },
  "analysis": {
    "crisisId": "<crisisId from input>",
    "hypothesis": "3 sentences max",
    "evidence": ["3 items"],
    "gaps": ["transport", "..."],
    "recommendedActions": ["2-3 items"],
    "stakeholderAlerts": [{ "audience": "...", "message": "...", "urgency": "HIGH" }]
  },
  "actionPlan": {
    "crisisId": "<crisisId>",
    "phases": [
      {
        "name": "snake_case",
        "actions": ["imperative"],
        "owner": "agency",
        "etaMin": <number>
      }
    ],
    "resourceNeeds": ["..."],
    "risks": ["..."]
  }
}

Rules: Pakistan context (NDMA, NHMP, Rescue 1122). 4-5 action tasks. Be concise.`;
const now = () => new Date().toISOString();
/** One Gemini call instead of three — much faster for mobile enrich. */
async function runCombinedEnrichmentAgent(signal, crisisId) {
    const parsed = await (0, geminiGenerate_1.generateGeminiJson)({ instruction: INSTRUCTION, input: { signal, crisisId } }, { providers: (0, geminiGenerate_1.agentLlmProviders)() });
    const triage = parsed.triage;
    const analysis = parsed.analysis;
    const actionPlan = parsed.actionPlan;
    if (!triage?.signalId || !analysis?.crisisId || !actionPlan?.phases?.length) {
        throw new Error('CombinedEnrichmentAgent returned incomplete JSON');
    }
    return {
        triage: {
            ...triage,
            signalId: signal.id,
            degradedMode: false,
            generatedAt: now(),
            agentName: 'CombinedEnrichmentAgent',
        },
        analysis: {
            ...analysis,
            crisisId,
            signalId: signal.id,
            degradedMode: false,
            generatedAt: now(),
            agentName: 'CombinedEnrichmentAgent',
        },
        actionPlan: {
            ...actionPlan,
            crisisId,
            signalId: signal.id,
            degradedMode: false,
            generatedAt: now(),
            agentName: 'CombinedEnrichmentAgent',
        },
    };
}

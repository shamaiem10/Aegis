"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAgentJsonText = parseAgentJsonText;
const jsonRepair_1 = require("./jsonRepair");
/** Tolerate truncated / slightly invalid LLM JSON. */
function parseAgentJsonText(responseText) {
    const cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const attempts = [cleaned, cleaned.slice(cleaned.indexOf("{"))].filter((s, i, arr) => s && arr.indexOf(s) === i);
    for (const raw of attempts) {
        try {
            return JSON.parse(raw);
        }
        catch {
            /* next */
        }
        const repaired = (0, jsonRepair_1.repairTruncatedJson)(raw);
        if (repaired) {
            try {
                return JSON.parse(repaired);
            }
            catch {
                /* salvage */
            }
        }
        const salvaged = (0, jsonRepair_1.salvagePartialGeminiJson)(raw);
        if (salvaged) {
            console.warn("[llm] Salvaged partial JSON from truncated response");
            return salvaged;
        }
        if (repaired) {
            const salvagedRepaired = (0, jsonRepair_1.salvagePartialGeminiJson)(repaired);
            if (salvagedRepaired) {
                console.warn("[llm] Salvaged partial JSON after bracket repair");
                return salvagedRepaired;
            }
        }
    }
    throw new Error(`LLM returned invalid JSON (${cleaned.slice(0, 80)}…)`);
}

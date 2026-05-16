import { repairTruncatedJson, salvagePartialGeminiJson } from "./jsonRepair";

/** Tolerate truncated / slightly invalid LLM JSON. */
export function parseAgentJsonText(responseText: string): Record<string, unknown> {
  const cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const attempts = [cleaned, cleaned.slice(cleaned.indexOf("{"))].filter(
    (s, i, arr) => s && arr.indexOf(s) === i,
  );

  for (const raw of attempts) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* next */
    }
    const repaired = repairTruncatedJson(raw);
    if (repaired) {
      try {
        return JSON.parse(repaired) as Record<string, unknown>;
      } catch {
        /* salvage */
      }
    }
    const salvaged = salvagePartialGeminiJson(raw);
    if (salvaged) {
      console.warn("[llm] Salvaged partial JSON from truncated response");
      return salvaged;
    }
    if (repaired) {
      const salvagedRepaired = salvagePartialGeminiJson(repaired);
      if (salvagedRepaired) {
        console.warn("[llm] Salvaged partial JSON after bracket repair");
        return salvagedRepaired;
      }
    }
  }

  throw new Error(`LLM returned invalid JSON (${cleaned.slice(0, 80)}…)`);
}

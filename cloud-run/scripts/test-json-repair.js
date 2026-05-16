const { parseGeminiJsonText } = require("../dist/antigravity/geminiGenerate");

const truncated = `{
  "fusedSignals": [
    {"id": "a1", "sourceType": "pmd", "credibilityScore": 99, "urgencyScore": 80},
    {"id": "a2", "sourceType": "social", "credibilityScore": 50`;

const out = parseGeminiJsonText(truncated);
console.log("salvaged count:", out.fusedSignals?.length ?? 0);
console.log(JSON.stringify(out, null, 2));

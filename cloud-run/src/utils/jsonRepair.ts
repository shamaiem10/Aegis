/** Repair truncated Gemini JSON (objects + arrays). */

export function repairTruncatedJson(raw: string): string | null {
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;

  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === "{") braceDepth++;
      if (c === "}") braceDepth--;
      if (c === "[") bracketDepth++;
      if (c === "]") bracketDepth--;
    }
  }

  let out = s;
  if (inString) out += '"';
  while (bracketDepth > 0) {
    out += "]";
    bracketDepth--;
  }
  while (braceDepth > 0) {
    out += "}";
    braceDepth--;
  }

  try {
    JSON.parse(out);
    return out;
  } catch {
    return null;
  }
}

/** Pull complete `{...}` objects from a truncated array field. */
export function extractObjectsFromBrokenArray(
  text: string,
  fieldName: string,
): Record<string, unknown>[] {
  const re = new RegExp(`"${fieldName}"\\s*:\\s*\\[`);
  const m = re.exec(text);
  if (!m || m.index === undefined) return [];

  const start = m.index + m[0].length;
  const slice = text.slice(start);
  const objects: Record<string, unknown>[] = [];
  let i = 0;
  while (i < slice.length) {
    const ch = slice[i];
    if (ch === "{" ) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      let j = i;
      for (; j < slice.length; j++) {
        const c = slice[j];
        if (esc) {
          esc = false;
          continue;
        }
        if (c === "\\" && inStr) {
          esc = true;
          continue;
        }
        if (c === '"') {
          inStr = !inStr;
          continue;
        }
        if (!inStr) {
          if (c === "{") depth++;
          if (c === "}") {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
        }
      }
      const chunk = slice.slice(i, j);
      try {
        objects.push(JSON.parse(chunk) as Record<string, unknown>);
      } catch {
        break;
      }
      i = j;
      continue;
    }
    if (ch === "]") break;
    i++;
  }
  return objects;
}

const COMBINED_ARRAY_FIELDS = [
  "predictions",
  "allocations",
  "falseAlarmChecks",
  "compoundRisks",
  "alertDrafts",
] as const;

export function salvagePartialGeminiJson(cleaned: string): Record<string, unknown> | null {
  const fused = extractObjectsFromBrokenArray(cleaned, "fusedSignals");
  if (fused.length) return { fusedSignals: fused };

  const incidents = extractObjectsFromBrokenArray(cleaned, "incidents");
  if (incidents.length) {
    const out: Record<string, unknown> = { incidents };
    for (const field of COMBINED_ARRAY_FIELDS) {
      const items = extractObjectsFromBrokenArray(cleaned, field);
      if (items.length) out[field] = items;
    }
    for (const field of COMBINED_ARRAY_FIELDS) {
      if (!out[field]) out[field] = [];
    }
    return out;
  }

  return null;
}

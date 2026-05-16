/** Remove undefined values so Firestore accepts nested dossier/meta payloads. */

export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val !== undefined) {
      out[key] = sanitizeForFirestore(val);
    }
  }
  return out as T;
}

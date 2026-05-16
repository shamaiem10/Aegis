"use strict";
/** Remove undefined values so Firestore accepts nested dossier/meta payloads. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeForFirestore = sanitizeForFirestore;
function sanitizeForFirestore(value) {
    if (value === undefined) {
        return value;
    }
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForFirestore(item));
    }
    const out = {};
    for (const [key, val] of Object.entries(value)) {
        if (val !== undefined) {
            out[key] = sanitizeForFirestore(val);
        }
    }
    return out;
}

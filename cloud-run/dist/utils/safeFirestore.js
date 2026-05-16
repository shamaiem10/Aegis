"use strict";
/** Firestore writes must never fail the HTTP pipeline — log and continue. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreWritesEnabled = firestoreWritesEnabled;
exports.safeFirestoreWrite = safeFirestoreWrite;
function firestoreWritesEnabled() {
    return process.env.DISABLE_FIRESTORE_WRITES !== '1';
}
async function safeFirestoreWrite(label, fn) {
    if (!firestoreWritesEnabled()) {
        return false;
    }
    try {
        await fn();
        return true;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const hint = /insufficient permissions/i.test(msg)
            ? ' (use firebase-adminsdk service account JSON — see cloud-run/.env)'
            : '';
        console.warn(`[firestore:${label}] skipped — ${msg}${hint}`);
        return false;
    }
}

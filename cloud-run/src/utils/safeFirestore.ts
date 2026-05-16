/** Firestore writes must never fail the HTTP pipeline — log and continue. */

export function firestoreWritesEnabled(): boolean {
  return process.env.DISABLE_FIRESTORE_WRITES !== '1';
}

export async function safeFirestoreWrite(
  label: string,
  fn: () => Promise<unknown>,
): Promise<boolean> {
  if (!firestoreWritesEnabled()) {
    return false;
  }
  try {
    await fn();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = /insufficient permissions/i.test(msg)
      ? ' (use firebase-adminsdk service account JSON — see cloud-run/.env)'
      : '';
    console.warn(`[firestore:${label}] skipped — ${msg}${hint}`);
    return false;
  }
}

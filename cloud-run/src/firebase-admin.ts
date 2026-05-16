/**
 * Firebase Admin for Cloud Run / local dev.
 * IMPORTANT: `gcloud config get-value project` must match GCP_PROJECT_ID, or set
 * GOOGLE_APPLICATION_CREDENTIALS to the aegis-496207 service-account JSON.
 */
import * as fs from "fs";
import * as path from "path";

import * as admin from "firebase-admin";

export function resolveFirebaseProjectId(): string {
  return (
    process.env.GCP_PROJECT_ID?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    "aegis-496207"
  );
}

const firebaseProjectId = resolveFirebaseProjectId();

// ADC and many Google clients read these — overrides gcloud default (e.g. aegis-pk-2026).
process.env.GOOGLE_CLOUD_PROJECT = firebaseProjectId;
process.env.GCLOUD_PROJECT = firebaseProjectId;

function resolveServiceAccountPath(): string | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const candidates = [
    raw,
    path.join(process.cwd(), "secrets", "aegis-496207-sa.json"),
    path.join(process.cwd(), "..", "frontend", "mobile", "secrets", "aegis-496207-sa.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

const saPath = resolveServiceAccountPath();
const credential = saPath
  ? admin.credential.cert(saPath)
  : admin.credential.applicationDefault();

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseProjectId,
    credential,
  });
  const credKind = saPath
    ? `service-account (${path.basename(saPath)})`
    : "application-default (your gcloud login — needs Firestore write role or use SA JSON)";
  console.log(`[firebase-admin] project=${firebaseProjectId} credential=${credKind}`);
  if (!saPath) {
    console.warn(
      "[firebase-admin] Tip: Firebase Console → Project settings → Service accounts → Generate new private key → " +
        "save as cloud-run/secrets/aegis-496207-sa.json and set GOOGLE_APPLICATION_CREDENTIALS in .env",
    );
  }
}

export { admin };
export const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

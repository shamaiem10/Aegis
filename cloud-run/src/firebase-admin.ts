/**
 * Firebase Admin — uses Application Default Credentials.
 * - Cloud Run: the service identity is picked up automatically.
 * - Local: set GOOGLE_APPLICATION_CREDENTIALS to your key file
 *   (e.g. ./secrets/aegis-496207-sa.json from the cloud-run/ working directory).
 */
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export { admin };
export const db = admin.firestore();

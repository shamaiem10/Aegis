/** User-facing pipeline / API errors (no raw Google JSON walls). */

export function friendlyPipelineError(message: string): string {
  const m = message.trim();
  if (/insufficient permissions/i.test(m)) {
    return (
      "Your PC login can read Firebase Console but cannot write via the Admin SDK. " +
      "Download the service account key (firebase-adminsdk) for aegis-496207, save to cloud-run/secrets/aegis-496207-sa.json, " +
      "set GOOGLE_APPLICATION_CREDENTIALS=./secrets/aegis-496207-sa.json in cloud-run/.env, restart npm run dev. " +
      "Pipeline results still return in the app; only cloud sync is skipped."
    );
  }
  if (/PERMISSION_DENIED|Firestore API has not been used|cloud firestore/i.test(m)) {
    const project = m.match(/project\s+([a-z0-9-]+)/i)?.[1];
    const projHint = project
      ? ` Your credentials point at project “${project}”.`
      : "";
    return (
      `Cloud Firestore is not available for this backend.${projHint} ` +
      `Fix: in cloud-run/.env set GCP_PROJECT_ID=aegis-496207, run “gcloud config set project aegis-496207”, ` +
      `enable Firestore in Google Cloud Console for that project, and restart cloud-run (npm run dev). ` +
      `The pipeline can still return results in the app even when Firestore save is skipped.`
    );
  }
  if (/GEMINI|429|quota|API key/i.test(m)) {
    return `Gemini AI error — check GEMINI_API_KEY and GEMINI_VERTEX_MODEL in cloud-run/.env, then restart the server. (${m.slice(0, 120)})`;
  }
  if (/abort|timed out|no response|network/i.test(m)) {
    return "Could not reach Cloud Run on port 8080. Same Wi‑Fi, correct LAN IP in Settings, and npm run dev with firewall open.";
  }
  if (m.length > 320) return `${m.slice(0, 317)}…`;
  return m;
}

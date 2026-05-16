"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.admin = void 0;
exports.resolveFirebaseProjectId = resolveFirebaseProjectId;
/**
 * Firebase Admin for Cloud Run / local dev.
 * IMPORTANT: `gcloud config get-value project` must match GCP_PROJECT_ID, or set
 * GOOGLE_APPLICATION_CREDENTIALS to the aegis-496207 service-account JSON.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const admin = __importStar(require("firebase-admin"));
exports.admin = admin;
function resolveFirebaseProjectId() {
    return (process.env.GCP_PROJECT_ID?.trim() ||
        process.env.FIREBASE_PROJECT_ID?.trim() ||
        process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
        "aegis-496207");
}
const firebaseProjectId = resolveFirebaseProjectId();
// ADC and many Google clients read these — overrides gcloud default (e.g. aegis-pk-2026).
process.env.GOOGLE_CLOUD_PROJECT = firebaseProjectId;
process.env.GCLOUD_PROJECT = firebaseProjectId;
function resolveServiceAccountPath() {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const candidates = [
        raw,
        path.join(process.cwd(), "secrets", "aegis-496207-sa.json"),
        path.join(process.cwd(), "..", "frontend", "mobile", "secrets", "aegis-496207-sa.json"),
    ].filter(Boolean);
    for (const p of candidates) {
        const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
        if (fs.existsSync(resolved))
            return resolved;
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
        console.warn("[firebase-admin] Tip: Firebase Console → Project settings → Service accounts → Generate new private key → " +
            "save as cloud-run/secrets/aegis-496207-sa.json and set GOOGLE_APPLICATION_CREDENTIALS in .env");
    }
}
exports.db = admin.firestore();
exports.db.settings({ ignoreUndefinedProperties: true });

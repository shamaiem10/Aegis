/**
 * Seed Firestore (project aegis-496207) from bundled mobile demo data.
 * Prerequisites: place service account JSON at frontend/mobile/secrets/aegis-496207-sa.json
 *
 * Usage: npm run seed  (from frontend/mobile)
 */
import * as fs from "fs";
import * as path from "path";

import * as admin from "firebase-admin";

import { resources as mockResources } from "../src/components/aegis/data";
import { DEMO_ISLAMABAD_DOSSIERS } from "../src/data/demoIslamabadCrises";

const SERVICE_ACCOUNT = path.join(__dirname, "..", "secrets", "aegis-496207-sa.json");

/** Matches dashboard naming; all seeded with status `unknown` per task. */
const API_HEALTH_SOURCES: { id: string; name: string }[] = [
  { id: "pmd", name: "Pakistan Met Department (PMD)" },
  { id: "pepa", name: "PEPA Sensor Network" },
  { id: "satellite", name: "Satellite Imagery (PEPA/SUPARCO)" },
  { id: "ogdcl", name: "OGDCL Air Quality API" },
  { id: "metar", name: "Airport METAR · Islamabad" },
  { id: "weather_api", name: "Weather API" },
  { id: "traffic_api", name: "Traffic API" },
  { id: "social", name: "Social Signal Feed" },
  { id: "firestore", name: "Firestore DB" },
  { id: "vertex", name: "Vertex AI" },
  { id: "sensor_gateway", name: "Sensor Gateway" },
  { id: "mock_pk_accidents", name: "Mock PK — Accidents" },
  { id: "mock_pk_earthquakes", name: "Mock PK — Earthquakes" },
  { id: "mock_pk_floods", name: "Mock PK — Floods" },
  { id: "mock_pk_disease", name: "Mock PK — Disease / outbreaks" },
];

async function main(): Promise<void> {
  if (!fs.existsSync(SERVICE_ACCOUNT)) {
    console.error("Missing service account file:", SERVICE_ACCOUNT);
    process.exit(1);
  }

  const raw = fs.readFileSync(SERVICE_ACCOUNT, "utf8");
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();
  const batch = db.batch();

  for (const d of DEMO_ISLAMABAD_DOSSIERS) {
    const ref = db.collection("crises").doc(d.crisis_id);
    const dossierPlain = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
    batch.set(ref, {
      crisis_id: d.crisis_id,
      status: d.status,
      severity: d.severity.score,
      dossier: dossierPlain,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  const invRef = db.doc("resources/inventory");
  batch.set(invRef, {
    items: JSON.parse(JSON.stringify(mockResources)),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  for (const src of API_HEALTH_SOURCES) {
    const ref = db.collection("apiHealth").doc(src.id);
    batch.set(ref, {
      name: src.name,
      status: "unknown",
      latency: null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(
    `Seeded ${DEMO_ISLAMABAD_DOSSIERS.length} crises, resources/inventory, ${API_HEALTH_SOURCES.length} apiHealth docs.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

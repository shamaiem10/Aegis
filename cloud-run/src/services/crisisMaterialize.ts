import { db } from "../firebase-admin";
import { sanitizeForFirestore } from "../utils/sanitizeFirestore";
import { safeFirestoreWrite } from "../utils/safeFirestore";
import {
  getMockSignalsMergedSorted,
  type FlatSignalDoc,
} from "../signals/mockCategorySignals";
import type { CrisisDossierShape } from "./crisisResourceAllocation";

const PK_MOCK_SLUGS = ["accidents", "earthquakes", "floods", "disease"] as const;
const REMOTE_CACHE_MS = 60_000;

let remoteSignalsCache: { loadedAt: number; rows: FlatSignalDoc[] } | null = null;

function crisisCategoryFromSignal(s: FlatSignalDoc): string {
  const payload = s.payload as Record<string, unknown> | undefined;
  const mc = payload?.mock_category;
  if (typeof mc === "string" && mc.trim()) return mc.trim().toLowerCase();
  const blob = `${s.kind} ${s.text}`.toLowerCase();
  if (/accident|traffic|road|collision|crash|pile/.test(blob)) return "accidents";
  if (/quake|seismic|earthquake|magnitude/.test(blob)) return "earthquakes";
  if (/flood|hydro|inundat|surge|monsoon/.test(blob)) return "floods";
  if (/disease|measles|dengue|hepatitis|outbreak|vector|health/.test(blob)) return "disease";
  return "other";
}

export function dossierFromPkMockSignal(s: FlatSignalDoc, crisisDocId: string): CrisisDossierShape {
  const cat = crisisCategoryFromSignal(s);
  const score = Math.min(10, Math.max(0, Number(s.severity_hint) || 0));
  const conf = Math.min(0.98, 0.55 + score * 0.04);
  const critical = score >= 8;
  const title =
    s.region?.trim() ?
      `${cat.replace(/_/g, " ")} · ${s.region}`
    : s.text.length > 72 ?
      `${s.text.slice(0, 69)}…`
    : s.text;

  return {
    crisis_id: crisisDocId,
    status: score >= 6 ? "active" : "monitoring",
    fused: [
      {
        id: s.id,
        summary: s.text.length > 220 ? `${s.text.slice(0, 217)}…` : s.text,
        lat: s.lat,
        lon: s.lon,
        region: s.region,
        confidence: conf,
        fused_severity_hint: score,
      },
    ],
    classification: {
      category: cat,
      confidence: conf,
      rationale: `Pakistan mock category feed (${s.source}).`,
    },
    severity: {
      score,
      factors: [`severity_hint=${score}`, `kind=${s.kind}`],
      weather_note: null,
    },
    allocation: { units: [], notes: "" },
    notifications: [],
    created_at: String(s.recorded_at),
    meta: {
      display_name: title,
      crisis_type: cat,
      ui_severity_label: critical ? "Critical" : score >= 6 ? "Elevated" : "Watch",
      pk_mock_signal_id: s.id,
      feed_source: s.source,
      materialized_from: "pk_mock_category",
    },
  };
}

export function findPkMockSignalForCrisisId(
  crisisId: string,
  signals: FlatSignalDoc[],
): FlatSignalDoc | null {
  const normalized = crisisId.trim();
  if (!normalized) return null;

  const ids = new Set<string>([normalized]);
  if (normalized.startsWith("pk-")) ids.add(normalized.slice(3));
  else ids.add(`pk-${normalized}`);

  for (const s of signals) {
    const canonical = `pk-${s.id}`;
    if (ids.has(s.id) || ids.has(canonical)) return s;
  }
  return null;
}

async function fetchRemotePkMockSignals(): Promise<FlatSignalDoc[]> {
  const base = process.env.PK_MOCK_ALERTS_URL?.trim();
  if (!base) return [];

  const now = Date.now();
  if (remoteSignalsCache && now - remoteSignalsCache.loadedAt < REMOTE_CACHE_MS) {
    return remoteSignalsCache.rows;
  }

  const merged: FlatSignalDoc[] = [];
  const seen = new Set<string>();

  for (const slug of PK_MOCK_SLUGS) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/signals/mock/${slug}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { success?: boolean; data?: FlatSignalDoc[] };
      const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      for (const row of rows) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }
    } catch {
      /* try next slug */
    }
  }

  remoteSignalsCache = { loadedAt: now, rows: merged };
  return merged;
}

export async function loadAllPkMockSignals(): Promise<FlatSignalDoc[]> {
  const byId = new Map<string, FlatSignalDoc>();
  for (const s of getMockSignalsMergedSorted()) byId.set(s.id, s);
  for (const s of await fetchRemotePkMockSignals()) byId.set(s.id, s);
  return [...byId.values()];
}

/**
 * PK mock crises are built client-side; persist to Firestore on first allocate/status write.
 */
export async function materializePkMockCrisisIfMissing(
  crisisId: string,
): Promise<{ dossier: CrisisDossierShape; raw: Record<string, unknown> } | null> {
  const signals = await loadAllPkMockSignals();
  const signal = findPkMockSignalForCrisisId(crisisId, signals);
  if (!signal) return null;

  const dossier = dossierFromPkMockSignal(signal, crisisId);
  const raw: Record<string, unknown> = {
    crisis_id: crisisId,
    status: dossier.status,
    created_at: dossier.created_at,
    dossier,
    materialized_at: new Date().toISOString(),
  };

  await safeFirestoreWrite(`crises/${crisisId}`, () =>
    db.collection("crises").doc(crisisId).set(sanitizeForFirestore(raw), { merge: true }),
  );

  return { dossier, raw };
}

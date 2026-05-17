import { useEffect, useState } from "react";
import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import type { CrisisDossierApi, ResourceUnitApi, SignalApi } from "../../src/api/types";
import type {
  AgentArtifactBundle,
  AiSeverityIndexResult,
  FalseAlarmScreenResult,
} from "../../src/api/agentTypes";
import { fetchAiSeverityIndex } from "../../src/api/agents";
import type { PakistanEnvCityKey, PakistanLiveEnvSnapshot } from "../../src/api/pakistanEnvLive";
import type { Resource } from "../../src/components/aegis/data";
import {
  fetchResourceInventory,
  listCrises,
  listSignals,
  mockLiveCrisisBundleEnabled,
  pkMockAlertsEnabled,
} from "../../src/api/client";
import type { IonName } from "../../src/utils/alertIcons";
import { filterSignalsPakistan } from "../../src/config/pakistan";
import { getFirebaseApp } from "../firebase";
export type FirestoreCrisisDoc = {
  crisis_id: string;
  status: string;
  severity: number;
  dossier: CrisisDossierApi;
};

export type ApiHealthRow = {
  id?: string;
  name: string;
  status: string;
  latency?: string | null;
};

export type AntigravityTraceRow = {
  id: string;
  agentId: string;
  action: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  confidence: number;
  timestamp: string;
  crisisId?: string;
  latencyMs?: number;
};

export type AntigravityPulseDoc = Record<string, unknown>;

export type PendingAlertRow = {
  id: string;
  crisisId: string;
  message: string;
  title: string;
  severity: number;
  status: string;
  /** Raw audience key, e.g. PUBLIC, HOSPITALS */
  audienceType: string;
  channel?: string;
  urduText?: string;
  stagingOrderIndex?: number;
  issuedAt?: string;
  language?: string;
};

function pendingAlertFromDoc(docId: string, r: Record<string, unknown>): PendingAlertRow {
  const audienceType = String(r.audienceType ?? r.audience ?? r.channel ?? "GENERAL");
  const message = String(
    r.messageText ?? r.body ?? r.message ?? r.bodyEnglish ?? r.urduText ?? "",
  ).trim();
  const title = String(r.title ?? r.subject ?? audienceLabel(audienceType)).trim();
  return {
    id: docId,
    crisisId: String(r.crisisId ?? r.crisis_id ?? ""),
    message: message || "No message body — open crisis dossier for context.",
    title,
    severity: Number(r.severity ?? r.severity_hint ?? 0),
    status: String(r.status ?? "pending_approval"),
    audienceType,
    channel: typeof r.channel === "string" ? r.channel : undefined,
    urduText: typeof r.urduText === "string" ? r.urduText : undefined,
    stagingOrderIndex:
      typeof r.stagingOrderIndex === "number" ? r.stagingOrderIndex : undefined,
    issuedAt:
      typeof r.generatedAt === "string"
        ? r.generatedAt
        : typeof r.issuedAt === "string"
          ? r.issuedAt
          : undefined,
    language: typeof r.language === "string" ? r.language : undefined,
  };
}

/** Human-readable label for StakeholderAlertAgent audience keys. */
export function audienceLabel(audienceType: string): string {
  const k = audienceType.toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    PUBLIC: "Public (Urdu SMS)",
    EMERGENCY_SERVICES: "Rescue 1122 / EMS",
    HOSPITALS: "Hospitals (PIMS, Poly Clinic)",
    UTILITY_COMPANIES: "Utilities (WASA, IESCO)",
    TRANSPORT_AUTHORITY: "Transport (NHMP, CDA)",
    MEDIA_COMMAND: "Media / ICS briefing",
    GENERAL: "Stakeholder",
  };
  return map[k] ?? audienceType.replace(/_/g, " ");
}

function logFirestoreHook(name: string, err: unknown): void {
  console.warn(`[${name}] Firestore error — staying empty (no bundled mock)`, err);
}

function freshEmptyPulse(): AntigravityPulseDoc {
  const t = new Date().toISOString();
  return {
    status: "idle",
    summary: "",
    lastAgent: "",
    confidence: 0,
    timestamp: t,
  };
}

function crisisFromDoc(d: DocumentData | undefined, docId: string): CrisisDossierApi | null {
  if (!d) return null;
  if (d.dossier && typeof d.dossier === "object" && "crisis_id" in d.dossier) {
    return d.dossier as CrisisDossierApi;
  }
  if (typeof d.crisis_id === "string" && d.classification && d.severity) {
    return d as CrisisDossierApi;
  }
  console.warn("[firestore] Unrecognized crisis doc shape", docId);
  return null;
}

function signalFromDoc(snap: QueryDocumentSnapshot): SignalApi | null {
  const r = snap.data() as Record<string, unknown>;
  if (r && typeof r === "object" && "source" in r && "text" in r && "recorded_at" in r) {
    return r as unknown as SignalApi;
  }
  const ts = r.timestamp as { toDate?: () => Date } | undefined;
  const recorded =
    typeof r.recorded_at === "string"
      ? r.recorded_at
      : ts && typeof ts.toDate === "function"
        ? ts.toDate()!.toISOString()
        : new Date().toISOString();
  return {
    id: (r.id as string) || snap.id,
    source: String(r.source ?? ""),
    kind: String(r.kind ?? r.source ?? "unknown"),
    text: String(r.text ?? ""),
    lat: Number(r.lat ?? 0),
    lon: Number(r.lon ?? 0),
    region: String(r.region ?? ""),
    severity_hint: Number(r.severity_hint ?? 0),
    recorded_at: recorded,
    payload: (r.payload as Record<string, unknown>) ?? {},
  };
}

function confidenceFromTraceOutput(output: Record<string, unknown>): number {
  const triage = output.triage as { confidencePct?: number } | undefined;
  if (typeof triage?.confidencePct === "number") return triage.confidencePct / 100;
  if (typeof output.confidence === "number") return output.confidence;
  if (typeof output.confidencePct === "number") return output.confidencePct / 100;
  return 0;
}

function traceFromDoc(snap: QueryDocumentSnapshot): AntigravityTraceRow | null {
  const r = snap.data() as Record<string, unknown>;
  if (!r) return null;
  const ts = r.timestamp as { toDate?: () => Date } | undefined;
  const timestamp =
    typeof r.timestamp === "string"
      ? r.timestamp
      : ts && typeof ts.toDate === "function"
        ? ts.toDate()!.toISOString()
        : new Date().toISOString();
  const inputs =
    (r.input as Record<string, unknown>) ??
    (r.inputs as Record<string, unknown>) ??
    {};
  const outputs =
    (r.output as Record<string, unknown>) ??
    (r.outputs as Record<string, unknown>) ??
    {};
  const agentId = String(r.agentName ?? r.agentId ?? r.agent_id ?? "unknown");
  const latencyMs = Number(r.latencyMs ?? 0);
  return {
    id: snap.id,
    agentId,
    action: String(r.action ?? r.phase ?? agentId.replace(/Agent$/, "") ?? "completed"),
    inputs,
    outputs,
    confidence: Number(r.confidence ?? confidenceFromTraceOutput(outputs) ?? 0),
    timestamp,
    crisisId: typeof r.crisisId === "string" ? r.crisisId : undefined,
    latencyMs: Number.isFinite(latencyMs) && latencyMs > 0 ? latencyMs : undefined,
  };
}

export function useCrisisStream(): {
  data: CrisisDossierApi[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<CrisisDossierApi[]>([]);
  const [loading, setLoading] = useState(true);
  /** true if Firebase unavailable or snapshot errored — not “offline demo”; data stays empty */
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    if (pkMockAlertsEnabled() || mockLiveCrisisBundleEnabled()) {
      let cancelled = false;
      const load = async () => {
        try {
          const rows = await listCrises({ limit: 120 });
          if (!cancelled) {
            setData(rows);
            setUsingFallback(false);
            setLoading(false);
          }
        } catch (e) {
          logFirestoreHook("useCrisisStream/pk-mock", e);
          if (!cancelled) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        }
      };
      setLoading(true);
      void load();
      const timer = setInterval(() => {
        void load();
      }, 60_000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }

    const app = getFirebaseApp();
    if (!app) {
      setData([]);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const q = query(
      collection(db, "crises"),
      where("status", "in", ["active", "monitoring"]),
      orderBy("severity", "desc"),
    );

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (unsubscribed) return;
          const rows: CrisisDossierApi[] = [];
          snap.forEach((docSnap) => {
            const row = crisisFromDoc(docSnap.data(), docSnap.id);
            if (row) rows.push(row);
          });
          setData(rows);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useCrisisStream", err);
          if (!unsubscribed) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useCrisisStream", err);
      setData([]);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
}

export function useSignalStream(filter?: string): {
  data: SignalApi[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<SignalApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    if (pkMockAlertsEnabled()) {
      let cancelled = false;
      const load = async () => {
        try {
          let rows = await listSignals();
          rows = filterSignalsPakistan(rows);
          const f = filter?.trim().toLowerCase();
          if (f) {
            rows = rows.filter(
              (s) =>
                s.source.toLowerCase().includes(f) ||
                s.kind.toLowerCase().includes(f) ||
                s.text.toLowerCase().includes(f),
            );
          }
          if (!cancelled) {
            setData(rows);
            setUsingFallback(false);
            setLoading(false);
          }
        } catch (err) {
          logFirestoreHook("useSignalStream/pk-mock", err);
          if (!cancelled) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        }
      };
      setLoading(true);
      void load();
      const timer = setInterval(() => {
        void load();
      }, 60_000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }

    const app = getFirebaseApp();
    if (!app) {
      setData([]);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const coll = collection(db, "signals");
    const q = query(coll, orderBy("timestamp", "desc"), limit(120));

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (unsubscribed) return;
          const rows: SignalApi[] = [];
          snap.forEach((docSnap) => {
            const row = signalFromDoc(docSnap);
            if (row) rows.push(row);
          });
          const f = filter?.trim().toLowerCase();
          const filtered = f
            ? rows.filter(
                (s) =>
                  s.source.toLowerCase().includes(f) ||
                  s.kind.toLowerCase().includes(f) ||
                  s.text.toLowerCase().includes(f),
              )
            : rows;
          setData(filtered);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useSignalStream", err);
          if (!unsubscribed) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useSignalStream", err);
      setData([]);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [filter]);

  return { data, loading, usingFallback };
}

function mapInventoryItems(items: unknown): Resource[] {
  if (!Array.isArray(items)) return [];
  return items.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      type: String(r.type ?? "Unit"),
      icon: (String(r.icon ?? "cube-outline") as IonName),
      total: Number(r.total ?? 0),
      deployed: Number(r.deployed ?? 0),
      healthImpact: r.healthImpact != null ? String(r.healthImpact) : undefined,
    };
  });
}

function mapInventoryUnits(raw: unknown): ResourceUnitApi[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const u = row as Record<string, unknown>;
    return {
      resource_id: String(u.resource_id ?? ""),
      name: String(u.name ?? "Unit"),
      kind: u.kind as ResourceUnitApi["kind"],
      agency: u.agency != null ? String(u.agency) : undefined,
      quantity_available: Number(u.quantity_available ?? 0),
      quantity_total: u.quantity_total != null ? Number(u.quantity_total) : undefined,
      lat: u.lat != null ? Number(u.lat) : undefined,
      lon: u.lon != null ? Number(u.lon) : undefined,
      tags: Array.isArray(u.tags) ? u.tags.map(String) : undefined,
      source: u.source as ResourceUnitApi["source"],
      status: u.status as ResourceUnitApi["status"],
    };
  });
}

export function useResourceInventory(): {
  data: Resource[];
  units: ResourceUnitApi[];
  region: string;
  updatedAt: string | null;
  sources: { curated: number; openstreetmap: number } | null;
  loading: boolean;
  usingFallback: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<Resource[]>([]);
  const [units, setUnits] = useState<ResourceUnitApi[]>([]);
  const [region, setRegion] = useState("islamabad_rawalpindi");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [sources, setSources] = useState<{ curated: number; openstreetmap: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    setReloadToken((n) => n + 1);
  };

  useEffect(() => {
    let unsubscribed = false;

    const applyInventory = (
      items: Resource[],
      nextUnits: ResourceUnitApi[],
      invRegion: string,
      invUpdated: string | null,
      invSources: { curated: number; openstreetmap: number } | null,
      fallback: boolean,
    ) => {
      if (unsubscribed) return;
      if (items.length) setData(items);
      if (nextUnits.length) setUnits(nextUnits);
      setRegion(invRegion);
      setUpdatedAt(invUpdated);
      setSources(invSources);
      setUsingFallback(fallback);
      setLoading(false);
    };

    const load = async () => {
      setLoading(true);
      let gotFromDeployedApi = false;
      try {
        const inv = await fetchResourceInventory(reloadToken > 0);
        if (unsubscribed) return;
        const items = mapInventoryItems(inv.items);
        const nextUnits = mapInventoryUnits(inv.units);
        gotFromDeployedApi = items.length > 0 || nextUnits.length > 0;
        if (gotFromDeployedApi) {
          applyInventory(
            items,
            nextUnits,
            inv.region ?? "islamabad_rawalpindi",
            inv.updatedAt ?? null,
            inv.sources ?? null,
            false,
          );
        }
        setError(null);
      } catch (e) {
        logFirestoreHook("useResourceInventory:deployed-api", e);
        if (!unsubscribed) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }

      if (unsubscribed || gotFromDeployedApi) {
        if (!unsubscribed && !gotFromDeployedApi) setLoading(false);
        return;
      }

      const app = getFirebaseApp();
      if (!app) {
        if (!unsubscribed) setLoading(false);
        return;
      }
      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, "resources", "inventory"));
        if (unsubscribed || !snap.exists()) return;
        const row = snap.data() as {
          items?: unknown;
          units?: unknown;
          region?: string;
          updatedAt?: string;
          sources?: { curated: number; openstreetmap: number };
        };
        const items = mapInventoryItems(row?.items);
        const nextUnits = mapInventoryUnits(row?.units);
        if (items.length || nextUnits.length) {
          applyInventory(
            items,
            nextUnits,
            row?.region ?? "islamabad_rawalpindi",
            row?.updatedAt ?? null,
            row?.sources ?? null,
            true,
          );
        }
      } catch (err) {
        logFirestoreHook("useResourceInventory:firestore-fallback", err);
      } finally {
        if (!unsubscribed && !gotFromDeployedApi) setLoading(false);
      }
    };

    void load();

    return () => {
      unsubscribed = true;
    };
  }, [reloadToken]);

  return { data, units, region, updatedAt, sources, loading, usingFallback, error, refresh };
}

export function useAiSeverityIndex(
  envIndex: PakistanLiveEnvSnapshot,
  selectedCity: PakistanEnvCityKey,
  envLoading: boolean,
): {
  data: AiSeverityIndexResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<AiSeverityIndexResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (envLoading) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAiSeverityIndex(envIndex, selectedCity);
        if (!cancelled) {
          setData(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [envIndex, selectedCity, envLoading, token]);

  return {
    data,
    loading,
    error,
    refresh: () => setToken((n) => n + 1),
  };
}

export function useAPIHealth(): {
  data: ApiHealthRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<ApiHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData([]);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const q = query(collection(db, "apiHealth"), orderBy("name"));

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (unsubscribed) return;
          const rows: ApiHealthRow[] = [];
          snap.forEach((docSnap) => {
            const r = docSnap.data() as Record<string, unknown>;
            rows.push({
              id: docSnap.id,
              name: String(r.name ?? docSnap.id),
              status: String(r.status ?? "unknown"),
              latency: (r.latency as string) ?? null,
            });
          });
          setData(rows);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useAPIHealth", err);
          if (!unsubscribed) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useAPIHealth", err);
      setData([]);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
}

export function useAntigravityTraces(): {
  data: AntigravityTraceRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<AntigravityTraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData([]);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const q = query(collection(db, "traces"), orderBy("timestamp", "desc"), limit(100));

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (unsubscribed) return;
          const rows: AntigravityTraceRow[] = [];
          snap.forEach((docSnap) => {
            const row = traceFromDoc(docSnap);
            if (row) rows.push(row);
          });
          setData(rows);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useAntigravityTraces", err);
          if (!unsubscribed) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useAntigravityTraces", err);
      setData([]);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
}

export type AgentArtifactRow = AgentArtifactBundle & { id: string };

export function useFalseAlarmQueue(): {
  data: FalseAlarmScreenResult | null;
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<FalseAlarmScreenResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(null);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const ref = doc(db, "falseAlarmQueue", "latest");

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          if (unsubscribed) return;
          setData(snap.exists() ? (snap.data() as FalseAlarmScreenResult) : null);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useFalseAlarmQueue", err);
          if (!unsubscribed) {
            setData(null);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useFalseAlarmQueue", err);
      setData(null);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
}

export function useRecentAgentArtifacts(limitCount = 12): {
  data: AgentArtifactRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<AgentArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData([]);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const q = query(collection(db, "agentArtifacts"), orderBy("updatedAt", "desc"), limit(limitCount));

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (unsubscribed) return;
          const rows: AgentArtifactRow[] = [];
          snap.forEach((docSnap) => {
            const raw = docSnap.data() as AgentArtifactBundle;
            if (!raw?.updatedAt && !raw?.triage && !raw?.contextual) return;
            rows.push({ ...raw, id: docSnap.id });
          });
          setData(rows);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useRecentAgentArtifacts", err);
          if (!unsubscribed) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useRecentAgentArtifacts", err);
      setData([]);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [limitCount]);

  return { data, loading, usingFallback };
}

export function useAntigravityPulse(): {
  data: AntigravityPulseDoc;
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<AntigravityPulseDoc>(() => freshEmptyPulse());
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(freshEmptyPulse());
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const ref = doc(db, "antigravityPulse", "latest");

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          if (unsubscribed) return;
          const pulseData = snap.exists() ? snap.data() : undefined;
          if (pulseData && Object.keys(pulseData).length > 0) {
            setData(pulseData as AntigravityPulseDoc);
          } else {
            setData(freshEmptyPulse());
          }
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useAntigravityPulse", err);
          if (!unsubscribed) {
            setData(freshEmptyPulse());
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useAntigravityPulse", err);
      setData(freshEmptyPulse());
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
}

export function usePendingAlerts(): {
  data: PendingAlertRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<PendingAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData([]);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const q = query(collection(db, "alerts"), where("status", "==", "pending_approval"));

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (unsubscribed) return;
          const rows: PendingAlertRow[] = [];
          snap.forEach((docSnap) => {
            rows.push(pendingAlertFromDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
          });
          rows.sort((a, b) => {
            const sa = a.stagingOrderIndex ?? 99;
            const sb = b.stagingOrderIndex ?? 99;
            if (sa !== sb) return sa - sb;
            return (a.issuedAt ?? "").localeCompare(b.issuedAt ?? "");
          });
          setData(rows);
          setUsingFallback(false);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("usePendingAlerts", err);
          if (!unsubscribed) {
            setData([]);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("usePendingAlerts", err);
      setData([]);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
}

export type StakeholderDraftWrite = {
  crisisId: string;
  signalId?: string;
  audienceType: string;
  title: string;
  body: string;
  urduText?: string;
  stagingOrderIndex: number;
  severity?: string;
};

/** Write pending stakeholder drafts from the device when cloud-run is unreachable on LAN. */
export async function writeStakeholderDraftsToFirestore(
  drafts: StakeholderDraftWrite[],
): Promise<string[]> {
  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase not configured — cannot save drafts from phone.");
  }
  const db = getFirestore(app);
  const now = new Date().toISOString();
  const ids: string[] = [];
  for (const d of drafts) {
    const docId = `${d.crisisId}-${d.audienceType}`;
    await setDoc(
      doc(db, "alerts", docId),
      {
        crisisId: d.crisisId,
        signalId: d.signalId,
        audienceType: d.audienceType,
        title: d.title,
        body: d.body,
        messageText: d.body,
        englishText: d.body,
        urduText: d.urduText,
        severity: d.severity ?? "Medium",
        stagingOrderIndex: d.stagingOrderIndex,
        status: "pending_approval",
        generatedAt: now,
        issuedAt: now,
        agentName: "StakeholderAlertAgent",
      },
      { merge: true },
    );
    ids.push(docId);
  }
  return ids;
}

export async function rejectStakeholderDraftInFirestore(alertId: string): Promise<void> {
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase not configured");
  const db = getFirestore(app);
  await setDoc(
    doc(db, "alerts", alertId),
    { status: "rejected", rejectedAt: new Date().toISOString() },
    { merge: true },
  );
}
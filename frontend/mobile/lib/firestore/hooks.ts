import { useEffect, useState } from "react";
import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import type { CrisisDossierApi, SignalApi } from "../../src/api/types";
import type { Resource } from "../../src/components/aegis/data";
import {
  fetchResourceInventory,
  listCrises,
  listSignals,
  mockLiveCrisisBundleEnabled,
  pkMockAlertsEnabled,
  pkResourcesRemoteBase,
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
  return {
    id: snap.id,
    agentId: String(r.agentId ?? r.agent_id ?? "unknown"),
    action: String(r.action ?? r.phase ?? ""),
    inputs: (r.inputs as Record<string, unknown>) ?? {},
    outputs: (r.outputs as Record<string, unknown>) ?? {},
    confidence: Number(r.confidence ?? 0),
    timestamp,
    crisisId: typeof r.crisisId === "string" ? r.crisisId : undefined,
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

export function useResourceInventory(): {
  data: Resource[];
  loading: boolean;
  usingFallback: boolean;
} {
  const [data, setData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    const applyItems = (items: Resource[], fallback: boolean) => {
      if (unsubscribed) return;
      setData(items);
      setUsingFallback(fallback);
      setLoading(false);
    };

    (async () => {
      try {
        const inv = await fetchResourceInventory(false);
        if (!unsubscribed && inv.items?.length) {
          applyItems(mapInventoryItems(inv.items), false);
        }
      } catch (e) {
        logFirestoreHook("useResourceInventory:api", e);
      }
    })();

    const app = getFirebaseApp();
    if (!app) {
      if (!pkResourcesRemoteBase()) {
        applyItems([], true);
      }
      return () => {
        unsubscribed = true;
      };
    }

    const db = getFirestore(app);
    const ref = doc(db, "resources", "inventory");

    try {
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          if (unsubscribed) return;
          const row = snap.exists() ? (snap.data() as { items?: unknown } | undefined) : undefined;
          const items = mapInventoryItems(row?.items);
          if (items.length) {
            applyItems(items, false);
          }
        },
        (err) => {
          logFirestoreHook("useResourceInventory", err);
        },
      );
    } catch (err) {
      logFirestoreHook("useResourceInventory", err);
      if (!data.length) applyItems([], true);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, []);

  return { data, loading, usingFallback };
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
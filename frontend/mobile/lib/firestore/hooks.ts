import { useEffect, useMemo, useState } from "react";
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
import type { AntigravityTraceStepApi } from "../../src/api/metaTypes";
import {
  agentTrace,
  apiHealth,
  crises as mockCrisesUi,
  resources as mockResources,
  signals as mockSignalsUi,
  type Crisis,
  type Resource,
  type Signal as UiSignal,
} from "../../src/components/aegis/data";
import { DEMO_ISLAMABAD_DOSSIERS } from "../../src/data/demoIslamabadCrises";
import { DEMO_ORCHESTRATION_META } from "../../src/data/demoOrchestrationMeta";
import { DEMO_ISLAMABAD_SIGNALS } from "../../src/data/demoIslamabadSignals";
import { getFirebaseApp } from "../firebase";

/** Firestore-ready crisis rows (matches `scripts/seedFirestore.ts`). */
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
  severity: number;
  status: string;
  channel?: string;
  issuedAt?: string;
};

function logFirestoreHook(name: string, err: unknown): void {
  console.warn(`[${name}] Firestore subscription error — using mock fallback`, err);
}

function fallbackCrisisDossiers(): CrisisDossierApi[] {
  return DEMO_ISLAMABAD_DOSSIERS.filter((d) => d.status === "active" || d.status === "monitoring").sort(
    (a, b) => b.severity.score - a.severity.score,
  );
}

/** Bridge UI mock signals (data.ts) → SignalApi-ish rows for list UIs. */
function signalsFromUiMock(): SignalApi[] {
  return mockSignalsUi.map((s: UiSignal) => ({
    id: s.id,
    source: s.source,
    kind: s.source,
    text: s.text,
    lat: 0,
    lon: 0,
    region: "",
    severity_hint: Math.min(10, Math.max(1, Math.round(s.urgency / 10))),
    recorded_at: new Date().toISOString(),
    payload: {
      credibility_pct: s.credibility,
      crisisId: s.crisisId,
      badge: s.badge,
      time: s.time,
    },
  }));
}

function fallbackSignals(filter?: string): SignalApi[] {
  const fromDemo = [...DEMO_ISLAMABAD_SIGNALS].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
  let base = fromDemo.length ? fromDemo : signalsFromUiMock();
  if (filter?.trim()) {
    const f = filter.trim().toLowerCase();
    base = base.filter(
      (s) =>
        s.source.toLowerCase().includes(f) ||
        s.kind.toLowerCase().includes(f) ||
        s.text.toLowerCase().includes(f),
    );
  }
  return base;
}

function fallbackResourceInventory(): Resource[] {
  return mockResources;
}

function fallbackApiHealth(): ApiHealthRow[] {
  return apiHealth.map((row) => ({ name: row.name, status: row.status, latency: row.latency }));
}

function fallbackAntigravityTraces(): AntigravityTraceRow[] {
  const fromMeta = DEMO_ORCHESTRATION_META.antigravity_trace as AntigravityTraceStepApi[] | undefined;
  if (fromMeta?.length) {
    return fromMeta.map((step, i) => ({
      id: `demo-meta-trace-${i}`,
      agentId: String(step.agent ?? "agent"),
      action: String(step.phase ?? "phase"),
      inputs: { detail: step.detail ?? "" },
      outputs: { outputs_summary: step.outputs_summary ?? "" },
      confidence: typeof step.confidence === "number" ? step.confidence : 0,
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
    }));
  }
  return agentTrace.map((t, i) => ({
    id: `demo-trace-${i}`,
    agentId: t.agent,
    action: t.output,
    inputs: { input: t.input },
    outputs: { output: t.output, reasoning: t.reasoning, tools: t.tools },
    confidence: t.confidence / 100,
    timestamp: new Date(Date.now() - i * 2000).toISOString(),
  }));
}

function fallbackAntigravityPulse(): AntigravityPulseDoc {
  const trace = DEMO_ORCHESTRATION_META.antigravity_trace as AntigravityTraceStepApi[] | undefined;
  const tail = trace?.length ? trace[trace.length - 1] : undefined;
  return {
    status: "nominal",
    summary: tail?.detail ?? "Antigravity orchestration idle (bundled demo pulse).",
    lastAgent: tail?.agent ?? "signal_ingest",
    confidence: tail?.confidence ?? 0.9,
    timestamp: new Date().toISOString(),
  };
}

function fallbackPendingAlerts(): PendingAlertRow[] {
  const rows: PendingAlertRow[] = [];
  for (const d of DEMO_ISLAMABAD_DOSSIERS) {
    if (d.status !== "active" && d.status !== "monitoring") continue;
    d.notifications.forEach((n, i) => {
      rows.push({
        id: `${d.crisis_id}-pending-${i}`,
        crisisId: d.crisis_id,
        message: `${n.title}: ${n.body}`,
        severity: d.severity.score,
        status: "pending_approval",
        channel: n.channel,
        issuedAt: d.created_at,
      });
    });
  }
  if (rows.length) return rows;
  return mockCrisesUi.slice(0, 2).map((c: Crisis, i) => ({
    id: `mock-crisis-${c.id}-${i}`,
    crisisId: c.id,
    message: `${c.type} @ ${c.location} — demo pending approval`,
    severity: c.severity,
    status: "pending_approval",
    issuedAt: new Date().toISOString(),
  }));
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
  const fallback = useMemo(() => fallbackCrisisDossiers(), []);
  const [data, setData] = useState<CrisisDossierApi[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(fallback);
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
          setData(rows.length ? rows : fallback);
          setUsingFallback(rows.length === 0);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useCrisisStream", err);
          if (!unsubscribed) {
            setData(fallback);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useCrisisStream", err);
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [fallback]);

  return { data, loading, usingFallback };
}

export function useSignalStream(filter?: string): {
  data: SignalApi[];
  loading: boolean;
  usingFallback: boolean;
} {
  const fallback = useMemo(() => fallbackSignals(filter), [filter]);
  const [data, setData] = useState<SignalApi[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const fb = fallbackSignals(filter);
    const app = getFirebaseApp();
    if (!app) {
      setData(fb);
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
          setData(filtered.length ? filtered : fb);
          setUsingFallback(filtered.length === 0);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useSignalStream", err);
          if (!unsubscribed) {
            setData(fb);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useSignalStream", err);
      setData(fb);
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

export function useResourceInventory(): {
  data: Resource[];
  loading: boolean;
  usingFallback: boolean;
} {
  const fallback = useMemo(() => fallbackResourceInventory(), []);
  const [data, setData] = useState<Resource[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const ref = doc(db, "resources", "inventory");

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        ref,
        (snap) => {
          if (unsubscribed) return;
          const row = snap.data() as { items?: Resource[] } | undefined;
          const items = row?.items;
          if (items && Array.isArray(items) && items.length) {
            setData(items);
            setUsingFallback(false);
          } else {
            setData(fallback);
            setUsingFallback(true);
          }
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useResourceInventory", err);
          if (!unsubscribed) {
            setData(fallback);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useResourceInventory", err);
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [fallback]);

  return { data, loading, usingFallback };
}

export function useAPIHealth(): {
  data: ApiHealthRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const fallback = useMemo(() => fallbackApiHealth(), []);
  const [data, setData] = useState<ApiHealthRow[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(fallback);
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
          setData(rows.length ? rows : fallback);
          setUsingFallback(rows.length === 0);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useAPIHealth", err);
          if (!unsubscribed) {
            setData(fallback);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useAPIHealth", err);
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [fallback]);

  return { data, loading, usingFallback };
}

export function useAntigravityTraces(): {
  data: AntigravityTraceRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const fallback = useMemo(() => fallbackAntigravityTraces(), []);
  const [data, setData] = useState<AntigravityTraceRow[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(fallback);
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
          setData(rows.length ? rows : fallback);
          setUsingFallback(rows.length === 0);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useAntigravityTraces", err);
          if (!unsubscribed) {
            setData(fallback);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useAntigravityTraces", err);
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [fallback]);

  return { data, loading, usingFallback };
}

export function useAntigravityPulse(): {
  data: AntigravityPulseDoc;
  loading: boolean;
  usingFallback: boolean;
} {
  const fallback = useMemo(() => fallbackAntigravityPulse(), []);
  const [data, setData] = useState<AntigravityPulseDoc>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(fallback);
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
          const pulseData = snap.data();
          if (pulseData && Object.keys(pulseData).length > 0) {
            setData(pulseData as AntigravityPulseDoc);
            setUsingFallback(false);
          } else {
            setData(fallback);
            setUsingFallback(true);
          }
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("useAntigravityPulse", err);
          if (!unsubscribed) {
            setData(fallback);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("useAntigravityPulse", err);
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [fallback]);

  return { data, loading, usingFallback };
}

export function usePendingAlerts(): {
  data: PendingAlertRow[];
  loading: boolean;
  usingFallback: boolean;
} {
  const fallback = useMemo(() => fallbackPendingAlerts(), []);
  const [data, setData] = useState<PendingAlertRow[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) {
      setData(fallback);
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
            const r = docSnap.data() as Record<string, unknown>;
            rows.push({
              id: docSnap.id,
              crisisId: String(r.crisisId ?? r.crisis_id ?? ""),
              message: String(r.message ?? r.body ?? ""),
              severity: Number(r.severity ?? 0),
              status: String(r.status ?? "pending_approval"),
              channel: typeof r.channel === "string" ? r.channel : undefined,
              issuedAt: typeof r.issuedAt === "string" ? r.issuedAt : undefined,
            });
          });
          setData(rows.length ? rows : fallback);
          setUsingFallback(rows.length === 0);
          setLoading(false);
        },
        (err) => {
          logFirestoreHook("usePendingAlerts", err);
          if (!unsubscribed) {
            setData(fallback);
            setUsingFallback(true);
            setLoading(false);
          }
        },
      );
    } catch (err) {
      logFirestoreHook("usePendingAlerts", err);
      setData(fallback);
      setUsingFallback(true);
      setLoading(false);
    }

    return () => {
      unsubscribed = true;
      unsubscribe?.();
    };
  }, [fallback]);

  return { data, loading, usingFallback };
}
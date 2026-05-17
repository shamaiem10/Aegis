import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { DEFAULT_BACKEND_PORT } from "../config/backendDefaults";
import { pkResourcesDeployedBase } from "../config/pkResources";

import {
  demoAllocateResources,
  demoGetCrisis,
  demoListCrises,
  demoPatchStatus,
  demoRunPipeline,
  demoRunScenario,
  demoSessionReset,
} from "../data/demoSession";

import { demoListSignals } from "../data/demoIslamabadSignals";

import { filterSignalsPakistan } from "../config/pakistan";

import { crisesFromPkMockSignals } from "./pkMockFeed";
import type {
  CrisisDossierApi,
  CrisisStatusApi,
  LiveCrisisMockBundleApi,
  ResourceInventoryApi,
  SignalApi,
} from "./types";

/** Default HTTP timeout for backend calls (ms). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

/** Antigravity 7-agent pipeline can take 60–120s with live Gemini. */
export const PIPELINE_REQUEST_TIMEOUT_MS = 180_000;

/** Strip HTML error pages and JSON envelopes into a short user-facing string. */
export function parseHttpErrorMessage(text: string): string {
  const t = text.trim();
  if (!t) return "Request failed.";
  if (t.startsWith("<!") || t.includes("<html")) {
    const pre = t.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1];
    if (pre) return summarizeBackendError(pre.trim());
    return "Server route not found — restart cloud-run after pulling latest code.";
  }
  try {
    const j = JSON.parse(t) as { error?: string | null; detail?: string; message?: string };
    const inner = j.error ?? j.detail ?? j.message;
    if (typeof inner === "string" && inner.trim()) return summarizeBackendError(inner.trim());
  } catch {
    /* plain text */
  }
  return summarizeBackendError(t);
}

/** Short message for UI banners; avoids multi-line errors inside tiny pills. */
export function summarizeBackendError(message: string): string {
  const m = message.trim();
  if (/PERMISSION_DENIED|Firestore API has not been used/i.test(m)) {
    return "Firestore is disabled or wrong GCP project. Set GCP_PROJECT_ID=aegis-496207 in cloud-run/.env, enable Firestore in Console, restart the server.";
  }
  if (/abort|no response|network request failed|failed to connect|timed out|network error/i.test(m)) {
    return "Phone could not reach your API. Use the same Wi‑Fi (not guest/AP-isolation), set the URL to your PC’s Wi‑Fi IPv4 from ipconfig, run the backend with --host 0.0.0.0, and open Windows Firewall for that TCP port.";
  }
  if (m.length > 180) return `${m.slice(0, 177)}…`;
  return m;
}

/**
 * 10.7.x.x and 100.64–127.x (CGNAT) often = Tailscale / VPN / virtual NIC — unreachable from a normal phone.
 */
export function connectivityHintForApiBase(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const host = new URL(normalized).hostname;
    if (host.startsWith("10.7.")) {
      return "\n\nThis IP looks like a mesh/VPN range (10.7…). Phones on normal home Wi‑Fi usually cannot reach it. On Windows run ipconfig and use Wireless LAN adapter Wi‑Fi → IPv4 (often 192.168.x.x), or install the same VPN on the phone.";
    }
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(host)) {
      return "\n\nThis 100.x.x.x address is often Tailscale. Either join Tailscale on the phone or switch the URL to your LAN Wi‑Fi IPv4.";
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function apiHostLooksLikeMeshOrVpn(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const host = new URL(normalized).hostname;
    if (host.startsWith("10.7.")) return true;
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Re-seed bundled demo dossiers (Settings). */
export function resetBundledDemoData(): void {
  demoSessionReset();
}

export const STORAGE_API_BASE = "aegis_api_base_url";
export const STORAGE_DEMO_MODE = "aegis_demo_mode";

/** Android emulator forwards host loopback via 10.0.2.2. Physical device → LAN IP / tunnel. */
export function defaultApiBase(): string {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (Platform.OS === "android") return `http://10.0.2.2:${DEFAULT_BACKEND_PORT}`;
  return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
}

/**
 * Offline demo (“bundled mock”) runs only when the user explicitly turns it ON in Settings
 * (`STORAGE_DEMO_MODE` == "1"). All other builds default to live HTTP + Firestore.
 */
export async function getDemoModeResolved(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_DEMO_MODE);
    if (stored === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Persist preference: true = bundled demo only; false = use HTTP backend URL. */
export async function saveDemoMode(useDemo: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_DEMO_MODE, useDemo ? "1" : "0");
  if (useDemo) demoSessionReset();
}

/** Cloud Run (agents). Stale Settings often still point at FastAPI :8000. */
export const CLOUD_RUN_AGENT_PORT = 8080;

function migrateStoredBaseToAgentsPort(stored: string, env?: string): string | null {
  const s = stored.replace(/\/$/, "");
  if (!s.includes(":8000")) return null;
  if (env?.includes(":8080")) return env.replace(/\/$/, "");
  return s.replace(":8000", `:${CLOUD_RUN_AGENT_PORT}`);
}

export async function getApiBase(): Promise<string> {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "");

  // .env wins over stale Settings (fixes wrong 127.0.0.1 / old LAN IP after IP change).
  if (env) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_API_BASE);
      const s = stored?.trim().replace(/\/$/, "") ?? "";
      const migrated = s ? migrateStoredBaseToAgentsPort(s, env) : null;
      const badLocal =
        Platform.OS !== "web" &&
        (s.includes("127.0.0.1") || s.includes("localhost") || s.includes("10.0.2.2"));
      if (!s || badLocal || (migrated && migrated !== s) || s !== env) {
        await AsyncStorage.setItem(STORAGE_API_BASE, env);
      }
    } catch {
      /* ignore */
    }
    return env;
  }

  try {
    const stored = await AsyncStorage.getItem(STORAGE_API_BASE);
    if (stored?.trim()) {
      const s = stored.trim().replace(/\/$/, "");
      return s;
    }
  } catch {
    /* ignore */
  }

  return defaultApiBase();
}

export async function saveApiBase(url: string): Promise<void> {
  const u = url.trim().replace(/\/$/, "");
  if (!u) await AsyncStorage.removeItem(STORAGE_API_BASE);
  else await AsyncStorage.setItem(STORAGE_API_BASE, u);
}

function parseFetchedJsonBody<T>(text: string): T {
  if (!text) return undefined as T;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "success" in parsed && "data" in parsed) {
      if (parsed.success === false) {
        throw new Error(parsed.error || "API returned success=false");
      }
      return parsed.data as T;
    }
    return parsed as T;
  } catch (e) {
    if (e instanceof Error && e.message !== "Invalid JSON from server") {
      throw e;
    }
    throw new Error("Invalid JSON from server");
  }
}

/** When set (`EXPO_PUBLIC_PK_MOCK_ALERTS_URL`), signal alert calls use deployed mock APIs (Vercel / Cloud Run). */
export function pkMockAlertsRemoteBase(): string | null {
  const e = process.env.EXPO_PUBLIC_PK_MOCK_ALERTS_URL?.trim();
  return e ? e.replace(/\/$/, "") : null;
}

/** Deployed inventory API origin (Vercel). Never cloud-run / LAN — use EXPO_PUBLIC_PK_RESOURCES_URL to override. */
export function pkResourcesRemoteBase(): string {
  return pkResourcesDeployedBase();
}

/** GET {deployed}/api/v1/resources/inventory/islamabad */
export function pkResourcesInventoryUrl(refresh = false): string {
  const q = refresh ? "?refresh=1" : "";
  return `${pkResourcesDeployedBase()}/api/v1/resources/inventory/islamabad${q}`;
}

/** Load inventory from deployed pk-resource-inventory-api (not cloud-run). */
export async function fetchResourceInventory(refresh = false): Promise<ResourceInventoryApi> {
  const url = pkResourcesInventoryUrl(refresh);
  const envelope = await fetchJsonParsed<{
    success: boolean;
    data: ResourceInventoryApi;
    error: string | null;
  }>(url, 60000);
  if (!envelope.success || !envelope.data) {
    throw new Error(envelope.error ?? "resource_inventory_failed");
  }
  return envelope.data;
}

/** True when Home / Alerts / Crises should use the four PK mock category APIs (not USGS / FastAPI live feeds). */
export function pkMockAlertsEnabled(): boolean {
  return pkMockAlertsRemoteBase() != null;
}

async function fetchJsonParsed<T>(
  url: string,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const ms = timeoutMs;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  let res: Response;
  try {
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      if ((e as Error).name === "AbortError" || String((e as { code?: unknown }).code ?? "").includes("ABORT")) {
        throw new Error(`No response after ${ms / 1000}s — check mock alerts deployment URL (${url}).`);
      }
      throw new Error(e instanceof Error ? e.message : "Request failed");
    }
  } finally {
    clearTimeout(id);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseHttpErrorMessage(text || `${res.status} ${res.statusText}`));
  }
  return parseFetchedJsonBody<T>(text);
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const base = await getApiBase();
  const ms = timeoutMs;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  let res: Response;
  try {
    try {
      res = await fetch(`${base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    } catch (e) {
      if ((e as Error).name === "AbortError" || String((e as { code?: unknown }).code ?? "").includes("ABORT")) {
        throw new Error(
          `No response after ${ms / 1000}s — check API URL, Wi‑Fi, uvicorn --host 0.0.0.0, and firewall port ${DEFAULT_BACKEND_PORT}.`,
        );
      }
      const hint =
        Platform.OS !== "web"
          ? ` Check LAN URL, same Wi‑Fi, backend --host 0.0.0.0, firewall port ${DEFAULT_BACKEND_PORT}.`
          : "";
      throw new Error(
        e instanceof Error ? `${e.message}.${hint}` : `Request failed.${hint}`,
      );
    }
  } finally {
    clearTimeout(id);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseHttpErrorMessage(text || `${res.status} ${res.statusText}`));
  }
  return parseFetchedJsonBody<T>(text);
}

/** Quick check that the phone can reach cloud-run (not just Firebase / Vercel). */
export async function probeCloudRunBase(): Promise<{
  reachable: boolean;
  base: string;
  detail: string;
}> {
  const base = await getApiBase();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { reachable: false, base, detail: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { status?: string; success?: boolean };
    if (json.success === false) {
      return { reachable: false, base, detail: "health returned success=false" };
    }
    return { reachable: true, base, detail: String(json.status ?? "ok") };
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "Timed out (8s)" : (e as Error).message;
    return { reachable: false, base, detail: msg };
  }
}

export async function fetchHealth(): Promise<{ status: string }> {
  if (await getDemoModeResolved()) return { status: "demo-offline bundle" };
  let last: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await request<{ status: string }>("/health", undefined, DEFAULT_REQUEST_TIMEOUT_MS);
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 700 + attempt * 400));
      }
    }
  }
  throw last ?? new Error("Health check failed");
}

/** When true, crises list/detail/latest read from typed mock bundle (`/api/v1/crises/mock/live`). Set `EXPO_PUBLIC_USE_MOCK_LIVE_CRISIS=1` in Expo env. */
export function mockLiveCrisisBundleEnabled(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_LIVE_CRISIS === "1";
}

let _mockLiveCrisisesCache: { rows: CrisisDossierApi[]; loadedAt: number } | null = null;
const MOCK_LIVE_CRISIS_CACHE_MS = 45_000;

function applyCrisesQueryParams(
  rows: CrisisDossierApi[],
  params?: { limit?: number; status?: string },
): CrisisDossierApi[] {
  let out = [...rows];
  if (params?.status) out = out.filter((d) => d.status === params.status);
  if (params?.limit != null) out = out.slice(0, params.limit);
  return out;
}

/** Uncached bundle fetch — use for explicit refresh tooling. */
export async function fetchLiveCrisisMockBundle(): Promise<LiveCrisisMockBundleApi> {
  return request<LiveCrisisMockBundleApi>(`/api/v1/crises/mock/live`);
}

async function getMockLiveCrisesRows(): Promise<CrisisDossierApi[]> {
  const now = Date.now();
  if (_mockLiveCrisisesCache && now - _mockLiveCrisisesCache.loadedAt < MOCK_LIVE_CRISIS_CACHE_MS) {
    return _mockLiveCrisisesCache.rows;
  }
  try {
    const bundle = await fetchLiveCrisisMockBundle();
    const rows = Array.isArray(bundle?.crises) ? bundle.crises : [];
    _mockLiveCrisisesCache = { rows, loadedAt: now };
    return rows;
  } catch {
    _mockLiveCrisisesCache = null;
    return demoListCrises({});
  }
}

/** Merge all four deployed category endpoints (accidents, earthquakes, floods, disease). */
export async function listPkMockCategorySignalsMerged(): Promise<SignalApi[]> {
  const batches = await Promise.all(
    MOCK_ALERT_CATEGORY_SLUGS.map((slug) => fetchMockCategorySignals(slug)),
  );
  const seen = new Set<string>();
  const merged: SignalApi[] = [];
  for (const batch of batches) {
    for (const s of batch) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
  }
  merged.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  return merged;
}

export async function listCrises(params?: {
  limit?: number;
  status?: string;
}): Promise<CrisisDossierApi[]> {
  if (await getDemoModeResolved()) return demoListCrises(params);
  if (pkMockAlertsEnabled()) {
    try {
      const signals = await listPkMockCategorySignalsMerged();
      return applyCrisesQueryParams(crisesFromPkMockSignals(signals), params);
    } catch {
      return [];
    }
  }
  if (mockLiveCrisisBundleEnabled()) {
    try {
      const rows = await getMockLiveCrisesRows();
      return applyCrisesQueryParams(rows, params);
    } catch {
      return demoListCrises(params);
    }
  }
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return request(`/api/v1/crises${qs ? `?${qs}` : ""}`);
}

/** Deployable Pakistan mock-feed slugs. */
export const MOCK_ALERT_CATEGORY_SLUGS = ["accidents", "earthquakes", "floods", "disease"] as const;
export type MockAlertCategorySlug = (typeof MOCK_ALERT_CATEGORY_SLUGS)[number];

/** Dedicated routes (four separate APIs) — map each to its own deployed service URL if desired. */
export const MOCK_CATEGORY_STANDALONE_API_PATHS: Record<MockAlertCategorySlug, string> = {
  accidents: "/api/v1/signals/mock/accidents",
  earthquakes: "/api/v1/signals/mock/earthquakes",
  floods: "/api/v1/signals/mock/floods",
  disease: "/api/v1/signals/mock/disease",
};

/** Normalize aliases (e.g. `disease-spreads`, `flood`) to a canonical slug for the standalone routes. */
export function canonicalMockPkCategorySlug(raw: string): MockAlertCategorySlug | null {
  let s = raw.trim().toLowerCase().replace(/-/g, "_");
  if (["disease_spreads", "diseasespreads", "disease_spread", "health"].includes(s)) s = "disease";
  if (["quake", "seismic", "earthquake"].includes(s)) s = "earthquakes";
  if (["crash", "road"].includes(s)) s = "accidents";
  if (["flood", "floods", "inundation"].includes(s)) s = "floods";
  if (s === "accidents" || s === "earthquakes" || s === "floods" || s === "disease") return s;
  return null;
}

/**
 * Pakistan mock alerts — four category APIs when `EXPO_PUBLIC_PK_MOCK_ALERTS_URL` is set;
 * otherwise FastAPI `/signals/live/parsed` (may include USGS / GDACS).
 */
export async function listSignals(): Promise<SignalApi[]> {
  if (await getDemoModeResolved()) return filterSignalsPakistan(demoListSignals());
  if (pkMockAlertsEnabled()) {
    try {
      return await listPkMockCategorySignalsMerged();
    } catch {
      return [];
    }
  }
  const all = await request<SignalApi[]>(`/api/v1/signals/live/parsed`);
  const arr = Array.isArray(all) ? all : [];
  return filterSignalsPakistan(arr);
}

/** One category — uses dedicated `/signals/mock/{accidents|earthquakes|floods|disease}` when slug is canonical. */
export async function fetchMockCategorySignals(slug: string): Promise<SignalApi[]> {
  if (await getDemoModeResolved()) return filterSignalsPakistan(demoListSignals());
  const trimmed = slug.trim().toLowerCase();
  const canonical = canonicalMockPkCategorySlug(trimmed);
  const path = canonical
    ? MOCK_CATEGORY_STANDALONE_API_PATHS[canonical]
    : `/api/v1/signals/mock/category/${encodeURIComponent(trimmed)}`;
  const pkMock = pkMockAlertsRemoteBase();
  if (pkMock) {
    const rows = await fetchJsonParsed<SignalApi[]>(`${pkMock}${path}`);
    return filterSignalsPakistan(Array.isArray(rows) ? rows : []);
  }
  const rows = await request<SignalApi[]>(path);
  return filterSignalsPakistan(Array.isArray(rows) ? rows : []);
}

export async function getCrisis(id: string): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    const d = demoGetCrisis(id);
    if (!d) throw new Error(`demo: dossier not found (${id})`);
    return d;
  }
  if (pkMockAlertsEnabled()) {
    const rows = await listCrises({ limit: 200 });
    const hit = rows.find(
      (c) =>
        c.crisis_id === id ||
        c.crisis_id === `pk-${id}` ||
        c.meta?.pk_mock_signal_id === id,
    );
    if (hit) return hit;
    throw new Error(`pk-mock: dossier not found (${id})`);
  }
  if (mockLiveCrisisBundleEnabled()) {
    try {
      const rows = await getMockLiveCrisesRows();
      const hit = rows.find((c) => c.crisis_id === id);
      if (hit) return hit;
    } catch {
      /* fall through */
    }
    const d = demoGetCrisis(id);
    if (d) return d;
    throw new Error(`mock-live: dossier not found (${id}); check bundle IDs or bundled demo dossiers`);
  }
  return request(`/api/v1/crises/${encodeURIComponent(id)}`);
}

export async function fetchLatestDossier(): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    const rows = demoListCrises({ limit: 1 });
    if (rows.length > 0) return rows[0];
    return demoRunPipeline();
  }
  if (pkMockAlertsEnabled()) {
    const rows = await listCrises({ limit: 30 });
    if (rows.length > 0) {
      const sorted = [...rows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return sorted[0]!;
    }
    throw new Error("pk-mock: no crisis dossiers from category APIs");
  }
  if (mockLiveCrisisBundleEnabled()) {
    try {
      const rows = await getMockLiveCrisesRows();
      if (rows.length > 0) {
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        return sorted[0]!;
      }
    } catch {
      /* fallback below */
    }
    const fb = demoListCrises({ limit: 1 });
    if (fb.length > 0) return fb[0]!;
  }
  return request<CrisisDossierApi>("/api/v1/pipeline/latest");
}

export async function runScenarioPipeline(body?: {
  scenario_id?: string;
  merge_live_signals?: boolean;
  include_weather?: boolean;
  use_llm_classifier?: boolean;
  include_enrichment_signals?: boolean;
  use_signal_cache?: boolean;
  use_discrete_resource_optimizer?: boolean;
  fast?: boolean;
  skip_cache?: boolean;
}): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    await new Promise((r) => setTimeout(r, 400));
    return demoRunScenario();
  }
  return request<CrisisDossierApi>(
    "/api/v1/pipeline/run/scenario",
    {
      method: "POST",
      body: JSON.stringify({
        scenario_id: "g10_flood_heat",
        merge_live_signals: true,
        fast: body?.fast !== false,
        ...body,
      }),
    },
    PIPELINE_REQUEST_TIMEOUT_MS,
  );
}

export async function runPipeline(body?: {
  include_weather?: boolean;
  use_llm_classifier?: boolean;
  include_supplemental_mock_signals?: boolean;
  supplemental_only?: boolean;
  force_multi_incident?: boolean;
  use_signal_cache?: boolean;
  include_enrichment_signals?: boolean;
  use_discrete_resource_optimizer?: boolean;
  /** Cloud Run: 2 Gemini calls (~30–60s) vs 5–7 (~2–3 min). Default true unless fast:false. */
  fast?: boolean;
  skip_cache?: boolean;
}): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    await new Promise((r) => setTimeout(r, 350));
    return demoRunPipeline();
  }
  return request(
    "/api/v1/pipeline/run",
    {
      method: "POST",
      body: JSON.stringify({
        include_weather: true,
        use_llm_classifier: false,
        use_signal_cache: true,
        include_enrichment_signals: false,
        use_discrete_resource_optimizer: true,
        fast: body?.fast !== false,
        skip_cache: body?.skip_cache === true,
        ...body,
      }),
    },
    PIPELINE_REQUEST_TIMEOUT_MS,
  );
}

export async function listAgentTraces(limit = 40): Promise<
  {
    id: string;
    agentId: string;
    action: string;
    timestamp: string;
    confidence: number;
  }[]
> {
  if (await getDemoModeResolved()) return [];
  return request(`/api/v1/traces?limit=${limit}`);
}

export type ResourceAssignmentApi = {
  resource_id: string;
  quantity: number;
};

export function formatAllocationError(message: string): string {
  const m = message.trim();
  if (m === "crisis_not_found" || m === "not_found") {
    return "Crisis record missing on server — reload the crisis list and try again.";
  }
  if (m.startsWith("insufficient:")) {
    const parts = m.split(":");
    const avail = parts[2] ?? "?";
    const need = parts[3] ?? "?";
    return `Not enough units in pool (${avail} available, requested ${need}).`;
  }
  if (m.startsWith("unknown_resource:")) {
    return "That resource is not in the inventory.";
  }
  return summarizeBackendError(m);
}

export async function allocateCrisisResources(
  crisisId: string,
  assignments: ResourceAssignmentApi[],
): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    return demoAllocateResources(crisisId, assignments);
  }
  return request(`/api/v1/crises/${encodeURIComponent(crisisId)}/allocate`, {
    method: "POST",
    body: JSON.stringify({ assignments }),
  });
}

export async function patchCrisisStatus(
  id: string,
  status: CrisisStatusApi,
): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) return demoPatchStatus(id, status);
  return request(`/api/v1/crises/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/** Metro / RN global; not re-exported from `react-native` typings. */
declare const __DEV__: boolean;

import { DEFAULT_BACKEND_PORT } from "../config/backendDefaults";

import {
  demoGetCrisis,
  demoListCrises,
  demoPatchStatus,
  demoRunPipeline,
  demoRunScenario,
  demoSessionReset,
} from "../data/demoSession";

import { demoListSignals } from "../data/demoIslamabadSignals";

import { filterSignalsPakistan } from "../config/pakistan";

import type { CrisisDossierApi, CrisisStatusApi, SignalApi } from "./types";

/** Default HTTP timeout for backend calls (ms). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

/** Short message for UI banners; avoids multi-line errors inside tiny pills. */
export function summarizeBackendError(message: string): string {
  const m = message.trim();
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
 * When unset in storage:
 * - Release builds: default to offline demo (APK works without a server).
 * - Dev (Expo Go / dev client): default to live API so you are not stuck on mock data;
 *   set backend URL in Settings if the default host is wrong for your device.
 * - Any build with EXPO_PUBLIC_API_URL set: default live.
 */
export async function getDemoModeResolved(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_DEMO_MODE);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* ignore */
  }
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) return false;
  if (__DEV__) return false;
  return true;
}

/** Persist preference: true = bundled demo only; false = use HTTP backend URL. */
export async function saveDemoMode(useDemo: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_DEMO_MODE, useDemo ? "1" : "0");
  if (useDemo) demoSessionReset();
}

export async function getApiBase(): Promise<string> {
  const env = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  
  try {
    const stored = await AsyncStorage.getItem(STORAGE_API_BASE);
    if (stored?.trim()) return stored.trim().replace(/\/$/, "");
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

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const base = await getApiBase();
  let res: Response;
  const ms = timeoutMs;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
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
          ? " Check LAN URL, same Wi‑Fi, backend --host 0.0.0.0, firewall port 8000."
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
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON from server");
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

export async function listCrises(params?: {
  limit?: number;
  status?: string;
}): Promise<CrisisDossierApi[]> {
  if (await getDemoModeResolved()) return demoListCrises(params);
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return request(`/api/v1/crises${qs ? `?${qs}` : ""}`);
}

/** Live parsed signals, restricted to the Pakistan AOI (client-side filter). */
export async function listSignals(): Promise<SignalApi[]> {
  if (await getDemoModeResolved()) return filterSignalsPakistan(demoListSignals());
  const all = await request<SignalApi[]>(`/api/v1/signals/live/parsed`);
  return filterSignalsPakistan(Array.isArray(all) ? all : []);
}

export async function getCrisis(id: string): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    const d = demoGetCrisis(id);
    if (!d) throw new Error(`demo: dossier not found (${id})`);
    return d;
  }
  return request(`/api/v1/crises/${encodeURIComponent(id)}`);
}

export async function fetchLatestDossier(): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    const rows = demoListCrises({ limit: 1 });
    if (rows.length > 0) return rows[0];
    return demoRunPipeline();
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
}): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    await new Promise((r) => setTimeout(r, 400));
    return demoRunScenario();
  }
  return request<CrisisDossierApi>("/api/v1/pipeline/run/scenario", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
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
}): Promise<CrisisDossierApi> {
  if (await getDemoModeResolved()) {
    await new Promise((r) => setTimeout(r, 350));
    return demoRunPipeline();
  }
  return request("/api/v1/pipeline/run", {
    method: "POST",
    body: JSON.stringify(
      body ?? {
        include_weather: true,
        use_llm_classifier: false,
        use_signal_cache: true,
        include_enrichment_signals: true,
        use_discrete_resource_optimizer: true,
      },
    ),
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

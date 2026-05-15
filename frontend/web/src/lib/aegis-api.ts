import type { CrisisDossierApi, PipelineRunBody } from "./aegis-types";

export const STORAGE_API_BASE = "aegis_api_base_url";

export function getConfiguredApiBase(): string {
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem(STORAGE_API_BASE);
    if (ls?.trim()) return ls.trim().replace(/\/$/, "");
  }
  const env = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL?.trim() : "";
  if (env) return env.replace(/\/$/, "");
  return "";
}

export function setConfiguredApiBase(url: string) {
  const u = url.trim().replace(/\/$/, "");
  if (typeof window === "undefined") return;
  if (!u) window.localStorage.removeItem(STORAGE_API_BASE);
  else window.localStorage.setItem(STORAGE_API_BASE, u);
}

export class AegisApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "AegisApiError";
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getConfiguredApiBase();
  if (!base) {
    throw new Error("NO_API_BASE");
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new AegisApiError(res.statusText || "Request failed", res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  return apiFetch("/health");
}

export async function listCrises(params?: {
  limit?: number;
  status?: string;
}): Promise<CrisisDossierApi[]> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetch(`/api/v1/crises${qs ? `?${qs}` : ""}`);
}

export async function getCrisis(id: string): Promise<CrisisDossierApi> {
  return apiFetch(`/api/v1/crises/${encodeURIComponent(id)}`);
}

export async function runPipeline(body?: PipelineRunBody): Promise<CrisisDossierApi> {
  return apiFetch("/api/v1/pipeline/run", {
    method: "POST",
    body: JSON.stringify(body ?? { include_weather: true, use_llm_classifier: false }),
  });
}

export async function patchCrisisStatus(id: string, status: CrisisDossierApi["status"]): Promise<CrisisDossierApi> {
  return apiFetch(`/api/v1/crises/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function fetchMockSignals(): Promise<unknown[]> {
  return apiFetch("/api/v1/signals/mock");
}

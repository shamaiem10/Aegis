import "../firebase-admin";

import { mergeApiHealthDoc, mergeSignalDoc, fetchWithTimeout } from "./persist";

const API_HEALTH_ID = "here-maps";

export type TrafficIncident = {
  id: string;
  source: string;
  sourceType: string;
  credibility: number;
  type?: string;
  severity?: string | number;
  description?: string;
  location?: unknown;
  startTime?: string;
  timestamp: string;
};

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return undefined;
}

export async function getHereTrafficIncidents(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<TrafficIncident[]> {
  const empty: TrafficIncident[] = [];
  const key = process.env.HERE_API_KEY?.trim();
  const t0 = Date.now();
  if (!key) {
    await mergeApiHealthDoc(API_HEALTH_ID, {
      id: API_HEALTH_ID,
      label: "HERE Traffic",
      status: "degraded",
      lastSuccess: false,
      error: "missing_HERE_API_KEY",
      latencyMs: Date.now() - t0,
    });
    return empty;
  }

  const la = Number.isFinite(lat) ? lat : 33.6844;
  const ln = Number.isFinite(lng) ? lng : 73.0479;
  const r = Math.max(1, radiusM);
  const url =
    `https://data.traffic.hereapi.com/v7/incidents` +
    `?locationReferencing=shape` +
    `&in=circle:${la},${ln};r=${r}` +
    `&apikey=${encodeURIComponent(key)}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`here ${res.status}`);
    }
    const body = (await res.json()) as Record<string, unknown>;
    const items: Record<string, unknown>[] = Array.isArray(body.results)
      ? (body.results as Record<string, unknown>[])
      : Array.isArray(body.incidents)
        ? (body.incidents as Record<string, unknown>[])
        : [];

    const incidents: TrafficIncident[] = [];
    const now = new Date().toISOString();

    for (const row of items) {
      const id = String(pick(row, "incidentId", "id", "incident_id") ?? "");
      if (!id) continue;

      const incident: TrafficIncident = {
        id,
        source: "here",
        sourceType: "traffic",
        credibility: 91,
        type: pick(row, "type", "incidentType", "_criticality") as string | undefined,
        severity: pick(row, "severity", "criticality", "magnitude") as string | number | undefined,
        description: pick(row, "description", "message", "summary") as string | undefined,
        location: pick(row, "location", "geometry", "geo", "shape"),
        startTime: pick(row, "startTime", "start_time", "creationTime") as string | undefined,
        timestamp: now,
      };

      incidents.push(incident);
      await mergeSignalDoc(id, {
        kind: "traffic_incident",
        source: "here",
        sourceId: API_HEALTH_ID,
        credibility: 91,
        payload: incident,
        recordedAt: now,
      });
    }

    await mergeApiHealthDoc(API_HEALTH_ID, {
      id: API_HEALTH_ID,
      label: "HERE Traffic",
      status: "live",
      lastSuccess: true,
      error: null,
      latencyMs: Date.now() - t0,
    });

    return incidents;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await mergeApiHealthDoc(API_HEALTH_ID, {
      id: API_HEALTH_ID,
      label: "HERE Traffic",
      status: "degraded",
      lastSuccess: false,
      error: msg,
      latencyMs: Date.now() - t0,
    });
    return empty;
  }
}

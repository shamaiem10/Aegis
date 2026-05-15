import "../firebase-admin";

import { db } from "../firebase-admin";

import { mergeApiHealthDoc, mergeSignalDoc, fetchWithTimeout } from "./persist";

const AQ_DOC = "aq-latest";

export type AirQualityResult = {
  pm25?: number;
  aqi?: number;
  source: string;
  raw?: unknown;
};

const MOCK_FALLBACK: AirQualityResult = { pm25: 45, aqi: 128, source: "mock" };

/** US EPA AQI from PM2.5 (µg/m³), piecewise linear breakpoints. */
export function calculateAQI(pm25: number): number {
  const c = Math.max(0, pm25);
  const segments: { clo: number; chi: number; ilo: number; ihi: number }[] = [
    { clo: 0, chi: 12.0, ilo: 0, ihi: 50 },
    { clo: 12.1, chi: 35.4, ilo: 51, ihi: 100 },
    { clo: 35.5, chi: 55.4, ilo: 101, ihi: 150 },
    { clo: 55.5, chi: 150.4, ilo: 151, ihi: 200 },
    { clo: 150.5, chi: 250.4, ilo: 201, ihi: 300 },
    { clo: 250.5, chi: 350.4, ilo: 301, ihi: 400 },
    { clo: 350.5, chi: 500.4, ilo: 401, ihi: 500 },
  ];
  for (const s of segments) {
    if (c >= s.clo && c <= s.chi) {
      return Math.round(((s.ihi - s.ilo) / (s.chi - s.clo)) * (c - s.clo) + s.ilo);
    }
  }
  if (c > 500.4) return 500;
  return 500;
}

async function writeAqAndRecord(
  result: AirQualityResult,
  raw: unknown,
  healthId: string,
  label: string,
): Promise<AirQualityResult> {
  const out: AirQualityResult = {
    ...result,
    raw,
  };
  if (out.pm25 != null && out.aqi == null) {
    out.aqi = calculateAQI(out.pm25);
  }
  await mergeSignalDoc(AQ_DOC, {
    kind: "air_quality",
    source: out.source,
    sourceId: healthId,
    credibility: out.source === "mock" ? 30 : 88,
    payload: out,
    recordedAt: new Date().toISOString(),
  });
  await mergeApiHealthDoc(healthId, {
    id: healthId,
    label,
    status: "live",
    lastSuccess: true,
    error: null,
  });
  return out;
}

async function markDegraded(healthId: string, label: string, err: unknown): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  await mergeApiHealthDoc(healthId, {
    id: healthId,
    label,
    status: "degraded",
    lastSuccess: false,
    error: msg,
  });
}

async function tryOpenaq(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<AirQualityResult | null> {
  const key = process.env.OPENAQ_API_KEY?.trim();
  if (!key) return null;
  const url = `https://api.openaq.org/v3/measurements?coordinates=${lat},${lng}&radius=${radiusM}&parameters=pm25,pm10,no2,so2,o3&limit=20&sort=desc`;
  try {
    const res = await fetchWithTimeout(url, { headers: { "X-API-Key": key } });
    if (!res.ok) throw new Error(`openaq ${res.status}`);
    const body = (await res.json()) as { results?: { value: number; parameter?: string }[] };
    const pm25Row = body.results?.find((r) => (r.parameter ?? "").toLowerCase().includes("pm25"));
    const val = pm25Row?.value;
    if (val == null || Number.isNaN(val)) {
      await markDegraded("openaq", "OpenAQ", new Error("no_pm25_in_results"));
      return null;
    }
    return { pm25: val, source: "openaq" };
  } catch (e) {
    await markDegraded("openaq", "OpenAQ", e);
    return null;
  }
}

async function tryIqair(lat: number, lng: number): Promise<AirQualityResult | null> {
  const key = process.env.IQAIR_API_KEY?.trim();
  if (!key) return null;
  const url = `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lng}&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`iqair ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        current?: {
          pollution?: {
            aqius?: number;
            aqicn?: number;
            p2?: { conc?: number };
          };
        };
      };
    };
    const pol = body.data?.current?.pollution;
    const pmFromApi = pol?.p2?.conc;
    const aqius = pol?.aqius;
    let pm25: number | undefined = pmFromApi;
    let aqi: number | undefined = aqius;
    if (pm25 == null && aqius != null) {
      aqi = aqius;
      pm25 = undefined;
    }
    if (pm25 == null && aqius == null) return null;
    return {
      pm25: pm25 ?? (aqi != null ? aqi * 0.45 : undefined),
      aqi: aqi ?? (pm25 != null ? calculateAQI(pm25) : undefined),
      source: "iqair",
    };
  } catch (e) {
    await markDegraded("iqair", "IQAir", e);
    return null;
  }
}

async function tryOpenMeteoDustPm(lat: number, lng: number): Promise<AirQualityResult | null> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=dust&forecast_days=1`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`open-meteo-aq ${res.status}`);
    const body = (await res.json()) as { hourly?: { dust?: (number | null)[] } };
    const series = body.hourly?.dust?.filter((v): v is number => v != null && !Number.isNaN(v)) ?? [];
    const dust = series[0];
    if (dust == null) return null;
    const pm25 = dust * 0.44;
    return { pm25, aqi: calculateAQI(pm25), source: "open-meteo-dust" };
  } catch (e) {
    await markDegraded("open-meteo-aq", "Open-Meteo (AQ)", e);
    return null;
  }
}

async function readFirestoreAqFallback(): Promise<AirQualityResult | null> {
  try {
    const snap = await db.collection("signals").doc(AQ_DOC).get();
    if (!snap.exists) return null;
    const p = snap.data()?.payload as AirQualityResult | undefined;
    if (p?.pm25 != null || p?.aqi != null) {
      return { ...p, source: p.source ?? "firestore-cache" };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function getAirQualityWithFallback(
  location: { lat: number; lng: number },
  radiusM: number,
): Promise<AirQualityResult> {
  const lat = Number.isFinite(location.lat) ? location.lat : 33.6844;
  const lng = Number.isFinite(location.lng) ? location.lng : 73.0479;
  const r = Math.max(1, radiusM);

  try {
    const oq = await tryOpenaq(lat, lng, r);
    if (oq) {
      return writeAqAndRecord(oq, null, "openaq", "OpenAQ");
    }

    const iq = await tryIqair(lat, lng);
    if (iq) {
      return writeAqAndRecord(iq, null, "iqair", "IQAir");
    }

    const om = await tryOpenMeteoDustPm(lat, lng);
    if (om) {
      return writeAqAndRecord(om, null, "open-meteo", "Open-Meteo (dust estimate)");
    }

    const cached = await readFirestoreAqFallback();
    if (cached) {
      await mergeSignalDoc(AQ_DOC, {
        kind: "air_quality",
        source: cached.source ?? "firestore-cache",
        sourceId: "aq-firestore-cache",
        credibility: 40,
        payload: cached,
        recordedAt: new Date().toISOString(),
      });
      await mergeApiHealthDoc("aq-firestore-cache", {
        id: "aq-firestore-cache",
        label: "AQ Firestore cache",
        status: "degraded",
        lastSuccess: true,
        error: "read_stale_cache_fallback",
      });
      return { ...cached };
    }

    await mergeApiHealthDoc("air-quality", {
      id: "air-quality",
      label: "Air quality aggregate",
      status: "degraded",
      lastSuccess: false,
      error: "all_sources_failed_mock",
    });
    await mergeSignalDoc(AQ_DOC, {
      kind: "air_quality",
      source: "mock",
      payload: MOCK_FALLBACK,
      recordedAt: new Date().toISOString(),
    });
    return { ...MOCK_FALLBACK };
  } catch {
    await mergeApiHealthDoc("air-quality", {
      id: "air-quality",
      label: "Air quality aggregate",
      status: "degraded",
      lastSuccess: false,
      error: "unexpected_chain_error",
    });
    await mergeSignalDoc(AQ_DOC, {
      kind: "air_quality",
      source: "mock",
      payload: MOCK_FALLBACK,
      recordedAt: new Date().toISOString(),
    });
    return { ...MOCK_FALLBACK };
  }
}

/**
 * Live Pakistan environmental risk — Open-Meteo (air + heat) and GDACS (global flood alerts).
 * Independent of Vercel mock category APIs.
 */

import { isLatLonInPakistan, PAKISTAN_TIMEZONE } from "../config/pakistan";
import { aqiToRiskBarPercent, calculateAQIFromPm25, getAQILabel } from "../utils/aqi";
import type { EnvIndexAgg } from "../utils/homeDashboard";

const FETCH_MS = 18_000;
const GDACS_RSS = "https://www.gdacs.org/xml/rss.xml";
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";

export type PakistanEnvCity = {
  name: string;
  lat: number;
  lon: number;
};

/** Representative cities for environmental snapshot. */
export const PAKISTAN_ENV_CITIES: readonly PakistanEnvCity[] = [
  { name: "Islamabad", lat: 33.6844, lon: 73.0479 },
  { name: "Karachi", lat: 24.8607, lon: 67.0011 },
  { name: "Lahore", lat: 31.5497, lon: 74.3436 },
  { name: "Peshawar", lat: 34.0151, lon: 71.5249 },
  { name: "Quetta", lat: 30.1798, lon: 66.975 },
] as const;

export type PakistanEnvCityKey = "all" | (typeof PAKISTAN_ENV_CITIES)[number]["name"];

export const PAKISTAN_ENV_CITY_OPTIONS: { key: PakistanEnvCityKey; label: string }[] = [
  { key: "all", label: "All Pakistan" },
  ...PAKISTAN_ENV_CITIES.map((c) => ({ key: c.name as PakistanEnvCityKey, label: c.name })),
];

export type PakistanLiveEnvSnapshot = EnvIndexAgg & {
  pakistanAqi: number | null;
  selectedCity: PakistanEnvCityKey;
};

export const EMPTY_LIVE_ENV_INDEX: PakistanLiveEnvSnapshot = {
  heat: { value: 0, sub: "Open-Meteo weather feed unavailable." },
  air: { value: 0, sub: "Open-Meteo air-quality feed unavailable." },
  flood: { value: 0, sub: "GDACS global flood feed unavailable." },
  hasAny: false,
  pakistanAqi: null,
  selectedCity: "all",
};

function citiesForKey(key: PakistanEnvCityKey): PakistanEnvCity[] {
  if (key === "all") return [...PAKISTAN_ENV_CITIES];
  const hit = PAKISTAN_ENV_CITIES.find((c) => c.name === key);
  return hit ? [hit] : [...PAKISTAN_ENV_CITIES];
}

/** Pick nearest env city when GPS is inside Pakistan. */
export function nearestPakistanEnvCity(lat: number, lon: number): PakistanEnvCityKey {
  if (!isLatLonInPakistan(lat, lon)) return "all";
  let best = PAKISTAN_ENV_CITIES[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of PAKISTAN_ENV_CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
  } finally {
    clearTimeout(id);
  }
}

type OpenMeteoCurrent = {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  apparent_temperature?: number;
  precipitation?: number;
};

type OpenMeteoForecastJson = {
  current?: OpenMeteoCurrent;
  hourly?: { precipitation?: (number | null)[] };
};

type OpenMeteoAqJson = {
  current?: { pm2_5?: number };
};

async function openMeteoForecast(lat: number, lon: number): Promise<OpenMeteoForecastJson> {
  const u = new URL(OPEN_METEO_FORECAST);
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("timezone", PAKISTAN_TIMEZONE);
  u.searchParams.set("forecast_days", "2");
  u.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation",
  );
  u.searchParams.set("hourly", "precipitation");
  return fetchJson(u.toString());
}

async function openMeteoAirQuality(lat: number, lon: number): Promise<number | null> {
  const u = new URL(OPEN_METEO_AQ);
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("timezone", PAKISTAN_TIMEZONE);
  u.searchParams.set("current", "pm2_5");
  const j = await fetchJson<OpenMeteoAqJson>(u.toString());
  const pm = j.current?.pm2_5;
  return typeof pm === "number" && Number.isFinite(pm) ? pm : null;
}

function heatStressPercent(apparentC: number, humidity: number): number {
  const t = apparentC;
  const h = humidity;
  let base: number;
  if (t <= 28) base = Math.max(0, Math.round((t - 18) * 2.5));
  else if (t <= 38) base = Math.round(25 + (t - 28) * 5.5);
  else base = Math.min(95, Math.round(80 + (t - 38) * 4));
  const humidBoost = h >= 70 ? Math.min(12, Math.round((h - 70) * 0.4)) : 0;
  return Math.min(100, base + humidBoost);
}

function maxHourlyPrecipMm(hourly?: (number | null)[]): number {
  if (!hourly?.length) return 0;
  let m = 0;
  for (const v of hourly.slice(0, 48)) {
    if (typeof v === "number" && Number.isFinite(v) && v > m) m = v;
  }
  return m;
}

function precipFloodPercent(maxMm: number): number {
  if (maxMm <= 0.5) return 0;
  if (maxMm <= 3) return Math.round(15 + maxMm * 8);
  if (maxMm <= 10) return Math.round(35 + maxMm * 4);
  if (maxMm <= 25) return Math.round(55 + maxMm * 1.2);
  return Math.min(100, Math.round(72 + maxMm * 0.8));
}

function gdacsAlertScore(level: string): number {
  const l = level.trim().toLowerCase();
  if (l === "red") return 92;
  if (l === "orange") return 62;
  if (l === "green") return 18;
  return 28;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseGdacsFloodPercent(xml: string, near?: PakistanEnvCity): number {
  let max = 0;
  const radiusKm = near ? 220 : 0;
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const blob = block.slice(0, 4000);
    const isFlood =
      /\bFL\b/i.test(blob) ||
      /eventtype[^>]*>\s*FL/i.test(blob) ||
      /flood/i.test(blob);
    if (!isFlood) continue;

    const pt =
      blob.match(/(?:georss:)?Point[^>]*>\s*([-\d.]+)\s+([-\d.]+)/i) ??
      blob.match(/<Point>\s*([-\d.]+)\s+([-\d.]+)/i);
    let lat = 0;
    let lon = 0;
    let hasPoint = false;
    if (pt) {
      lat = Number(pt[1]);
      lon = Number(pt[2]);
      hasPoint = Number.isFinite(lat) && Number.isFinite(lon);
    }

    const inPk =
      /pakistan/i.test(blob) || (hasPoint && isLatLonInPakistan(lat, lon));
    if (!inPk) continue;

    if (near && hasPoint) {
      const d = haversineKm(near.lat, near.lon, lat, lon);
      if (d > radiusKm) continue;
    } else if (near && !/pakistan/i.test(blob)) {
      continue;
    }

    const level =
      blob.match(/alertlevel[^>]*>\s*([^<]+)/i)?.[1] ??
      blob.match(/alertlevel="([^"]+)"/i)?.[1] ??
      "Green";
    max = Math.max(max, gdacsAlertScore(level));
  }
  return max;
}

async function fetchAirSlice(
  cities: PakistanEnvCity[],
  scopeLabel: string,
): Promise<{ value: number; sub: string; aqi: number }> {
  const readings: { city: string; pm25: number; aqi: number }[] = [];
  await Promise.all(
    cities.map(async (c) => {
      try {
        const pm25 = await openMeteoAirQuality(c.lat, c.lon);
        if (pm25 == null) return;
        readings.push({ city: c.name, pm25, aqi: calculateAQIFromPm25(pm25) });
      } catch {
        /* skip */
      }
    }),
  );
  if (!readings.length) throw new Error("no_pm25_readings");

  if (cities.length === 1) {
    const r = readings[0]!;
    return {
      value: aqiToRiskBarPercent(r.aqi),
      sub: `${scopeLabel} AQI ${r.aqi} (${getAQILabel(r.aqi)}) · Open-Meteo PM2.5`,
      aqi: r.aqi,
    };
  }

  const avgPm = readings.reduce((a, r) => a + r.pm25, 0) / readings.length;
  const avgAqi = calculateAQIFromPm25(avgPm);
  const worst = readings.reduce((a, b) => (b.aqi > a.aqi ? b : a));
  return {
    value: aqiToRiskBarPercent(avgAqi),
    sub: `${scopeLabel} avg AQI ${Math.round(avgAqi)} (${getAQILabel(avgAqi)}) · worst ${worst.city} ${worst.aqi} · Open-Meteo`,
    aqi: Math.round(avgAqi),
  };
}

async function fetchHeatSlice(
  cities: PakistanEnvCity[],
  scopeLabel: string,
): Promise<{ value: number; sub: string }> {
  let maxPct = 0;
  let leader: string = cities[0]?.name ?? "Pakistan";
  let leaderTemp = 0;
  let leaderRh = 0;

  await Promise.all(
    cities.map(async (c) => {
      try {
        const j = await openMeteoForecast(c.lat, c.lon);
        const cur = j.current;
        const app = cur?.apparent_temperature;
        const rh = cur?.relative_humidity_2m ?? 50;
        if (typeof app !== "number") return;
        const pct = heatStressPercent(app, rh);
        if (pct > maxPct) {
          maxPct = pct;
          leader = c.name;
          leaderTemp = app;
          leaderRh = rh;
        }
      } catch {
        /* skip */
      }
    }),
  );

  if (maxPct <= 0) throw new Error("no_heat_readings");

  if (cities.length === 1) {
    return {
      value: maxPct,
      sub: `${scopeLabel} · feels ${leaderTemp.toFixed(1)}°C · RH ${Math.round(leaderRh)}% · Open-Meteo`,
    };
  }

  return {
    value: maxPct,
    sub: `Peak heat stress ${leader} · feels ${leaderTemp.toFixed(1)}°C · RH ${Math.round(leaderRh)}% · Open-Meteo`,
  };
}

async function fetchFloodSlice(
  cities: PakistanEnvCity[],
  scopeLabel: string,
): Promise<{ value: number; sub: string }> {
  const near = cities.length === 1 ? cities[0] : undefined;
  let gdacsPct = 0;
  try {
    const xml = await fetchText(GDACS_RSS);
    gdacsPct = parseGdacsFloodPercent(xml, near);
  } catch {
    gdacsPct = 0;
  }

  let maxPrecip = 0;
  let precipCity = cities[0]?.name ?? "Pakistan";
  await Promise.all(
    cities.map(async (c) => {
      try {
        const j = await openMeteoForecast(c.lat, c.lon);
        const mm = maxHourlyPrecipMm(j.hourly?.precipitation);
        if (mm > maxPrecip) {
          maxPrecip = mm;
          precipCity = c.name;
        }
      } catch {
        /* skip */
      }
    }),
  );
  const precipPct = precipFloodPercent(maxPrecip);
  const combined = Math.min(
    100,
    Math.max(gdacsPct, Math.round(gdacsPct * 0.55 + precipPct * 0.45)),
  );

  const gdacsNote =
    gdacsPct > 0 ?
      near ?
        `GDACS flood alerts near ${near.name} (${gdacsPct}%)`
      : `GDACS Pakistan flood alerts (${gdacsPct}%)`
    : near ?
      `No GDACS flood alerts near ${near.name}`
    : "No active GDACS flood alerts in Pakistan";

  const precipNote =
    cities.length === 1 ?
      `forecast peak ${maxPrecip.toFixed(1)} mm/h · Open-Meteo`
    : `max ${maxPrecip.toFixed(1)} mm/h near ${precipCity} · Open-Meteo`;

  return {
    value: combined,
    sub: `${scopeLabel}: ${gdacsNote}. Rainfall: ${precipNote}.`,
  };
}

/** Fetch live environmental risk for all Pakistan or one city. */
export async function fetchPakistanLiveEnvIndex(
  cityKey: PakistanEnvCityKey = "all",
): Promise<PakistanLiveEnvSnapshot> {
  const cities = citiesForKey(cityKey);
  const scopeLabel = cityKey === "all" ? "Pakistan" : cityKey;

  const results = await Promise.allSettled([
    fetchAirSlice(cities, scopeLabel),
    fetchHeatSlice(cities, scopeLabel),
    fetchFloodSlice(cities, scopeLabel),
  ]);

  const airR = results[0];
  const heatR = results[1];
  const floodR = results[2];

  const air =
    airR.status === "fulfilled" ?
      { value: airR.value.value, sub: airR.value.sub }
    : { value: 0, sub: `Open-Meteo air-quality unavailable for ${scopeLabel}.` };

  const heat =
    heatR.status === "fulfilled" ?
      heatR.value
    : { value: 0, sub: `Open-Meteo heat data unavailable for ${scopeLabel}.` };

  const flood =
    floodR.status === "fulfilled" ?
      floodR.value
    : { value: 0, sub: `GDACS / rainfall unavailable for ${scopeLabel}.` };

  const pakistanAqi = airR.status === "fulfilled" ? airR.value.aqi : null;
  const hasAny =
    airR.status === "fulfilled" ||
    heatR.status === "fulfilled" ||
    floodR.status === "fulfilled";

  return {
    heat,
    air,
    flood,
    hasAny,
    pakistanAqi,
    selectedCity: cityKey,
  };
}

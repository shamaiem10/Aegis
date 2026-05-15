/**
 * Geographic scope: Pakistan AOI for maps, location, and signal filtering.
 * BBox is approximate (mainland + GB/AJK), slightly inset from borders.
 */
import type { SignalApi } from "../api/types";
import type { MapRegion } from "../types/map-region";

export const PAKISTAN_TIMEZONE = "Asia/Karachi";

export const PAKISTAN_BBOX = {
  minLat: 23.65,
  maxLat: 37.05,
  minLon: 60.88,
  maxLon: 76.95,
} as const;

/** Default map when GPS is off — Islamabad capital area. */
export const PAKISTAN_DEFAULT_REGION: MapRegion = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

/** Whole-country overview (e.g. user located outside Pakistan). */
export const PAKISTAN_OVERVIEW_REGION: MapRegion = {
  latitude: 30.3753,
  longitude: 69.3451,
  latitudeDelta: 11.5,
  longitudeDelta: 11.5,
};

export function isLatLonInPakistan(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const { minLat, maxLat, minLon, maxLon } = PAKISTAN_BBOX;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/** Snap a point to the nearest corner inside the bbox (for map pin). */
export function clampLatLonToPakistan(lat: number, lon: number): { lat: number; lon: number } {
  const { minLat, maxLat, minLon, maxLon } = PAKISTAN_BBOX;
  return {
    lat: Math.min(maxLat, Math.max(minLat, lat)),
    lon: Math.min(maxLon, Math.max(minLon, lon)),
  };
}

export function filterSignalsPakistan(signals: SignalApi[]): SignalApi[] {
  return signals.filter((s) => isLatLonInPakistan(s.lat, s.lon));
}

/**
 * Classify humanitarian feed rows by text/kind (GDACS, USGS, ReliefWeb, etc.).
 * Traffic congestion is from the map layer, not these counts.
 */
export type HazardBreakdown = {
  seismic: number;
  flood: number;
  weather: number;
  accident: number;
  security: number;
  other: number;
};

export function hazardBreakdownFromSignals(signals: SignalApi[]): HazardBreakdown {
  const out: HazardBreakdown = {
    seismic: 0,
    flood: 0,
    weather: 0,
    accident: 0,
    security: 0,
    other: 0,
  };
  for (const s of signals) {
    const blob = `${s.kind} ${s.text}`.toLowerCase();
    if (/quake|seismic|magnitude|epicenter|usgs|emsc|shake|tectonic/.test(blob)) {
      out.seismic += 1;
    } else if (/flood|inundat|river|dam breach|rainfall|monsoon|glacial lake|gglof|flash flood/.test(blob)) {
      out.flood += 1;
    } else if (
      /storm|cyclone|typhoon|heatwave|drought|weather|wind gust|lightning|snow|blizzard/.test(blob)
    ) {
      out.weather += 1;
    } else if (
      /accident|collision|crash|pile[- ]?up|derail|vehicular|run[- ]?over|road incident|highway/.test(blob)
    ) {
      out.accident += 1;
    } else if (
      /theft|robber|snatch|mugging|dacoit|dakait|kidnap|abduct|extortion|looting|riot|civil unrest|armed attack|terror|ied|blast|security|law order/.test(
        blob,
      )
    ) {
      out.security += 1;
    } else {
      out.other += 1;
    }
  }
  return out;
}

/** Distinct coarse areas from backend `region` field (Pakistan feed). */
export function uniqueCoverageLabels(signals: SignalApi[], limit = 8): string[] {
  const set = new Set<string>();
  for (const s of signals) {
    const r = s.region?.trim();
    if (r) set.add(r);
    if (set.size >= limit * 2) break;
  }
  return [...set].slice(0, limit);
}

export function latestSignalTimestampIso(signals: SignalApi[]): string | null {
  if (!signals.length) return null;
  let max = 0;
  for (const s of signals) {
    const t = new Date(s.recorded_at).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max > 0 ? new Date(max).toISOString() : null;
}

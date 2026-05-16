import type { CrisisDossierApi, SignalApi } from "../api/types";
import { alertIconForSignal, type IonName } from "./alertIcons";

/** Readable title when `meta.display_name` is missing */
export function crisisDisplayTitle(c: CrisisDossierApi): string {
  if (!c?.crisis_id) return "Crisis";
  const dn = (c.meta?.display_name as string | undefined)?.trim();
  if (dn) return dn;
  const fuse = Array.isArray(c.fused) && c.fused.length > 0 ? c.fused[0] : undefined;
  const sum = fuse?.summary?.trim();
  if (sum) return sum.length > 90 ? `${sum.slice(0, 87)}…` : sum;
  const cat = formatCategory(c.classification?.category);
  const reg = fuse?.region?.trim();
  if (reg) return `${cat} · ${reg}`;
  return `${cat} · ${c.crisis_id}`;
}

function formatCategory(cat?: string | null): string {
  if (cat == null || typeof cat !== "string" || !cat.trim()) return "Incident";
  return cat.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
}

export type EnvIndexSlice = {
  value: number;
  sub: string;
};

export type EnvIndexAgg = {
  heat: EnvIndexSlice;
  air: EnvIndexSlice;
  flood: EnvIndexSlice;
  hasAny: boolean;
};

/** Derive 0–100 bars + subtitles only from active dossiers (no invented numbers). */
export function aggregateEnvIndexFromCrises(crises: CrisisDossierApi[]): EnvIndexAgg {
  const emptyHeat: EnvIndexSlice = { value: 0, sub: "No heat-related fields in active dossiers." };
  const emptyAir: EnvIndexSlice = { value: 0, sub: "No AQI or air-risk fields in active dossiers." };
  const emptyFlood: EnvIndexSlice = { value: 0, sub: "No flood-related fields in active dossiers." };

  if (!crises.length) {
    return {
      heat: emptyHeat,
      air: emptyAir,
      flood: emptyFlood,
      hasAny: false,
    };
  }

  let maxHeat = 0;
  let maxAir = 0;
  let maxFlood = 0;
  let heatSub = emptyHeat.sub;
  let airSub = emptyAir.sub;
  let floodSub = emptyFlood.sub;

  for (const c of crises) {
    if (!c) continue;
    const catRaw = `${(c.meta?.crisis_type as string) ?? ""} ${String(c.classification?.category ?? "")}`.toLowerCase();
    const sev = Number(c.severity?.score);
    const sevScore = Math.min(100, Math.max(0, (Number.isFinite(sev) ? Math.round(sev) : 0) * 10));
    const rationale = (c.classification?.rationale ?? "").trim();
    const weather = (c.severity?.weather_note ?? "").trim();
    const factors = (c.severity?.factors ?? []).join(" ").toLowerCase();
    const blob = `${catRaw} ${rationale.toLowerCase()} ${weather.toLowerCase()} ${factors}`;

    const note = weather || rationale || formatCategory(c.classification?.category);

    if (/heat|heatwave|heat index|ih\b|temperature|hyperthermia/.test(blob)) {
      if (sevScore > maxHeat) {
        maxHeat = sevScore;
        heatSub = note.slice(0, 120) || `Severity-derived index (${sevScore})`;
      }
    }

    const aqiVal = typeof c.meta?.aqi === "number" ? (c.meta.aqi as number) : null;
    if (aqiVal != null && Number.isFinite(aqiVal)) {
      const scaled = Math.min(100, Math.round(Math.min(aqiVal, 500) / 5));
      if (scaled > maxAir) {
        maxAir = scaled;
        const src = typeof c.meta?.aqi_source === "string" ? String(c.meta.aqi_source) : "dossier";
        airSub = `AQI ${Math.round(aqiVal)} (${src}). ${weather ? weather.slice(0, 70) : ""}`.trim();
      }
    } else if (/air quality|aqi|pm2|pm10|smog|particulate|plume/.test(blob)) {
      if (sevScore > maxAir) {
        maxAir = sevScore;
        airSub = note.slice(0, 120) || `Air-risk severity index (${sevScore})`;
      }
    }

    if (/flood|inundat|flash flood|hydro|monsoon|dam|river|water main|ponding/.test(blob)) {
      if (sevScore > maxFlood) {
        maxFlood = sevScore;
        floodSub = note.slice(0, 120) || `Flood-risk severity index (${sevScore})`;
      }
    }
  }

  return {
    heat: { value: maxHeat, sub: maxHeat > 0 ? heatSub : emptyHeat.sub },
    air: { value: maxAir, sub: maxAir > 0 ? airSub : emptyAir.sub },
    flood: { value: maxFlood, sub: maxFlood > 0 ? floodSub : emptyFlood.sub },
    hasAny: maxHeat > 0 || maxAir > 0 || maxFlood > 0,
  };
}

/** Source chips from live signals (truncated labels). */
export function fusionTickerFromSignals(signals: SignalApi[], limit = 10): { icon: IonName; label: string }[] {
  const seen = new Set<string>();
  const out: { icon: IonName; label: string }[] = [];
  for (const s of signals) {
    if (!s) continue;
    const raw = (s.source || s.kind || "signal").trim() || "signal";
    if (seen.has(raw)) continue;
    seen.add(raw);
    const label = raw.length > 28 ? `${raw.slice(0, 26)}…` : raw;
    out.push({
      icon: alertIconForSignal(s.kind, s.text),
      label,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function avgClassificationConfidencePct(crises: CrisisDossierApi[]): number | null {
  if (!crises.length) return null;
  let sum = 0;
  for (const c of crises) sum += Number(c?.classification?.confidence) || 0;
  return Math.round((sum / crises.length) * 100);
}

export function allocationSummary(crises: CrisisDossierApi[]): { units: number; incidents: number } | null {
  if (!crises.length) return null;
  let units = 0;
  for (const c of crises) {
    for (const u of c.allocation?.units ?? []) {
      units += Number(u.quantity_available) || 0;
    }
  }
  return { units, incidents: crises.length };
}

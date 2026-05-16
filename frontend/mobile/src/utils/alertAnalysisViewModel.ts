import type { SignalApi } from "../api/types";
import { pkMockCategoryFromSignal } from "../api/pkMockFeed";
import type { IonName } from "./alertIcons";
import {
  extractCrisisHeadline,
  formatAlertDisplay,
  formatPktTimestamp,
  parseAlertLocation,
} from "./formatAlertDisplay";

export type AlertPriorityLabel = "HIGH" | "MED" | "LOW";

export type AlertSourceRow = {
  label: string;
  icon: IonName;
  credibilityPct: number;
};

export type AlertImpactRow = {
  label: string;
  value: string;
  emphasis?: "high" | "normal";
};

export type AlertAnalysisViewModel = {
  signalId: string;
  title: string;
  headline: string;
  locationLine: string;
  timestampPkt: string;
  category: string;
  categoryLabel: string;
  kindLabel: string;
  sourceFeed: string;
  priority: AlertPriorityLabel;
  confidencePct: number;
  severityHint: number;
  coordinates: string;
  fullNarrative: string;
  detectedSources: AlertSourceRow[];
  sourceBreakdown: { source: string; count: number; avgCredibilityPct: number }[];
  impactRows: AlertImpactRow[];
  impactSummary: string;
  recommendedActions: string[];
  dataOrigin: string;
  showMisinfoWarning: boolean;
  misinfoNote: string;
};

type PayloadAnalysis = {
  detected_sources?: { label: string; icon?: string; credibility_pct?: number }[];
  source_breakdown?: { source: string; count: number; avg_credibility_pct?: number }[];
  impact?: { label: string; value: string; emphasis?: string }[];
  impact_summary?: string;
  recommended_actions?: string[];
  credibility_pct?: number;
};

function priorityFromSeverity(sev: number): AlertPriorityLabel {
  if (sev >= 8) return "HIGH";
  if (sev >= 5) return "MED";
  return "LOW";
}

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyFeedName(source: string): string {
  const map: Record<string, string> = {
    aegis_mock_pk_accidents: "PK Accidents API",
    aegis_mock_pk_seismic: "PK Earthquakes API",
    aegis_mock_pk_hydro: "PK Floods API",
    aegis_mock_pk_health: "PK Disease API",
  };
  return map[source] ?? source.replace(/_/g, " ");
}

function iconForSourceLabel(label: string): IonName {
  const l = label.toLowerCase();
  if (/hospital|health|eoc|nih|measles|dengue/.test(l)) return "medkit-outline";
  if (/weather|pmd|rain|hydro|gauge/.test(l)) return "cloud-outline";
  if (/satellite|gdacs|seismic|quake/.test(l)) return "globe-outline";
  if (/traffic|nhmp|highway|road|112/.test(l)) return "car-outline";
  if (/social|citizen/.test(l)) return "chatbubbles-outline";
  if (/dispatch|rescue|ems/.test(l)) return "radio-outline";
  return "analytics-outline";
}

function confidenceFromSignal(s: SignalApi): number {
  const p = s.payload ?? {};
  const raw = p.credibility_pct ?? (p.analysis as PayloadAnalysis | undefined)?.credibility_pct;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(99, Math.max(5, Math.round(raw)));
  }
  return Math.min(99, Math.max(45, 52 + s.severity_hint * 5));
}

function delayRisk(sev: number): { label: string; emphasis: "high" | "normal" } {
  if (sev >= 8) return { label: "High", emphasis: "high" };
  if (sev >= 6) return { label: "Elevated", emphasis: "high" };
  if (sev >= 4) return { label: "Moderate", emphasis: "normal" };
  return { label: "Low", emphasis: "normal" };
}

function defaultSources(cat: string, _p: Record<string, unknown>): AlertSourceRow[] {
  if (cat === "accidents") {
    return [
      { label: "NHMP / highway patrol feed", icon: "car-outline", credibilityPct: 88 },
      { label: "112 / rescue dispatch", icon: "radio-outline", credibilityPct: 91 },
      { label: "PK Accidents mock API", icon: "git-network-outline", credibilityPct: 94 },
    ];
  }
  if (cat === "earthquakes") {
    return [
      { label: "NDMA liaison rehearsal cell", icon: "shield-outline", credibilityPct: 90 },
      { label: "Regional seismic desk", icon: "globe-outline", credibilityPct: 86 },
      { label: "PK Earthquakes mock API", icon: "git-network-outline", credibilityPct: 94 },
    ];
  }
  if (cat === "floods") {
    return [
      { label: "River gauge / PDMA hydro", icon: "water-outline", credibilityPct: 89 },
      { label: "Open-Meteo rainfall context", icon: "cloud-outline", credibilityPct: 84 },
      { label: "PK Floods mock API", icon: "git-network-outline", credibilityPct: 94 },
    ];
  }
  if (cat === "disease") {
    return [
      { label: "Provincial Health EOC", icon: "medkit-outline", credibilityPct: 92 },
      { label: "NIH sentinel surveillance", icon: "analytics-outline", credibilityPct: 87 },
      { label: "PK Disease mock API", icon: "git-network-outline", credibilityPct: 94 },
    ];
  }
  return [{ label: "Deployed category API", icon: "git-network-outline", credibilityPct: 94 }];
}

function defaultBreakdown(cat: string, conf: number): AlertAnalysisViewModel["sourceBreakdown"] {
  const c = Math.max(60, conf - 8);
  if (cat === "accidents") {
    return [
      { source: "Official road / rescue", count: 2, avgCredibilityPct: conf },
      { source: "Corroborating dispatch", count: 1, avgCredibilityPct: c },
    ];
  }
  if (cat === "floods") {
    return [
      { source: "Hydrology / PDMA", count: 2, avgCredibilityPct: conf },
      { source: "Municipal DMC feeds", count: 1, avgCredibilityPct: c },
    ];
  }
  return [{ source: "Primary mock feed", count: 1, avgCredibilityPct: conf }];
}

function defaultImpact(
  s: SignalApi,
  cat: string,
  p: Record<string, unknown>,
): { rows: AlertImpactRow[]; summary: string; actions: string[] } {
  const sev = s.severity_hint;
  const risk = delayRisk(sev);
  const rows: AlertImpactRow[] = [
    { label: "Severity index", value: `${sev}/10`, emphasis: sev >= 8 ? "high" : "normal" },
    { label: "Response delay risk", value: risk.label, emphasis: risk.emphasis },
  ];

  if (cat === "accidents") {
    const vehicles = p.vehicles_involved_estimate;
    if (typeof vehicles === "number") {
      rows.unshift({ label: "Vehicles involved (est.)", value: String(vehicles), emphasis: "normal" });
    }
    if (p.hazard === "fuel_spill_possible") {
      rows.push({ label: "Hazmat concern", value: "Fuel spill possible", emphasis: "high" });
    }
    if (p.road_class) {
      rows.push({ label: "Road class", value: String(p.road_class), emphasis: "normal" });
    }
    return {
      rows,
      summary:
        "Traffic disruption on primary corridor; rescue and NHMP closures likely until scene cleared. Monitor alternate routes.",
      actions: ["Dispatch EMS and traffic control", "Issue motorist advisory on ring/bypass routes", "Check hazmat if tanker involved"],
    };
  }

  if (cat === "earthquakes") {
    const mag = p.mag;
    if (typeof mag === "number") {
      rows.unshift({ label: "Magnitude (reported)", value: String(mag), emphasis: mag >= 5 ? "high" : "normal" });
    }
    const depth = p.depth_km_approx;
    if (typeof depth === "number") {
      rows.push({ label: "Depth (approx.)", value: `${depth} km`, emphasis: "normal" });
    }
    return {
      rows,
      summary:
        sev >= 6 ?
          "Felt shaking in urban belt — monitor aftershocks and structural assessments in dense wards."
        : "Regional event with limited population exposure on Pakistan side; maintain liaison standby.",
      actions: ["NDMA sit-rep check", "Verify building damage reports", "Standby rescue detachments in felt areas"],
    };
  }

  if (cat === "floods") {
    if (p.stage_alert) rows.push({ label: "River stage", value: String(p.stage_alert), emphasis: "high" });
    const rain = p.rain_mm_h_peak_est;
    if (typeof rain === "number") {
      rows.push({ label: "Rainfall peak (est.)", value: `${rain} mm/h`, emphasis: rain >= 30 ? "high" : "normal" });
    }
    return {
      rows,
      summary:
        "Hydrological stress — pre-position pumps, watch low terraces and urban underpass sumps; coordinate PDMA sandbag corridors.",
      actions: ["Issue precautionary evacuation for low terraces", "Pre-position dewatering assets", "Sync PDMA / DMC watch lists"],
    };
  }

  if (cat === "disease") {
    const pathogen = p.pathogen_hint;
    if (pathogen) rows.unshift({ label: "Pathogen signal", value: String(pathogen), emphasis: "high" });
    return {
      rows,
      summary:
        "Public-health cluster flagged — expand sampling, vaccination or vector control per provincial SOP; school and water advisories as needed.",
      actions: ["Activate EOC cluster protocol", "Deploy mop-up vaccination or larvicide sorties", "Issue community WASH guidance"],
    };
  }

  return {
    rows,
    summary: "Incident under monitoring inside Pakistan AOI. Escalate if corroborating feeds increase severity.",
    actions: ["Open crisis dossier", "Notify field teams"],
  };
}

function mergePayloadAnalysis(
  s: SignalApi,
  cat: string,
  conf: number,
): Pick<
  AlertAnalysisViewModel,
  "detectedSources" | "sourceBreakdown" | "impactRows" | "impactSummary" | "recommendedActions"
> {
  const p = s.payload ?? {};
  const embedded = p.analysis as PayloadAnalysis | undefined;

  if (embedded?.detected_sources?.length) {
    const detectedSources = embedded.detected_sources.map((row) => ({
      label: row.label,
      icon: iconForSourceLabel(row.label),
      credibilityPct: Math.round(row.credibility_pct ?? conf),
    }));
    const sourceBreakdown =
      embedded.source_breakdown?.map((r) => ({
        source: r.source,
        count: r.count,
        avgCredibilityPct: Math.round(r.avg_credibility_pct ?? conf),
      })) ?? defaultBreakdown(cat, conf);
    const impactRows =
      embedded.impact?.map((r) => ({
        label: r.label,
        value: r.value,
        emphasis: r.emphasis === "high" ? ("high" as const) : ("normal" as const),
      })) ?? defaultImpact(s, cat, p).rows;
    return {
      detectedSources,
      sourceBreakdown,
      impactRows,
      impactSummary: embedded.impact_summary ?? defaultImpact(s, cat, p).summary,
      recommendedActions: embedded.recommended_actions ?? defaultImpact(s, cat, p).actions,
    };
  }

  const built = defaultImpact(s, cat, p);
  return {
    detectedSources: defaultSources(cat, p),
    sourceBreakdown: defaultBreakdown(cat, conf),
    impactRows: built.rows,
    impactSummary: built.summary,
    recommendedActions: built.actions,
  };
}

export function buildAlertAnalysisViewModel(signal: SignalApi): AlertAnalysisViewModel {
  const display = formatAlertDisplay(signal);
  const { city, area } = parseAlertLocation(signal);
  const cat = pkMockCategoryFromSignal(signal) ?? "other";
  const conf = confidenceFromSignal(signal);
  const p = signal.payload ?? {};
  const flags = Array.isArray(p.flags) ? (p.flags as string[]) : [];
  const merged = mergePayloadAnalysis(signal, cat, conf);

  return {
    signalId: signal.id,
    title: display.title,
    headline: extractCrisisHeadline(signal.text, 200),
    locationLine: `${city} · ${area}`,
    timestampPkt: formatPktTimestamp(signal.recorded_at),
    category: cat,
    categoryLabel: categoryLabel(cat),
    kindLabel: kindLabel(signal.kind),
    sourceFeed: friendlyFeedName(signal.source),
    priority: priorityFromSeverity(signal.severity_hint),
    confidencePct: conf,
    severityHint: signal.severity_hint,
    coordinates: `${signal.lat.toFixed(4)}°, ${signal.lon.toFixed(4)}°`,
    fullNarrative: signal.text.trim(),
    ...merged,
    dataOrigin: `Live row from ${friendlyFeedName(signal.source)} · Pakistan mock category API`,
    showMisinfoWarning: flags.includes("contradiction") || flags.includes("suspicious"),
    misinfoNote:
      "Corroboration weak — treat as unverified until official feeds align. Do not escalate on social-only indicators.",
  };
}

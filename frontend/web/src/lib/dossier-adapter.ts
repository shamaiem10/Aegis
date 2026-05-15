import type { Crisis, CrisisType, Signal, SignalSource } from "@/components/aegis/data";
import type { CrisisDossierApi } from "./aegis-types";

/** Map lat/lon (Pakistan-focused viewport) to stylized map pin %. */
export function coordsToPin(lat: number, lon: number): { x: number; y: number } {
  const minLat = 23.8;
  const maxLat = 37.2;
  const minLon = 60.5;
  const maxLon = 78.5;
  const x = ((lon - minLon) / (maxLon - minLon)) * 100;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return {
    x: Math.max(6, Math.min(92, x)),
    y: Math.max(8, Math.min(86, y)),
  };
}

const catMap: Record<string, CrisisType> = {
  flood: "Flood",
  fire: "Accident",
  civil_unrest: "Protest",
  earthquake: "Accident",
  disease_outbreak: "Disease Cluster",
  infrastructure: "Infrastructure",
  other: "Infrastructure",
};

function mapCategory(cat: string): CrisisType {
  return catMap[cat.toLowerCase()] ?? "Infrastructure";
}

function mapStatus(s: string): Crisis["status"] {
  const u = s.toUpperCase();
  if (u === "ACTIVE" || u === "MONITORING" || u === "RESOLVED" || u === "FALSE ALARM") {
    return u as Crisis["status"];
  }
  if (s === "active") return "ACTIVE";
  if (s === "monitoring") return "MONITORING";
  if (s === "resolved") return "RESOLVED";
  return "MONITORING";
}

export function dossierToCrisis(d: CrisisDossierApi): Crisis {
  const f0 = d.fused[0];
  const lat = f0?.lat ?? 33.6938;
  const lon = f0?.lon ?? 73.0152;
  const coords: [number, number] = [lat, lon];
  const pin = coordsToPin(lat, lon);
  const conf = Math.round(Math.min(100, Math.max(0, d.classification.confidence * 100)));
  const bonus = d.fused.length * 0.4;
  const radiusKm = Math.min(12, 1.2 + d.severity.score * 0.35 + bonus);
  const population = Math.round(8000 + d.severity.score * 4200 + d.fused.length * 1500);

  return {
    id: d.crisis_id,
    type: mapCategory(d.classification.category),
    severity: d.severity.score,
    confidence: conf,
    location: f0?.region ? `${f0.region} · fused` : "Fused cluster",
    coords,
    detectedAt: new Date(d.created_at).toLocaleString(),
    status: mapStatus(d.status),
    radiusKm: Math.round(radiusKm * 10) / 10,
    population,
    peakIn: d.severity.weather_note ? "~60 min" : "~45 min",
    duration: "~6 hrs",
    spreadRisk: d.severity.score >= 8 ? "High" : d.severity.score >= 5 ? "Medium" : "Low",
    pin,
    alt:
      d.classification.confidence < 0.55
        ? {
            type: "Infrastructure",
            confidence: Math.round((1 - d.classification.confidence) * 100),
            reason: d.classification.rationale,
          }
        : undefined,
  };
}

export function dossiersToCrises(rows: CrisisDossierApi[]): Crisis[] {
  return rows.map(dossierToCrisis);
}

function kindToSource(kind: string): SignalSource {
  const k = kind.toLowerCase();
  if (k.includes("social")) return "social";
  if (k.includes("weather")) return "weather";
  if (k.includes("traffic")) return "traffic";
  if (k.includes("sensor")) return "sensor";
  if (k.includes("official") || k.includes("sms")) return "call";
  if (k.includes("news")) return "social";
  return "sensor";
}

/** Build UI signals from fused bundles for evidence panels. */
export function dossierToSignals(d: CrisisDossierApi): Signal[] {
  return d.fused.map((f, i) => ({
    id: f.id || `fus_${i}`,
    source: kindToSource(f.kind),
    text: f.summary,
    credibility: Math.round(Math.min(100, f.confidence * 100)),
    geo: 90,
    urgency: f.fused_severity_hint * 10,
    velocity: 40,
    contradiction: f.confidence < 0.5 ? 40 : 5,
    badge: f.confidence > 0.75 ? "VERIFIED" : "LOW CONFIDENCE",
    time: new Date(f.window_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    crisisId: d.crisis_id,
  }));
}

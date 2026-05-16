/**
 * Normalize PMD/NDMA scraped alerts → fields compatible with mobile `SignalApi`
 * / FastAPI `RawSignalRecord` shape (official Pakistan feeds only).
 */
import type { NDMAAlert } from "../scrapers/ndma";
import type { PMDAlert } from "../scrapers/pmd";

export type ParsedSignalFlat = {
  id: string;
  source: string;
  kind: string;
  text: string;
  lat: number;
  lon: number;
  region: string;
  severity_hint: number;
  recorded_at: string;
  payload: Record<string, unknown>;
};

const PK_BB = { minLat: 23.65, maxLat: 37.05, minLon: 60.88, maxLon: 76.95 };

const REGION_CENTROIDS: Record<string, [number, number]> = {
  Islamabad: [33.6844, 73.0479],
  Rawalpindi: [33.5651, 73.0169],
  Punjab: [31.1471, 72.3412],
  KPK: [34.7492, 72.7853],
  Sindh: [26.8945, 68.8677],
  Balochistan: [28.8943, 65.0681],
  Lahore: [31.5204, 74.3587],
  Peshawar: [34.0151, 71.5249],
  Pakistan: [30.3753, 69.3451],
};

function severityToHint(label: string): number {
  const m = {
    Critical: 9,
    High: 8,
    Medium: 6,
    Low: 4,
  } as Record<string, number>;
  return m[label] ?? 5;
}

function regionsToLl(regions: string[]): [number, number] {
  const pts = regions.map((r) => REGION_CENTROIDS[r]).filter(Boolean) as [number, number][];
  if (!pts.length) return REGION_CENTROIDS["Pakistan"]!;
  const lat = pts.reduce((a, x) => a + x[0], 0) / pts.length;
  const lon = pts.reduce((a, x) => a + x[1], 0) / pts.length;
  return [
    Math.min(PK_BB.maxLat, Math.max(PK_BB.minLat, lat)),
    Math.min(PK_BB.maxLon, Math.max(PK_BB.minLon, lon)),
  ];
}

export function pmdNDMAAlertsToParsedSignals(pmd: PMDAlert[], ndma: NDMAAlert[]): ParsedSignalFlat[] {
  const byId = new Map<string, ParsedSignalFlat>();

  for (const a of pmd) {
    const [lat, lon] = regionsToLl(a.regions);
    const recAt = typeof a.issuedAt === "string" ? a.issuedAt : new Date().toISOString();
    byId.set(`pmd-${a.id}`, {
      id: `pmd-${a.id}`,
      source: a.source,
      kind: "official",
      text: `PMD advisory — ${a.title}. ${(a.body || "").slice(0, 280)}`.trim(),
      lat,
      lon,
      region: a.regions.length ? a.regions.join(", ") : "Pakistan",
      severity_hint: severityToHint(a.severity),
      recorded_at: recAt,
      payload: {
        category: "pmd",
        title: a.title,
        severity_label: a.severity,
        alert_type: a.type,
        regions: a.regions,
        credibility_pct: a.credibility,
        detail_url: a.url,
      },
    });
  }

  for (const a of ndma) {
    const regs = [...a.regions];
    const [lat, lon] = regionsToLl(regs.length ? regs : ["Pakistan"]);
    const recAt = typeof a.issuedAt === "string" ? a.issuedAt : new Date().toISOString();
    byId.set(`ndma-${a.id}`, {
      id: `ndma-${a.id}`,
      source: a.source,
      kind: "official",
      text: `NDMA notice — ${a.title}. ${(a.body || "").slice(0, 280)}`.trim(),
      lat,
      lon,
      region: regs.length ? regs.join(", ") : "Pakistan",
      severity_hint: severityToHint(a.severity),
      recorded_at: recAt,
      payload: {
        category: "ndma",
        title: a.title,
        severity_label: a.severity,
        alert_type: a.type,
        regions: regs,
        pdf_url: a.pdfUrl,
        credibility_pct: a.credibility,
        detail_url: a.url,
      },
    });
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
}

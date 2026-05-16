import type { CrisisDossierApi, SignalApi } from "./types";

/** Pakistan mock API category slugs (matches deployed endpoints). */
export type PkMockCategorySlug = "accidents" | "earthquakes" | "floods" | "disease";

/** UI filter keys for Pakistan mock-category alerts. */
export type PkAlertCategoryFilter = "all" | PkMockCategorySlug;

export function pkMockCategoryFromSignal(s: SignalApi): PkMockCategorySlug | "other" {
  const cat = crisisCategoryFromSignal(s);
  if (cat === "accidents" || cat === "earthquakes" || cat === "floods" || cat === "disease") return cat;
  return "other";
}

export function signalMatchesPkCategoryFilter(s: SignalApi, filter: PkAlertCategoryFilter): boolean {
  if (filter === "all") return true;
  return pkMockCategoryFromSignal(s) === filter;
}

/** Case-insensitive match on alert text, region, source, kind, id, and category. */
export function signalMatchesSearchQuery(s: SignalApi, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const cat = pkMockCategoryFromSignal(s);
  const payload = s.payload ?? {};
  const blob = [
    s.text,
    s.source,
    s.kind,
    s.region,
    s.id,
    cat,
    String(payload.mock_category ?? ""),
    String(payload.pathogen_hint ?? ""),
    String(payload.road_class ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(q);
}

function crisisCategoryFromSignal(s: SignalApi): string {
  const mc = s.payload?.mock_category;
  if (typeof mc === "string" && mc.trim()) return mc.trim().toLowerCase();
  const blob = `${s.kind} ${s.text}`.toLowerCase();
  if (/accident|traffic|road|collision|crash|pile/.test(blob)) return "accidents";
  if (/quake|seismic|earthquake|magnitude/.test(blob)) return "earthquakes";
  if (/flood|hydro|inundat|surge|monsoon/.test(blob)) return "floods";
  if (/disease|measles|dengue|hepatitis|outbreak|vector|health/.test(blob)) return "disease";
  return "other";
}

/** Build crisis dossiers for Home / Crises from Pakistan mock-category signal rows. */
export function crisesFromPkMockSignals(signals: SignalApi[]): CrisisDossierApi[] {
  return signals.map((s) => {
    const cat = crisisCategoryFromSignal(s);
    const score = Math.min(10, Math.max(0, Number(s.severity_hint) || 0));
    const conf = Math.min(0.98, 0.55 + score * 0.04);
    const critical = score >= 8;
    const title =
      s.region?.trim() ?
        `${cat.replace(/_/g, " ")} · ${s.region}`
      : s.text.length > 72 ?
        `${s.text.slice(0, 69)}…`
      : s.text;

    return {
      crisis_id: `pk-${s.id}`,
      status: score >= 6 ? "active" : "monitoring",
      fused: [
        {
          id: s.id,
          summary: s.text.length > 220 ? `${s.text.slice(0, 217)}…` : s.text,
          lat: s.lat,
          lon: s.lon,
          region: s.region,
          confidence: conf,
          fused_severity_hint: score,
        },
      ],
      classification: {
        category: cat,
        confidence: conf,
        rationale: `Pakistan mock category feed (${s.source}).`,
      },
      severity: {
        score,
        factors: [`severity_hint=${score}`, `kind=${s.kind}`],
        weather_note: null,
      },
      allocation: {
        units: [],
        notes: "Mock category API — allocation not bundled in rehearsal feed.",
      },
      notifications: [],
      created_at: s.recorded_at,
      meta: {
        display_name: title,
        crisis_type: cat,
        ui_severity_label: critical ? "Critical" : score >= 6 ? "Elevated" : "Watch",
        pk_mock_signal_id: s.id,
        feed_source: s.source,
      },
    };
  });
}

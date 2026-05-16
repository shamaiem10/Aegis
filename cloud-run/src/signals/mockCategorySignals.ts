/**
 * Mirrors `services/pk-mock-category-apis/src/signals-data.ts` — keep payloads there in sync when editing.
 */

export type MockCategorySlug = "accidents" | "earthquakes" | "floods" | "disease";

export type FlatSignalDoc = Record<string, unknown> & {
  id: string;
  source: string;
  kind: string;
  text: string;
  lat: number;
  lon: number;
  region: string;
  severity_hint: number;
  recorded_at: string;
};

function isoMinutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function sig(
  id: string,
  opts: Omit<FlatSignalDoc, "id" | "recorded_at"> & {
    minutesAgo: number;
    payload?: Record<string, unknown>;
  },
): FlatSignalDoc {
  const { minutesAgo, payload, ...rest } = opts;
  return {
    id,
    ...rest,
    recorded_at: isoMinutesAgo(minutesAgo),
    ...(payload ? { payload } : {}),
  } as FlatSignalDoc;
}

const ACCIDENTS: FlatSignalDoc[] = [
  sig("pk-acc-m1-crash-khi-01", {
    source: "aegis_mock_pk_accidents",
    kind: "traffic_accident",
    text:
      "Multi-vehicle incident reported — Karachi Northern Bypass westbound lane near Surjani junction; rescue dispatched; motorists advised alternate route via Lyari Expressway spur.",
    lat: 24.974,
    lon: 67.0643,
    region: "Karachi, Sindh",
    severity_hint: 8,
    minutesAgo: 18,
    payload: { mock_category: "accidents", road_class: "arterial" },
  }),
  sig("pk-acc-m2-pileup-lhr-02", {
    source: "aegis_mock_pk_accidents",
    kind: "traffic_accident",
    text:
      "Heavy goods collision + secondary pile-up — Lahore Ring Road Sector F bottleneck; ICT EMS mutual aid requested; drones for thermal sweep.",
    lat: 31.4452,
    lon: 74.2486,
    region: "Lahore, Punjab",
    severity_hint: 7,
    minutesAgo: 54,
    payload: { mock_category: "accidents", vehicles_involved_estimate: 6 },
  }),
  sig("pk-acc-m3-gt-hotspot-rwp-03", {
    source: "aegis_mock_pk_accidents",
    kind: "road_incident",
    text:
      "GT Road Rawalpindi–Taxila corridor — overturned cargo tanker partially blocking uphill lane; NHMP rolling closure segments 800m east of toll.",
    lat: 33.6112,
    lon: 72.8195,
    region: "Rawalpindi, Punjab",
    severity_hint: 6,
    minutesAgo: 112,
    payload: { mock_category: "accidents", hazard: "fuel_spill_possible" },
  }),
];

const EARTHQUAKES: FlatSignalDoc[] = [
  sig("pk-seq-hk-feltisb-04", {
    source: "aegis_mock_pk_seismic",
    kind: "earthquake_alert",
    text:
      "M4.9 regional event — foothills northwest; Islamabad/Rwp reported light shaking EMS II–III equivalent; NDMA liaison cell monitoring aftershocks (mock rehearsal feed).",
    lat: 33.721,
    lon: 73.0601,
    region: "Islamabad–Rawalpindi felt area",
    severity_hint: 5,
    minutesAgo: 26,
    payload: { mock_category: "earthquakes", mag: 4.9, depth_km_approx: 18 },
  }),
  sig("pk-seq-baloch-remote-05", {
    source: "aegis_mock_pk_seismic",
    kind: "earthquake_alert",
    text:
      "Moderate distal quake — Balochistan–Afghan frontier; negligible population exposure PK side; DGPDMA sit-rep standby (training signal).",
    lat: 30.112,
    lon: 67.0891,
    region: "Balochistan (border AOI)",
    severity_hint: 4,
    minutesAgo: 191,
    payload: { mock_category: "earthquakes", mag: 5.2 },
  }),
];

const FLOODS: FlatSignalDoc[] = [
  sig("pk-fl-kabul-stage-warn-06", {
    source: "aegis_mock_pk_hydro",
    kind: "river_flood",
    text:
      "Kabul River Nowshera gauge trending rapid rise — precautionary evacuation advisory low terraces; sync with PDMA KP sandbag corridors (mock).",
    lat: 34.0159,
    lon: 71.9815,
    region: "Nowshera, KPK",
    severity_hint: 8,
    minutesAgo: 33,
    payload: { mock_category: "floods", stage_alert: "watch" },
  }),
  sig("pk-fl-urban-cell-khi-07", {
    source: "aegis_mock_pk_hydro",
    kind: "flash_flood_risk",
    text:
      "High-intensity cell track over Lyari corridor — Karachi DMC pre-position pumps; BRT underpass sump watch list active.",
    lat: 24.8607,
    lon: 66.9905,
    region: "Karachi Central, Sindh",
    severity_hint: 7,
    minutesAgo: 47,
    payload: { mock_category: "floods", rain_mm_h_peak_est: 42 },
  }),
  sig("pk-fl-coastal-swath-gw-08", {
    source: "aegis_mock_pk_hydro",
    kind: "coastal_surge",
    text:
      "Monsoon-enhanced runoff — Gwadar East Bay low-lying access roads precautionary cordon rehearsal; PDMA Balochistan coordination net check.",
    lat: 25.2332,
    lon: 62.3354,
    region: "Gwadar, Balochistan",
    severity_hint: 5,
    minutesAgo: 203,
    payload: { mock_category: "floods" },
  }),
];

const DISEASE: FlatSignalDoc[] = [
  sig("pk-dis-meas-cluster-mkd-09", {
    source: "aegis_mock_pk_health",
    kind: "disease_cluster",
    text:
      "KP Health EOC — accelerated measles case cluster flagged in periphery wards; supplementary vaccination mop-up window 72h (synthetic tabletop feed).",
    lat: 34.3076,
    lon: 73.0363,
    region: "Mansehra, KPK",
    severity_hint: 6,
    minutesAgo: 61,
    payload: { mock_category: "disease", pathogen_hint: "measles" },
  }),
  sig("pk-dis-deng-lhr-watch-10", {
    source: "aegis_mock_pk_health",
    kind: "vector_borne_watch",
    text:
      "Punjab NIH dengue sentinel uptick — Lahore hotspots vector indices above district trigger; larvicide sorties confirmed for next dawn cycle (mock).",
    lat: 31.5497,
    lon: 74.3436,
    region: "Lahore, Punjab",
    severity_hint: 5,
    minutesAgo: 88,
    payload: { mock_category: "disease", pathogen_hint: "dengue" },
  }),
  sig("pk-dis-hepatitis-khi-monitor-11", {
    source: "aegis_mock_pk_health",
    kind: "wash_related_cluster",
    text:
      "Karachi Korangi industrial belt — hepatitis A suspicion cluster sampling expanded; bottled-water advisory corridors issued to schools (training payload).",
    lat: 24.8353,
    lon: 67.127,
    region: "Karachi, Sindh",
    severity_hint: 5,
    minutesAgo: 140,
    payload: { mock_category: "disease" },
  }),
];

const BY_CAT: Record<MockCategorySlug, FlatSignalDoc[]> = {
  accidents: ACCIDENTS,
  earthquakes: EARTHQUAKES,
  floods: FLOODS,
  disease: DISEASE,
};

export function normalizeMockCategorySlugParam(raw: string): MockCategorySlug | null {
  let s = raw.trim().toLowerCase().replace(/-/g, "_");
  if (["disease_spreads", "diseasespreads", "disease_spread", "health"].includes(s)) s = "disease";
  if (["quake", "seismic", "earthquake"].includes(s)) s = "earthquakes";
  if (["crash", "road"].includes(s)) s = "accidents";
  if (["flood", "floods", "inundation"].includes(s)) s = "floods";
  if (s === "accidents" || s === "earthquakes" || s === "floods" || s === "disease") return s;
  return null;
}

export function getMockSignalsForCategoryParam(segment: string): FlatSignalDoc[] {
  const slug = normalizeMockCategorySlugParam(segment);
  if (!slug) return [];
  return BY_CAT[slug].map((r) => ({ ...r }));
}

export function getMockSignalsMergedSorted(): FlatSignalDoc[] {
  const merged = [...ACCIDENTS, ...EARTHQUAKES, ...FLOODS, ...DISEASE];
  merged.sort((a, b) => new Date(String(b.recorded_at)).getTime() - new Date(String(a.recorded_at)).getTime());
  return merged;
}

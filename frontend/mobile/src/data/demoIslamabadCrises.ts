import type { CrisisDossierApi } from "../api/types";

/** Rich Islamabad / twin-city scenario for offline demo (v2 environmental). */
export const DEMO_ISLAMABAD_DOSSIERS: CrisisDossierApi[] = [
  {
    crisis_id: "crisis-g10-001",
    status: "active",
    fused: [
      {
        id: "f-g10-a",
        summary:
          "Water main burst corroborated — pressure drop 2.1 bar; G-10 corridor flooding from supply line, not storm drain overload.",
        lat: 33.6938,
        lon: 72.9846,
        region: "G-10, Islamabad",
        confidence: 0.61,
        fused_severity_hint: 9,
      },
    ],
    classification: {
      category: "flood",
      confidence: 0.61,
      rationale:
        "Reclassified from generic urban flooding to Infrastructure - Water Main: single corroborating utility signal vs prior multi-source flood model.",
    },
    severity: {
      score: 9,
      factors: [
        "Rapid inundation along feed main",
        "Evening traffic + school corridors",
        "Resource contention with I-8 heatwave medical unit",
      ],
      weather_note: "No extreme rainfall; hydraulic failure dominant.",
    },
    allocation: {
      units: [
        { resource_id: "amb-01", name: "Ambulances", quantity_available: 3 },
        { resource_id: "rescue-01", name: "Rescue teams", quantity_available: 2 },
        { resource_id: "police-01", name: "Police units", quantity_available: 4 },
        { resource_id: "drone-01", name: "Drones", quantity_available: 2 },
        { resource_id: "tanker-01", name: "Water tankers", quantity_available: 2 },
      ],
      notes:
        "G-10 Flooding: 2 rescue teams, 2 police units, 1 drone, 1 water tanker committed; competes with F-7 and I-8.",
    },
    notifications: [
      {
        channel: "ops_console",
        title: "Critical — G-10",
        body: "Water main crisis — severity 9 — 61% confidence post reclassification",
      },
    ],
    created_at: new Date(Date.now() - 47 * 60_000).toISOString(),
    meta: {
      demo: true,
      display_name: "G-10 Water Main Burst",
      crisis_type: "Infrastructure - Water Main",
      ui_severity_label: "Critical",
      confidence_pct: 61,
      conflicting_hypothesis: {
        title: "Water Main Burst",
        confidence_pct: 61,
        signals: 1,
      },
      affected_population: 12400,
      vulnerable_count: 1840,
      expected_duration: "4–7 hours",
      peak_in: "47–62 minutes",
      spread_risk: "Medium",
      evolution_status: "escalating",
      location_label: "G-10, Islamabad",
      lat: 33.6938,
      lon: 72.9846,
    },
  },
  {
    crisis_id: "crisis-i8-002",
    status: "active",
    fused: [
      {
        id: "f-i8-a",
        summary:
          "Heat index 47°C — humidity 68%; I-8 grid heatwave stable; compound AQI drift from F-7 plume at boundary.",
        lat: 33.7215,
        lon: 73.0587,
        region: "I-8, Islamabad",
        confidence: 0.91,
        fused_severity_hint: 7,
      },
    ],
    classification: {
      category: "heat",
      confidence: 0.91,
      rationale: "Thermal + humidity corroboration; co-monitored AQI Moderate at sector.",
    },
    severity: {
      score: 7,
      factors: [
        "Extended heat index above 45°C",
        "3200 vulnerable (elderly/infants)",
        "Compound air: AQI 142 at location",
      ],
      weather_note: "Stable synoptic; no cooling night breeze forecast before 22:00.",
    },
    allocation: {
      units: [
        { resource_id: "amb-02", name: "Ambulances", quantity_available: 2 },
        { resource_id: "med-out", name: "Medical outreach", quantity_available: 0 },
        { resource_id: "field-01", name: "Field teams", quantity_available: 1 },
      ],
      notes: "I-8: 1 ambulance, 1 medical outreach, 1 field team — vulnerable pop revised to 4,100 for compound AQ.",
    },
    notifications: [
      {
        channel: "sms_drill",
        title: "Heatwave advisory",
        body: "I-8 cooling stations staged; monitor EMS surge.",
      },
    ],
    created_at: new Date(Date.now() - 126 * 60_000).toISOString(),
    meta: {
      demo: true,
      display_name: "I-8 Sector Heatwave",
      crisis_type: "Heatwave",
      ui_severity_label: "High",
      confidence_pct: 91,
      affected_population: 8700,
      vulnerable_count: 4100,
      compound_risk: {
        type: "Air Quality",
        aqiAtLocation: 142,
        note: "AQI Moderate at I-8 — compounding heat stress for vulnerable residents",
        linked_crisis_id: "crisis-f7-003",
        linked_title: "F-7 Industrial Air Quality Emergency",
        body: "Active air quality emergency in adjacent F-7 (AQI 287) compounds heat stress for I-8. Combined heat index + PM2.5 exposure increases respiratory hospitalization risk ~2.3×.",
      },
      heat_index_c: 47,
      humidity_pct: 68,
      expected_duration: "12–18 hours",
      peak_in: "2–3 hours",
      evolution_status: "stable",
      location_label: "I-8, Islamabad",
      lat: 33.7215,
      lon: 73.0587,
    },
  },
  {
    crisis_id: "crisis-f7-003",
    status: "active",
    fused: [
      {
        id: "f-f7-a",
        summary:
          "PEPA Sensor F7-03: PM2.5 194 µg/m³, PM10 312 µg/m³, AQI 287 — industrial corridor source probability high.",
        lat: 33.7095,
        lon: 73.0421,
        region: "F-7, Islamabad",
        confidence: 0.88,
        fused_severity_hint: 8,
      },
    ],
    classification: {
      category: "air_quality",
      confidence: 0.88,
      rationale:
        "Six-sensor cluster + satellite corroboration; wind shift projects plume toward G-7 residential.",
    },
    severity: {
      score: 8,
      factors: [
        "AQI Very Unhealthy (287)",
        "8400 vulnerable in exposure zone",
        "Competing EMS demand with G-10 and I-8",
      ],
      weather_note: "NW wind 24 km/h shifting SE — plume trajectory updated.",
    },
    allocation: {
      units: [
        { resource_id: "aqru-01", name: "Air Quality Response Units", quantity_available: 1 },
        { resource_id: "resp-kit", name: "Respiratory Medical Kits", quantity_available: 3 },
        { resource_id: "mask-01", name: "Mask Distribution Teams", quantity_available: 3 },
        { resource_id: "pepa-01", name: "PEPA Inspection Teams", quantity_available: 1 },
        { resource_id: "field-03", name: "Field teams", quantity_available: 2 },
      ],
      notes:
        "F-7: 1 AQ unit, 1 respiratory kit, 1 PEPA team, 2 field teams; pre-deploy 1 mask team for dust corridor.",
    },
    notifications: [
      {
        channel: "ops_console",
        title: "F-7 Air Quality",
        body: "Health advisory queue — six audiences — pending approval",
      },
    ],
    created_at: new Date(Date.now() - 84 * 60_000).toISOString(),
    meta: {
      demo: true,
      display_name: "F-7 Industrial Air Quality Emergency",
      crisis_type: "Air Quality Emergency",
      ui_severity_label: "High",
      confidence_pct: 88,
      aqi: 287,
      aqi_category: "Very Unhealthy",
      primary_metric: { label: "AQI", value: 287, unit: "AQI", category: "Very Unhealthy" },
      pollutants: {
        PM25: { value: 194, unit: "µg/m³", whoLimit: 15, multiplier: 6.4 },
        PM10: { value: 312, unit: "µg/m³", whoLimit: 45, multiplier: 6.9 },
        NO2: { value: 87, unit: "µg/m³", whoLimit: 25, multiplier: 3.5 },
        SO2: { value: 41, unit: "µg/m³", whoLimit: 40, multiplier: 1.0 },
        O3: { value: 118, unit: "µg/m³", whoLimit: 100, multiplier: 1.2 },
      },
      windDirection: "NW → shifting SE",
      windSpeed: "24 km/hr",
      plumeRadius: 2.1,
      projectedPlumeRadius: 4.8,
      sourceAttribution: "Margalla Industrial Corridor — 3 factories flagged",
      conflicting_hypothesis: {
        title: "Cross-border/seasonal smog",
        confidence_pct: 29,
        signals: 2,
      },
      affected_population: 31000,
      vulnerable_count: 8400,
      assignedResources: ["field-03", "field-04", "medical-02", "pepa-01"],
      signals_total: 20,
      expected_duration: "8–14 hours",
      peak_in: "90 minutes",
      evolution_status: "escalating",
      mini_timeline: ["Detected", "Classified", "Alerts Sent"],
      hypothesis_a: {
        title: "Industrial emissions",
        confidence_pct: 71,
        signals: 8,
      },
      hypothesis_b: {
        title: "Cross-border dust + seasonal smog",
        confidence_pct: 29,
        signals: 2,
      },
      health_impact_note:
        "Respiratory risk HIGH for sensitive groups. ~8,400 vulnerable residents in exposure zone.",
      location_label: "F-7, Islamabad",
      lat: 33.7095,
      lon: 73.0421,
    },
  },
  {
    crisis_id: "crisis-rwp-004",
    status: "monitoring",
    fused: [
      {
        id: "f-rwp-a",
        summary:
          "PMD dust storm advisory — Rawalpindi–Islamabad corridor; visibility forecast <500m; ETA window 17:45–18:30.",
        lat: 33.5651,
        lon: 73.0169,
        region: "Rawalpindi–Islamabad Corridor",
        confidence: 0.79,
        fused_severity_hint: 5,
      },
    ],
    classification: {
      category: "dust",
      confidence: 0.79,
      rationale: "Met advisory + wind model consensus; event not yet arrived on ground sensors.",
    },
    severity: {
      score: 5,
      factors: ["Pre-arrival monitoring", "85000 corridor exposure", "Transport + airport cascade risk"],
      weather_note: "Leading edge advancing NE; PM10 spike anticipated.",
    },
    allocation: {
      units: [
        { resource_id: "mask-01", name: "Mask Distribution Teams (pre-positioned)", quantity_available: 2 },
      ],
      notes: "Pre-position 2 mask teams Rawalpindi transit — standby until arrival confirmation.",
    },
    notifications: [
      {
        channel: "pmd_feed",
        title: "Dust advisory",
        body: "Corridor warning — M-2 and airport advisories pre-drafted",
      },
    ],
    created_at: new Date(Date.now() - 32 * 60_000).toISOString(),
    meta: {
      demo: true,
      display_name: "Rawalpindi Dust Storm — Incoming",
      crisis_type: "Dust Storm",
      ui_severity_label: "Medium",
      confidence_pct: 79,
      ui_status_line: "Monitoring — not yet arrived",
      etaMinutes: 44,
      affected_population: 85000,
      vulnerable_count: 14200,
      primary_metric: { label: "Visibility", value: 2.4, unit: "km", projected: 0.18 },
      forecastPM10Peak: "850–1200 µg/m³",
      transportRisk:
        "Motorway M-2 partial closure likely, Islamabad Airport visibility advisory issued",
      prePositionedResources: ["mask-dist-01", "mask-dist-02"],
      signals_total: 6,
      visibility_peak_km: 0.05,
      location_label: "Rawalpindi–Islamabad Corridor",
      lat: 33.5651,
      lon: 73.0169,
    },
  },
  {
    crisis_id: "crisis-r7-005",
    status: "false_alarm",
    fused: [
      {
        id: "f-r7-a",
        summary: "IESCO confirmed scheduled maintenance — outage cleared; no cascade.",
        lat: 33.65,
        lon: 73.07,
        region: "R-7, Islamabad",
        confidence: 0.95,
        fused_severity_hint: 2,
      },
    ],
    classification: {
      category: "power",
      confidence: 0.95,
      rationale: "Utility retraction — transformer maintenance was scheduled.",
    },
    severity: {
      score: 2,
      factors: ["No load shedding", "Public alert retracted"],
      weather_note: null,
    },
    allocation: {
      units: [],
      notes: "All units released.",
    },
    notifications: [
      {
        channel: "ops_console",
        title: "Retracted",
        body: "2 alerts sent before retraction at 14:32",
      },
    ],
    created_at: new Date(Date.now() - 400 * 60_000).toISOString(),
    meta: {
      demo: true,
      display_name: "R-7 Power Outage",
      crisis_type: "Power Outage",
      false_alarm_reason: "Scheduled transformer maintenance by IESCO",
      retracted_at: "14:32",
      alerts_sent_before_retraction: 2,
    },
  },
  {
    crisis_id: "crisis-e11-006",
    status: "false_alarm",
    fused: [
      {
        id: "f-e11-a",
        summary:
          "Social cluster only — E11-01 AQI 94 Moderate contradicts smoke emergency; satellite shows no industrial plume.",
        lat: 33.72,
        lon: 73.03,
        region: "E-11, Islamabad",
        confidence: 0.92,
        fused_severity_hint: 2,
      },
    ],
    classification: {
      category: "air_quality",
      confidence: 0.92,
      rationale: "Barbecue event in community park — misclassified as industrial smoke.",
    },
    severity: {
      score: 2,
      factors: ["Zero public alerts sent", "Caught at signal analysis"],
      weather_note: null,
    },
    allocation: { units: [], notes: "" },
    notifications: [],
    created_at: new Date(Date.now() - 38 * 60_000).toISOString(),
    meta: {
      demo: true,
      display_name: "E-11 Smoke Emergency",
      crisis_type: "Air Quality Emergency",
      false_alarm_reason:
        "Community barbecue misidentified. AQI sensor E11-01 reads 94 (Moderate). 0 alerts sent.",
      retracted_at: new Date(Date.now() - 31 * 60_000).toISOString(),
      impact_score_note:
        "0 alerts sent, 0 evacuations — caught at analysis. Prevented unnecessary alarm for ~4,200 residents.",
    },
  },
];

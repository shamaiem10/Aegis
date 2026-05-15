import type { CrisisDossierApi } from "../api/types";

const now = () => new Date().toISOString();

/** Full v2 environmental + Islamabad scenario metadata for demo dossiers (merged in `demoSessionReset`). */
export const DEMO_ORCHESTRATION_META: NonNullable<CrisisDossierApi["meta"]> = {
  antigravity_trace: [
    {
      agent: "signal_ingest",
      phase: "pull",
      detail: "Multi-source ingest: PEPA sensors, PMD, social, hospital logs, satellite queue.",
      outputs_summary: "142 candidate rows (PK AOI)",
      confidence: 0.9,
    },
    {
      agent: "credibility_scorer",
      phase: "score",
      detail: "Cross-source PM2.5 coherence + velocity checks; 6 suspicious social flags.",
      outputs_summary: "136 scored",
      confidence: 0.84,
    },
    {
      agent: "fusion_agent",
      phase: "cluster",
      detail: "4 concurrent incidents: G-10 utility flood, I-8 heat, F-7 AQ, RWP dust monitoring.",
      outputs_summary: "4 fused bundles",
      confidence: 0.87,
      flags: ["resource_tradeoff", "compound_risk"],
    },
    {
      agent: "staged_alert_policy",
      phase: "plan",
      detail: "Dust corridor: stagger M-2 closure → public advisory → school release to limit panic traffic.",
      outputs_summary: "rings=3 dust_stagger=true",
      confidence: 0.81,
    },
    {
      agent: "AQISensorAgent",
      phase: "classify",
      detail:
        "3 PEPA sensors in F-7 crossed PM2.5 threshold (>150 µg/m³) simultaneously — cluster classification — initial confidence 62%",
      outputs_summary: "crisis-f7-003 candidate",
      confidence: 0.88,
      flags: ["AQI Analysis"],
    },
    {
      agent: "SatelliteCorroborationAgent",
      phase: "verify",
      detail: "PEPA satellite imagery confirmed active stack emissions at Margalla Industrial Corridor — confidence +26% → 88%",
      outputs_summary: "hypothesis A reinforced",
      confidence: 0.93,
      flags: ["Environmental"],
    },
    {
      agent: "HealthImpactAgent",
      phase: "assess",
      detail:
        "F-7 population vulnerability map — 8,400 residents high-risk — severity upgraded Medium → High",
      outputs_summary: "vulnerable=8400",
      confidence: 0.86,
    },
    {
      agent: "WindTrajectoryAgent",
      phase: "forecast",
      detail:
        "WeatherAPI wind shift NW→SE in 2h — plume model updates — G-7 enters risk — affected pop 31k → 44k",
      outputs_summary: "plume radius 2.1→4.8 km",
      confidence: 0.82,
      flags: ["Environmental"],
    },
    {
      agent: "SourceAttributionAgent",
      phase: "attribute",
      detail:
        "Satellite signatures vs factory registry — 3 facilities flagged — hypothesis A 71% vs smog mix 29%",
      outputs_summary: "3 probable sources",
      confidence: 0.71,
    },
    {
      agent: "PriorityRankingAgent",
      phase: "rank",
      detail:
        "G-10 (Crit 78%) > F-7 AQ (High 88%) > I-8 heat (High 91%) > Dust (Med 79%) — F-7 larger vulnerable share than I-8 standalone",
      outputs_summary: "priority stack recorded",
      confidence: 0.79,
    },
    {
      agent: "PrePositioningAgent",
      phase: "stage",
      detail:
        "Dust ETA 44m — 2 mask teams staged Rawalpindi transit — 0 active resources consumed until confirm",
      outputs_summary: "mask-dist-* staged",
      confidence: 0.77,
      flags: ["Environmental"],
    },
    {
      agent: "ResourceConflictAgent",
      phase: "optimize",
      detail:
        "Ambulance demand 4 vs supply 3 — recommend hold 1 ambulance F-7 community center (max health impact / deployment)",
      outputs_summary: "allocator v4",
      confidence: 0.74,
    },
    {
      agent: "HealthAdvisoryAgent",
      phase: "draft",
      detail: "6 audience-tailored F-7 messages queued — est. reach 31k SMS — pending operator approval",
      outputs_summary: "6 drafts",
      confidence: 0.91,
    },
    {
      agent: "DustStormForecastAgent",
      phase: "advisory",
      detail:
        "PMD + WRF — dust arrival confidence 61%→79% — M-2 + airport IATA advisories pre-drafted",
      outputs_summary: "crisis-rwp-004 monitoring",
      confidence: 0.79,
      flags: ["Environmental"],
    },
    {
      agent: "CompoundRiskAgent",
      phase: "compound",
      detail:
        "I-8 heat index 47°C / 68% RH + PM2.5 drift 142 at boundary — vulnerable revised 3,200→4,100 — joint EMS advised",
      outputs_summary: "compound flag I-8",
      confidence: 0.86,
      flags: ["AQI Analysis", "Environmental"],
    },
  ],
  hypothesis_conflict: {
    crisis: "F-7 Industrial Air Quality Emergency",
    hypothesis_a: { label: "Industrial emissions — 14 signals, avg credibility 83%", confidence: 0.83 },
    hypothesis_b: { label: "Cross-border dust + seasonal smog — 4 signals, avg credibility 61%", confidence: 0.61 },
    resolution: "PEPA satellite imagery requested for stack confirmation — pending ~20 min",
    level: 0.71,
    notes: ["Emission source disputed — Factory A denies output; PEPA imagery shows active stacks."],
  },
  detection_gaps: {
    risks: ["Satellite pass gap 6h — plume edge uncertainty ±400m"],
    escalate_manual_review: false,
    max_source_credibility: 0.99,
  },
  staged_alert_plan: {
    version: 2,
    rings: [
      { id: "inner", radius_km: 0.7, delay_sec: 0, max_messages_per_minute: 24 },
      { id: "middle", radius_km: 2.2, delay_sec: 120, max_messages_per_minute: 12 },
    ],
    evacuation_staging: true,
    policy_rationale:
      "Issuing dust storm public alert at 17:00 risks 90m pre-storm panic. Sequence: M-2 closure 17:15 → public 17:25 → school release 17:30 (~40% traffic stagger).",
  },
  staged_alert_intelligence: {
    dust_stagger_note:
      "Recommended: M-2 closure first → public advisory → school early dismissal to stagger corridor load.",
  },
  ingest_meta: {
    degraded_mode: [],
    signal_source_counts: { pepa: 6, pmd: 2, social: 8, hospital: 3, satellite: 1 },
    environmental_signal_quality_pct: 91,
  },
  environmental_signal_quality_pct: 91,
  prediction_engine: {
    f7_aqi: {
      peak_aqi_band: "310–340 Hazardous approaching",
      peak_in_min: 90,
      unhealthy_duration_h: "6–10",
      spread_radius_km: { current: 2.1, projected: 4.8 },
      recovery_note: "Moderate AQI <100 — 8–14h after confirmed factory shutdown",
      events: [
        { t_offset_h: 2, label: "Wind shift expected", aqi_proj: 210 },
        { t_offset_h: 4, label: "Factory shutdown effect", aqi_proj: 160 },
      ],
    },
    dust: {
      peak_pm10: "850–1200 µg/m³",
      min_visibility_m: "50–180",
      duration_peak_h: "2–4",
      recovery_visibility_h: "~6h post-peak to >1km",
      cascade:
        "Airport closure if vis <300m >30min; sensor dust fouling; combined PM10+AQI may approach 400+",
    },
    scenario_branching: {
      tab_a: { label: "Factory shuts down ≤60m", peak_aqi: 310, below_200_by: "22:00" },
      tab_b: { label: "Factory continues", peak_aqi: 380, below_200_by: "next morning" },
    },
  },
  false_alarm_queue: [
    {
      id: "fa-e11-001",
      title: "E-11 Smoke Emergency",
      reason:
        "3 social posts about smoke — sensors AQI 94 Moderate; satellite shows no industrial plume — barbecue event",
      impact:
        "0 alerts sent; caught at analysis; ~4,200 residents spared unnecessary panic; threshold review logged",
      status: "Confirmed false alarm",
    },
  ],
  audit_log: [
    { ts: now(), event: "aqi_threshold", note: "F-7-Sensor-02 PM2.5 194 µg/m³ — AI Agent" },
    { ts: now(), event: "crisis_classified", note: "F-7 Air Quality Emergency — Severity High — AI Agent" },
    { ts: now(), event: "satellite_requested", note: "PEPA imagery request — AI Agent" },
    { ts: now(), event: "satellite_confirmed", note: "Industrial emissions source — AI Agent" },
    { ts: now(), event: "vulnerability_map", note: "8,400 high-risk residents identified — AI Agent" },
    { ts: now(), event: "health_advisory_draft", note: "6 audiences — pending operator approval — AI Agent" },
    { ts: now(), event: "health_advisory_sent", note: "Public + Hospitals + PEPA — Operator: Ahmed Raza" },
    { ts: now(), event: "pepa_dispatch", note: "Inspection team Margalla Industrial — Operator: Ahmed Raza" },
    { ts: now(), event: "resource_preposition", note: "2 mask teams Rawalpindi — AI Agent (auto)" },
    { ts: now(), event: "pmd_advisory", note: "Dust storm advisory ingested — AI Agent" },
    { ts: now(), event: "crisis_created", note: "Dust corridor monitoring — Medium — crisis-rwp-004 — AI Agent" },
    { ts: now(), event: "m2_pre_draft", note: "Motorway M-2 advisory pre-drafted — pending send — AI Agent" },
    { ts: now(), event: "e11_flagged", note: "E-11 smoke cluster credibility check — AI Agent" },
    { ts: now(), event: "e11_false_alarm", note: "FALSE ALARM confirmed — analysis stage — AI Agent" },
    { ts: now(), event: "wind_trajectory", note: "Plume may reach G-7 — population revised 44,000 — AI Agent" },
  ],
  signal_credibility: [
    { signal_id: "sig-aq-f7-03", credibility: 0.96, geolocation_confidence: 0.94, flags: ["PEPA Sensor Network"] },
    { signal_id: "sig-pmd-dust-01", credibility: 0.99, geolocation_confidence: 0.92, flags: ["Pakistan Met Department"] },
    { signal_id: "sig-sat-pepa-01", credibility: 0.93, geolocation_confidence: 0.78, flags: ["satellite"] },
    { signal_id: "sig-pims-resp-01", credibility: 0.88, geolocation_confidence: 0.81, flags: ["Hospital Reports"] },
    { signal_id: "sig-social-f7-01", credibility: 0.61, geolocation_confidence: 0.72, flags: ["Social Media"] },
    { signal_id: "sig-conspiracy-01", credibility: 0.18, geolocation_confidence: 0.55, flags: ["contradiction", "suspicious"] },
    { signal_id: "sig-EPA-station-01", credibility: 0.97, geolocation_confidence: 0.9, flags: ["PEPA station"] },
    { signal_id: "sig-g10-flood-01", credibility: 0.82, geolocation_confidence: 0.88, flags: [] },
    { signal_id: "sig-g10-contra-01", credibility: 0.22, geolocation_confidence: 0.4, flags: ["misinformation_risk"] },
  ],
  source_trust_leaderboard: [
    { rank: 1, source: "Pakistan Met Department", avg_credibility: 0.99 },
    { rank: 2, source: "PEPA Sensor Network", avg_credibility: 0.95 },
    { rank: 3, source: "Satellite Imagery Feed", avg_credibility: 0.93 },
    { rank: 4, source: "Hospital Reports", avg_credibility: 0.88 },
    { rank: 5, source: "Social Media", avg_credibility: 0.58 },
  ],
  source_breakdown_f7: [
    { source: "PEPA Sensor Network", count: 6, avg_credibility: 0.95 },
    { source: "Pakistan Met Department", count: 2, avg_credibility: 0.99 },
    { source: "Social Media", count: 8, avg_credibility: 0.58 },
    { source: "Hospital Reports", count: 3, avg_credibility: 0.88 },
    { source: "Satellite Imagery", count: 1, avg_credibility: 0.93 },
  ],
  action_simulation: [
    {
      action_id: "traffic_reroute",
      before_state: "G-10 corridor saturated",
      response_action: "Staged detour + contraflow",
      expected_after_state: "EMS ingress improved",
      response_time_improvement_min: 6,
      congestion_impact: "Bypass spike 25–40 min",
      resource_cost_units: 2.5,
      possible_side_effects: ["Evac rush if messaging too hot"],
    },
    {
      action_id: "pe_public_health_advisory",
      before_state: "31,000 unaware of AQI risk; outdoor activity normal",
      response_action: "SMS + radio advisory F-7 & G-7 sectors",
      expected_after_state: "60–70% awareness ≤30m; outdoor foot traffic ~−45%",
      response_time_improvement_min: 12,
      congestion_impact: "School pickup congestion 15:30 if uncoordinated",
      resource_cost_units: 0.4,
      possible_side_effects: [
        "Panic buying pharmacies F-7 — pre-alert OGDCL medical stores",
        "Coordinate with CDA traffic before mass school release",
      ],
    },
    {
      action_id: "pepa_emergency_order",
      before_state: "3 factories full output — PM2.5 source active",
      response_action: "PEPA emergency cease-and-desist on flagged stacks",
      expected_after_state: "Estimated emissions −60–80% within 2h (compliance assumed)",
      response_time_improvement_min: null,
      congestion_impact: "None direct",
      resource_cost_units: 1.2,
      possible_side_effects: [
        "Legal challenge risk — document evidence",
        "AQI improvement lag 4–6h atmospheric clearance",
      ],
    },
    {
      action_id: "school_closure_f7",
      before_state: "Normal attendance F-7",
      response_action: "School & office closure advisory F-7",
      expected_after_state: "Rapid exit wave",
      response_time_improvement_min: null,
      congestion_impact: "SEVERE if no M-2 / traffic advisory first",
      resource_cost_units: 0.2,
      possible_side_effects: [
        "Mass simultaneous departure without traffic mgmt → ~3× peak volume — coordinate CDA first",
      ],
    },
    {
      action_id: "dust_warning_corridor",
      before_state: "Public low awareness of dust ETA",
      response_action: "Dust storm warning ISB-RWP corridor + vis guidance",
      expected_after_state: "Reduced road load 17:45–20:00 window",
      response_time_improvement_min: 18,
      congestion_impact: "Early advisory may front-load traffic — use stagger plan",
      resource_cost_units: 0.3,
      possible_side_effects: [],
    },
    {
      action_id: "mask_preposition_rwp",
      before_state: "Mask teams idle",
      response_action: "Pre-position 2 mask distribution teams RWP transit hubs",
      expected_after_state: "Staged for dust arrival confirmation",
      response_time_improvement_min: null,
      congestion_impact: "Minimal",
      resource_cost_units: 0,
      possible_side_effects: [],
    },
  ],
  stakeholder_messages: [
    {
      audience: "Public (Urdu)",
      channel: "SMS + FM",
      title: "F-7 ہوائی معیار",
      body: "شہریوں سے گزارش ہے کہ F-7 اور G-7 میں بیرونی سرگرمیاں کم رکھیں؛ دمہ یا دل کے مریض ماسک پہنیں۔ مزید تفصیل اگلے پیغام میں۔",
    },
    {
      audience: "Public (English)",
      channel: "SMS",
      title: "Air quality — F-7 / G-7",
      body: "Hazardous AQI band detected. Limit outdoor exertion; use N95 if you must go out. Hospitals and EMS have been pre-notified for a possible respiratory surge.",
    },
    {
      audience: "EMS / Rescue 1122",
      channel: "CAD + secure chat",
      title: "Pre-position respiratory support",
      body: "Stage O₂ concentrators and nebuliser kits toward F-7 community routing; favour Blue Area bypass for ambulance corridors; monitor RWP dust corridor crisis-rwp-004.",
    },
    {
      audience: "Hospitals (PIMS / polyclinics)",
      channel: "EMR flag",
      title: "Respiratory surge protocol",
      body: "Expect roughly +25–40% ED presentations over the next 6–10 h if the plume holds; reserve step-down beds; align with PEPA exposure timelines and compound heat+I-8 risk.",
    },
    {
      audience: "Utilities (IESCO / SNGPL)",
      channel: "Ops bridge",
      title: "Industrial load confirmation",
      body: "PEPA emergency order may issue for Margalla corridor stacks — prepare feeder curtailment plans only if cease-and-desist executes; await operator confirmation.",
    },
    {
      audience: "Transport (CDA / M-2)",
      channel: "Traffic ops",
      title: "Staggered release — critical",
      body: "Do not mass-dismiss schools or offices without the M-2 partial advisory first; models show roughly 3× corridor peak. Follow staged_alert_plan sequencing.",
    },
    {
      audience: "Media desk",
      channel: "Press cell",
      title: "Verified briefing lines",
      body: "Cite PEPA sensors + imagery and PMD for wind; avoid unverified social screenshots — reference E-11 false-alarm queue outcome as contrast case.",
    },
  ],
  agent_kpis: {
    environmental_crises_handled: 2,
    aqi_threshold_alerts: 3,
  },
};

// Shared mock data for CIRO / Aegis screens (mirrors frontend/web/src/components/aegis/data.ts)
import type { IonName } from "../../utils/alertIcons";
export type CrisisType =
  | "Flood"
  | "Heatwave"
  | "Accident"
  | "Infrastructure"
  | "Power Outage"
  | "Protest"
  | "Disease Cluster";

export interface Crisis {
  id: string;
  type: CrisisType;
  severity: number; // 1-10
  confidence: number; // 0-100
  location: string;
  coords: [number, number];
  detectedAt: string;
  status: "ACTIVE" | "MONITORING" | "RESOLVED" | "FALSE ALARM";
  radiusKm: number;
  population: number;
  peakIn: string;
  duration: string;
  spreadRisk: "Low" | "Medium" | "High";
  pin: { x: number; y: number }; // % on stylized map
  alt?: { type: CrisisType; confidence: number; reason: string };
}

export const crises: Crisis[] = [
  {
    id: "CRS-001",
    type: "Flood",
    severity: 9,
    confidence: 92,
    location: "F-10 Markaz, Islamabad",
    coords: [33.6938, 73.0152],
    detectedAt: "09:24 AM",
    status: "ACTIVE",
    radiusKm: 2.4,
    population: 48200,
    peakIn: "42 min",
    duration: "~6 hrs",
    spreadRisk: "High",
    pin: { x: 38, y: 42 },
    alt: {
      type: "Infrastructure",
      confidence: 22,
      reason:
        "Water main burst would have localized flow signature, but multi-sensor rainfall + drainage overflow confirmed flood.",
    },
  },
  {
    id: "CRS-002",
    type: "Heatwave",
    severity: 7,
    confidence: 88,
    location: "I-9 Industrial Area",
    coords: [33.662, 73.07],
    detectedAt: "10:02 AM",
    status: "ACTIVE",
    radiusKm: 6.1,
    population: 132000,
    peakIn: "3 hrs",
    duration: "~9 hrs",
    spreadRisk: "Medium",
    pin: { x: 64, y: 56 },
  },
  {
    id: "CRS-003",
    type: "Accident",
    severity: 6,
    confidence: 95,
    location: "Kashmir Highway / Faizabad",
    coords: [33.665, 73.083],
    detectedAt: "10:18 AM",
    status: "MONITORING",
    radiusKm: 0.8,
    population: 5400,
    peakIn: "12 min",
    duration: "~1 hr",
    spreadRisk: "Low",
    pin: { x: 72, y: 36 },
  },
  {
    id: "CRS-004",
    type: "Power Outage",
    severity: 5,
    confidence: 81,
    location: "G-11 Sector",
    coords: [33.66, 72.98],
    detectedAt: "10:31 AM",
    status: "MONITORING",
    radiusKm: 1.5,
    population: 22000,
    peakIn: "—",
    duration: "~2 hrs",
    spreadRisk: "Low",
    pin: { x: 22, y: 60 },
  },
  {
    id: "CRS-005",
    type: "Protest",
    severity: 4,
    confidence: 64,
    location: "D-Chowk",
    coords: [33.73, 73.09],
    detectedAt: "10:42 AM",
    status: "MONITORING",
    radiusKm: 0.5,
    population: 3500,
    peakIn: "—",
    duration: "—",
    spreadRisk: "Medium",
    pin: { x: 50, y: 22 },
  },
  {
    id: "CRS-006",
    type: "Disease Cluster",
    severity: 3,
    confidence: 58,
    location: "Bara Kahu",
    coords: [33.74, 73.18],
    detectedAt: "Yesterday",
    status: "MONITORING",
    radiusKm: 3.2,
    population: 18000,
    peakIn: "—",
    duration: "—",
    spreadRisk: "Low",
    pin: { x: 84, y: 70 },
  },
];

export type SignalSource = "social" | "weather" | "traffic" | "sensor" | "call";
export interface Signal {
  id: string;
  source: SignalSource;
  text: string;
  credibility: number;
  geo: number;
  urgency: number;
  velocity: number;
  contradiction: number;
  badge: "VERIFIED" | "LOW CONFIDENCE" | "SUSPICIOUS" | "FALSE ALARM";
  time: string;
  crisisId?: string;
}

export const signals: Signal[] = [
  {
    id: "SIG-9821",
    source: "weather",
    text: "Rainfall 78mm/hr at F-10 station, drainage capacity exceeded.",
    credibility: 96,
    geo: 99,
    urgency: 88,
    velocity: 40,
    contradiction: 4,
    badge: "VERIFIED",
    time: "09:22",
    crisisId: "CRS-001",
  },
  {
    id: "SIG-9822",
    source: "social",
    text: "@ahmed_isb: 'Streets in F-10 fully underwater, cars floating'",
    credibility: 84,
    geo: 71,
    urgency: 92,
    velocity: 95,
    contradiction: 8,
    badge: "VERIFIED",
    time: "09:23",
    crisisId: "CRS-001",
  },
  {
    id: "SIG-9823",
    source: "sensor",
    text: "Water level sensor WL-F10-3 reading 1.42m (threshold 0.6m).",
    credibility: 99,
    geo: 100,
    urgency: 90,
    velocity: 10,
    contradiction: 0,
    badge: "VERIFIED",
    time: "09:24",
    crisisId: "CRS-001",
  },
  {
    id: "SIG-9824",
    source: "call",
    text: "112 call: family stranded on rooftop, F-10/2 St 24.",
    credibility: 92,
    geo: 88,
    urgency: 99,
    velocity: 5,
    contradiction: 0,
    badge: "VERIFIED",
    time: "09:26",
    crisisId: "CRS-001",
  },
  {
    id: "SIG-9825",
    source: "traffic",
    text: "Kashmir Hwy slowdown 12→34 min, multi-vehicle collision.",
    credibility: 88,
    geo: 95,
    urgency: 75,
    velocity: 60,
    contradiction: 0,
    badge: "VERIFIED",
    time: "10:18",
    crisisId: "CRS-003",
  },
  {
    id: "SIG-9826",
    source: "social",
    text: "'Bomb blast in F-10!!' — viral post, unverified",
    credibility: 22,
    geo: 60,
    urgency: 96,
    velocity: 88,
    contradiction: 78,
    badge: "SUSPICIOUS",
    time: "09:31",
  },
  {
    id: "SIG-9827",
    source: "weather",
    text: "Heat index I-9 reaching 47°C, humidity 71%.",
    credibility: 95,
    geo: 99,
    urgency: 80,
    velocity: 30,
    contradiction: 0,
    badge: "VERIFIED",
    time: "10:02",
    crisisId: "CRS-002",
  },
  {
    id: "SIG-9828",
    source: "social",
    text: "'Fire at Centaurus mall' — single source, no corroboration",
    credibility: 14,
    geo: 40,
    urgency: 90,
    velocity: 24,
    contradiction: 92,
    badge: "FALSE ALARM",
    time: "10:11",
  },
  {
    id: "SIG-9829",
    source: "sensor",
    text: "Grid feeder G11-A tripped at 10:30, draw=0",
    credibility: 99,
    geo: 100,
    urgency: 70,
    velocity: 5,
    contradiction: 0,
    badge: "VERIFIED",
    time: "10:31",
    crisisId: "CRS-004",
  },
  {
    id: "SIG-9830",
    source: "social",
    text: "Gathering at D-Chowk, ~300 people, peaceful so far",
    credibility: 71,
    geo: 85,
    urgency: 50,
    velocity: 55,
    contradiction: 12,
    badge: "LOW CONFIDENCE",
    time: "10:42",
    crisisId: "CRS-005",
  },
];

export interface Resource {
  type: string;
  icon: IonName;
  total: number;
  deployed: number;
  assigned?: { crisisId: string; eta: string }[];
  /** Human-centric impact line for environmental deployments */
  healthImpact?: string;
}

export const resources: Resource[] = [
  {
    type: "Ambulances",
    icon: "medkit-outline",
    total: 18,
    deployed: 11,
    assigned: [
      { crisisId: "CRS-001", eta: "6 min" },
      { crisisId: "CRS-003", eta: "4 min" },
    ],
  },
  {
    type: "Police Units",
    icon: "shield-outline",
    total: 32,
    deployed: 14,
    assigned: [
      { crisisId: "CRS-001", eta: "8 min" },
      { crisisId: "CRS-005", eta: "12 min" },
    ],
  },
  {
    type: "Rescue Teams",
    icon: "flame-outline",
    total: 9,
    deployed: 6,
    assigned: [{ crisisId: "CRS-001", eta: "9 min" }],
  },
  {
    type: "Shelters",
    icon: "home-outline",
    total: 12,
    deployed: 4,
    assigned: [{ crisisId: "CRS-001", eta: "open" }],
  },
  {
    type: "Generators",
    icon: "flash-outline",
    total: 22,
    deployed: 5,
    assigned: [{ crisisId: "CRS-004", eta: "20 min" }],
  },
  {
    type: "Water Tankers",
    icon: "water-outline",
    total: 14,
    deployed: 8,
    assigned: [{ crisisId: "CRS-002", eta: "15 min" }],
  },
  {
    type: "Drones",
    icon: "airplane-outline",
    total: 7,
    deployed: 3,
    assigned: [{ crisisId: "CRS-001", eta: "2 min" }],
  },
  {
    type: "Field Teams",
    icon: "people-outline",
    total: 28,
    deployed: 17,
    assigned: [
      { crisisId: "CRS-001", eta: "5 min" },
      { crisisId: "CRS-002", eta: "11 min" },
    ],
  },
  {
    type: "Air Quality Response Units",
    icon: "leaf-outline",
    total: 2,
    deployed: 1,
    healthImpact: "~2,400 vulnerable people served per team-hour (mask + advisory).",
    assigned: [{ crisisId: "crisis-f7-003", eta: "on-site" }],
  },
  {
    type: "Respiratory Medical Kits",
    icon: "medkit-outline",
    total: 4,
    deployed: 1,
    healthImpact: "Bronchodilator coverage for high-risk block clusters.",
    assigned: [{ crisisId: "crisis-f7-003", eta: "deployed" }],
  },
  {
    type: "N95 / FFP2 Mask Distribution Teams",
    icon: "people-outline",
    total: 3,
    deployed: 0,
    healthImpact: "Pre-staged for dust corridor — 0 active until arrival confirm.",
    assigned: [{ crisisId: "crisis-rwp-004", eta: "staged RWP" }],
  },
  {
    type: "PEPA Inspection Teams",
    icon: "clipboard-outline",
    total: 2,
    deployed: 1,
    assigned: [{ crisisId: "crisis-f7-003", eta: "factory audit" }],
  },
];

export const apiHealth = [
  { name: "Pakistan Met Department (PMD)", status: "Online", latency: "67 ms" },
  { name: "PEPA Sensor Network", status: "Online", latency: "124 ms" },
  { name: "Satellite Imagery (PEPA/SUPARCO)", status: "Degraded", latency: "6h cycle" },
  { name: "OGDCL Air Quality API", status: "Online", latency: "340 ms" },
  { name: "Airport METAR · Islamabad", status: "Online", latency: "98 ms" },
  { name: "Weather API", status: "Online", latency: "120 ms" },
  { name: "Traffic API", status: "Slow", latency: "1.4 s" },
  { name: "Social Signal Feed", status: "Online", latency: "210 ms" },
  { name: "Firestore DB", status: "Online", latency: "60 ms" },
  { name: "Vertex AI", status: "Online", latency: "480 ms" },
  { name: "Sensor Gateway", status: "Down", latency: "—" },
] as const;

export const agentTrace = [
  {
    agent: "Signal Ingestor",
    input: "Raw stream from 5 sources",
    reasoning:
      "Filtered 1,204 events → 142 candidate signals via dedup + geo-fence.",
    output: "142 normalized signals",
    confidence: 99,
    ms: 220,
    tools: ["dedupe()", "geofence()"],
  },
  {
    agent: "Credibility Scorer",
    input: "142 signals",
    reasoning:
      "Cross-referenced source priors, urgency lexicon, contradiction matrix.",
    output: "Scored signals; flagged 6 suspicious",
    confidence: 94,
    ms: 480,
    tools: ["scoreCredibility()"],
  },
  {
    agent: "Crisis Classifier",
    input: "Top 36 signals @ F-10 cluster",
    reasoning:
      "Compared Flood vs Water Main Burst hypotheses. Multi-modal evidence (rainfall + sensor + 112 calls) favors Flood @ 92%.",
    output: "CRS-001: Flood, severity 9, 92%",
    confidence: 92,
    ms: 760,
    tools: ["classify()", "compareHypotheses()"],
  },
  {
    agent: "Impact Predictor",
    input: "CRS-001",
    reasoning:
      "GIS overlay + population density + drainage model → 2.4 km radius, 48.2k affected.",
    output: "Radius 2.4km, pop 48,200, peak 42 min",
    confidence: 88,
    ms: 540,
    tools: ["gisOverlay()", "popDensity()"],
  },
  {
    agent: "Resource Allocator",
    input: "Crises CRS-001..005, available pool",
    reasoning:
      "Priority by severity × pop × time-criticality. CRS-001 wins ambulance pool over CRS-003 (sev 9 vs 6).",
    output: "Plan v3: 6 amb, 4 rescue, 3 drone",
    confidence: 90,
    ms: 610,
    tools: ["allocate()", "tradeoff()"],
  },
  {
    agent: "Notifier",
    input: "Plan v3 + CRS-001",
    reasoning:
      "Drafted 6 stakeholder messages (Urdu/EN public + emergency + hospital + utility + transport + media).",
    output: "6 notifications dispatched",
    confidence: 97,
    ms: 380,
    tools: ["draftAlert()", "translate()", "send()"],
  },
  {
    agent: "AQISensorAgent",
    input: "3 PEPA sensors F-7",
    reasoning: "PM2.5 >150 µg/m³ simultaneous crossing — cluster classification — conf 62%",
    output: "Air quality crisis candidate",
    confidence: 88,
    ms: 290,
    tools: ["clusterAQI()"],
  },
  {
    agent: "CompoundRiskAgent",
    input: "I-8 heat + F-7 plume boundary",
    reasoning: "Heat 47°C / 68% RH + PM2.5 142 at boundary — hospitalization risk 2.3×",
    output: "Vulnerable pop 3,200 → 4,100",
    confidence: 86,
    ms: 410,
    tools: ["compoundModel()"],
  },
  {
    agent: "DustStormForecastAgent",
    input: "PMD advisory + WRF wind",
    reasoning: "Arrival confidence 61% → 79% — M-2 + airport advisories pre-drafted",
    output: "Monitoring crisis crisis-rwp-004",
    confidence: 79,
    ms: 360,
    tools: ["forecastDust()"],
  },
];

/** Matches FastAPI CrisisDossier JSON (subset used in mobile UI). */

export type CrisisStatusApi = "active" | "monitoring" | "resolved" | "false_alarm";

export interface ClassificationApi {
  category: string;
  confidence: number;
  rationale: string;
}

export interface SeverityApi {
  score: number;
  factors: string[];
  weather_note: string | null;
}

export interface FusedSignalApi {
  id: string;
  summary: string;
  lat: number;
  lon: number;
  region: string;
  confidence: number;
  fused_severity_hint: number;
}

export interface ResourceUnitApi {
  resource_id: string;
  name: string;
  quantity_available: number;
}

export interface ResourcePoolItemApi {
  type: string;
  icon: string;
  total: number;
  deployed: number;
  healthImpact?: string;
}

export interface ResourceInventoryApi {
  region: string;
  updatedAt: string;
  units: ResourceUnitApi[];
  items: ResourcePoolItemApi[];
  sources?: { curated: number; openstreetmap: number };
}

export interface AllocationApi {
  units: ResourceUnitApi[];
  notes: string;
}

export interface CrisisDossierApi {
  crisis_id: string;
  status: CrisisStatusApi;
  fused: FusedSignalApi[];
  classification: ClassificationApi;
  severity: SeverityApi;
  allocation: AllocationApi;
  notifications: { channel: string; title: string; body: string }[];
  created_at: string;
  meta?: Record<string, unknown>;
}

/** Mirrors backend `LiveCrisisMockBundle` — deterministic rehearsal payload from `GET .../crises/mock/live`. */
export interface LiveCrisisMockBundleApi {
  scenario_id: string;
  label: string;
  generated_at: string;
  source: string;
  crises: CrisisDossierApi[];
}

export interface SignalApi {
  id: string;
  source: string;
  kind: string;
  text: string;
  lat: number;
  lon: number;
  region: string;
  severity_hint: number;
  recorded_at: string;
  payload?: Record<string, unknown>;
}

export type {
  AntigravityTraceStepApi,
  AuditLogEntryApi,
  SignalCredibilityApi,
  SimulatedActionApi,
} from "./metaTypes";

/** JSON shapes returned by FastAPI (`snake_case`). */

export type CrisisStatusApi = "active" | "monitoring" | "resolved";

export interface FusedSignalApi {
  id: string;
  source_ids: string[];
  kind: string;
  summary: string;
  lat: number;
  lon: number;
  region: string;
  confidence: number;
  fused_severity_hint: number;
  window_start: string;
  window_end: string;
}

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

export interface ResourceUnitApi {
  resource_id: string;
  name: string;
  kind: string;
  quantity_available: number;
  lat: number;
  lon: number;
  eta_minutes_estimate: number | null;
}

export interface AllocationApi {
  units: ResourceUnitApi[];
  notes: string;
}

export interface NotificationApi {
  channel: string;
  title: string;
  body: string;
  recipients_hint: string;
}

export interface CrisisDossierApi {
  crisis_id: string;
  status: CrisisStatusApi;
  fused: FusedSignalApi[];
  classification: ClassificationApi;
  severity: SeverityApi;
  allocation: AllocationApi;
  notifications: NotificationApi[];
  weather_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;
}

export interface PipelineRunBody {
  include_weather?: boolean;
  use_llm_classifier?: boolean;
}

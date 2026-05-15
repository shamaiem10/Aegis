/** Subset of backend `meta` used by orchestration / simulation UI. */

export interface AntigravityTraceStepApi {
  agent: string;
  phase: string;
  detail: string;
  inputs_summary?: string;
  outputs_summary?: string;
  confidence?: number | null;
  flags?: string[];
}

export interface SimulatedActionApi {
  action_id: string;
  before_state: string;
  response_action: string;
  expected_after_state: string;
  response_time_improvement_min?: number | null;
  congestion_impact?: string;
  resource_cost_units?: number | null;
  possible_side_effects?: string[];
}

export interface SignalCredibilityApi {
  signal_id: string;
  credibility: number;
  geolocation_confidence?: number;
  flags?: string[];
}

export interface AuditLogEntryApi {
  ts: string;
  event: string;
  [k: string]: unknown;
}

/** Shared agent output shapes — persisted under Firestore `agentArtifacts/{id}`. */

export type AgentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ActionPlanPhase = {
  name: string;
  actions: string[];
  owner: string;
  etaMin: number;
};

export type ActionPlanResult = {
  crisisId: string;
  signalId?: string;
  phases: ActionPlanPhase[];
  resourceNeeds?: string[];
  risks?: string[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

export type AlertTriageResult = {
  signalId: string;
  disposition: 'escalate' | 'monitor' | 'dismiss_candidate';
  priority: AgentPriority;
  confidencePct: number;
  headline: string;
  rationale: string;
  recommendedNextSteps: string[];
  assignTo: string[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

export type CrisisAnalysisResult = {
  crisisId: string;
  signalId?: string;
  hypothesis: string;
  evidence: string[];
  gaps: string[];
  recommendedActions: string[];
  stakeholderAlerts: { audience: string; message: string; urgency: AgentPriority }[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

export type AgentArtifactBundle = {
  signalId?: string;
  crisisId?: string;
  triage?: AlertTriageResult;
  analysis?: CrisisAnalysisResult;
  actionPlan?: ActionPlanResult;
  updatedAt: string;
  degradedAgents: string[];
};

export type FlatSignalInput = {
  id: string;
  source?: string;
  kind?: string;
  text?: string;
  lat?: number;
  lon?: number;
  region?: string;
  severity_hint?: number;
  recorded_at?: string;
  payload?: Record<string, unknown>;
};

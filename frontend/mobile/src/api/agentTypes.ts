/** Agent outputs from cloud-run `/api/v1/agents` (mirrors server types). */

export type AgentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ActionPlanTask = {
  taskId: string;
  title: string;
  priority: AgentPriority;
  etaMinutes: number | null;
  etaLabel: string;
  impactScore: number;
  owner: string;
  category: string;
  rationale: string;
  iconHint?: string;
};

export type ActionPlanResult = {
  crisisId: string;
  signalId?: string;
  summary: string;
  totalEtaMinutes: number;
  tasks: ActionPlanTask[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

export type AlertTriageResult = {
  signalId: string;
  disposition: "escalate" | "monitor" | "dismiss_candidate";
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
  executiveSummary: string;
  keyRisks: string[];
  affectedDomains: string[];
  coordinationNotes: string[];
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

export type AgentApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

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
  assignedResourceId?: string;
};

export type ActionPlanResult = {
  crisisId: string;
  signalId?: string;
  summary: string;
  totalEtaMinutes: number;
  tasks: ActionPlanTask[];
  contextual?: ContextualAlertPlan;
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

export type AlertPriorityRank = {
  signalId: string;
  headline: string;
  priority: AgentPriority;
  rank: number;
  score: number;
  rationale: string;
};

export type ResourceAssignment = {
  resourceId: string;
  resourceName: string;
  quantity: number;
  assignedToSignalId: string;
  rationale: string;
};

export type ContextualAlertPlan = {
  focusSignalId: string;
  crisisId: string;
  focusPriority: AgentPriority;
  focusRank: number;
  globalPrioritization: AlertPriorityRank[];
  recommendations: string[];
  resourceAssignments: ResourceAssignment[];
  competingAlertsNote: string;
  degradedMode: boolean;
};

export type AgentArtifactBundle = {
  signalId?: string;
  crisisId?: string;
  triage?: AlertTriageResult;
  analysis?: CrisisAnalysisResult;
  actionPlan?: ActionPlanResult;
  contextual?: ContextualAlertPlan;
  updatedAt: string;
  degradedAgents: string[];
};

export type AgentApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export type AiSeverityDimension = {
  value: number;
  sub: string;
  recommendation: string;
};

export type AiSeverityIndexResult = {
  heat: AiSeverityDimension;
  air: AiSeverityDimension;
  flood: AiSeverityDimension;
  overallRiskScore: number;
  countrySummary: string;
  recommendations: string[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

export type ResourceScenarioAdjustment = {
  resourceId: string;
  name: string;
  quantityDelta: number;
  newQuantityAvailable?: number;
};

export type HighPriorityImpact = {
  signalId: string;
  headline: string;
  priorityBefore: string;
  priorityAfter: string;
  impact: string;
};

export type FalseAlarmAction = "CONFIRM" | "VERIFY_FIRST" | "RETRACT";

export type FalseAlarmCheckItem = {
  signalId: string;
  crisisId?: string;
  title: string;
  recommendedAction: FalseAlarmAction;
  reason: string;
  confidencePct: number;
  credibilityScore: number;
  corroborationCount: number;
  impactIfSent: string;
  operatorStatus: "pending" | "confirmed_false_alarm" | "cleared";
  source?: string;
  region?: string;
};

export type FalseAlarmScreenResult = {
  checks: FalseAlarmCheckItem[];
  queue: FalseAlarmCheckItem[];
  screenedCount: number;
  falseAlarmCount: number;
  verifyCount: number;
  degradedMode: boolean;
  degradedAgents: string[];
  generatedAt: string;
  agentName: string;
};

export type StakeholderDraftResult = {
  crisisId: string;
  signalId: string;
  drafts: { audienceType: string; title: string; body: string; urduText?: string }[];
  alertIds: string[];
  degradedMode: boolean;
  degradedAgents: string[];
  generatedAt: string;
  agentName: string;
};

export type CrisisSimulationResult = {
  focusSignalId: string;
  focusHeadline: string;
  focusAlertBefore: string;
  focusAlertAfter: string;
  focusPriorityBefore: string;
  focusPriorityAfter: string;
  focusResponseBefore: string;
  focusResponseAfter: string;
  crisisImpactSummary: string;
  overallRiskBefore: number;
  overallRiskAfter: number;
  highPriorityImpacts: HighPriorityImpact[];
  resourceNotes: { resourceId: string; name: string; note: string }[];
  recommendedActions: string[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

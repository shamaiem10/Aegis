import type { AgentPriority } from './types';

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

/** Mobile-aligned action plan task (cloud-run → Expo). */
export type MobileActionPlanTask = {
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

export type MobileActionPlanResult = {
  crisisId: string;
  signalId?: string;
  summary: string;
  totalEtaMinutes: number;
  tasks: MobileActionPlanTask[];
  resourceNeeds?: string[];
  risks?: string[];
  degradedMode: boolean;
  generatedAt: string;
  agentName: string;
};

export type MobileCrisisAnalysisResult = {
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

export type ContextualAlertPlanResult = {
  focusSignalId: string;
  crisisId: string;
  focusPriority: AgentPriority;
  focusRank: number;
  globalPrioritization: AlertPriorityRank[];
  triage: import('./types').AlertTriageResult;
  analysis: MobileCrisisAnalysisResult;
  actionPlan: MobileActionPlanResult;
  recommendations: string[];
  resourceAssignments: ResourceAssignment[];
  competingAlertsNote: string;
  degradedMode: boolean;
  degradedAgents: string[];
  generatedAt: string;
  agentName: string;
};

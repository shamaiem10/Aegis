export type FalseAlarmAction = 'CONFIRM' | 'VERIFY_FIRST' | 'RETRACT';

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
  operatorStatus: 'pending' | 'confirmed_false_alarm' | 'cleared';
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

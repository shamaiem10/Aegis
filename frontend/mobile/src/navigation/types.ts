import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Dashboard: undefined;
  Alerts: undefined;
  FalseAlarm: undefined;
  Agents: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AlertAnalysis: { signalId?: string };
  ActionPlan: { signalId?: string; crisisId?: string };
  SimulationLive: { signalId?: string; initialActionId?: string } | undefined;
  DemoMap: undefined;
  SignalsFeed: undefined;
  Crises: undefined;
  CrisisDetail: { id: string };
  Resources: undefined;
  EmergencyResources: undefined;
  Operations: undefined;
  AgentTraces: undefined;
  Integrations: undefined;
  Settings: undefined;
  Weather: undefined;
  /** Pipeline action simulation (former bottom tab). */
  SimulationOverview: undefined;
  Predictions: undefined;
};

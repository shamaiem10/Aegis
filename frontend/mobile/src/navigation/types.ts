import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Dashboard: undefined;
  Alerts: undefined;
  Simulation: undefined;
  Agents: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AlertAnalysis: { signalId?: string };
  ActionPlan: undefined;
  SimulationLive: undefined;
  DemoMap: undefined;
  SignalsFeed: undefined;
  Crises: undefined;
  CrisisDetail: { id: string };
  Resources: undefined;
  Operations: undefined;
  AgentTraces: undefined;
  Integrations: undefined;
  Settings: undefined;
  Weather: undefined;
  FalseAlarm: undefined;
  Predictions: undefined;
};

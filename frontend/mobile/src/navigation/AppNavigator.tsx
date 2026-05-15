import { useMemo } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { MainTabNavigator } from "./MainTabNavigator";
import { DemoMapScreen } from "../screens/DemoMapScreen";
import { SignalsFeedScreen } from "../screens/SignalsFeedScreen";
import { CrisesScreen } from "../screens/CrisesScreen";
import { CrisisDetailScreen } from "../screens/CrisisDetailScreen";
import { ResourcesScreen } from "../screens/ResourcesScreen";
import { OperationsScreen } from "../screens/OperationsScreen";
import { AgentTracesScreen } from "../screens/AgentTracesScreen";
import { IntegrationsScreen } from "../screens/IntegrationsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { WeatherScreen } from "../screens/WeatherScreen";
import { FalseAlarmScreen } from "../screens/FalseAlarmScreen";
import { PredictionsScreen } from "../screens/PredictionsScreen";
import { AlertAnalysisScreen } from "../screens/AlertAnalysisScreen";
import { ActionPlanScreen } from "../screens/ActionPlanScreen";
import { SimulationLiveScreen } from "../screens/SimulationLiveScreen";
import { LandingSplashScreen } from "../screens/LandingSplashScreen";
import type { RootStackParamList } from "./types";
import { useThemeCiro } from "../theme/useThemeCiro";

const Stack = createNativeStackNavigator<RootStackParamList>();

function CriticalHeaderTitle() {
  return (
    <Text style={{ color: "#dc2626", fontSize: 11, fontWeight: "900", letterSpacing: 2.5 }}>
      CRITICAL ALERT
    </Text>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStackNavigator />
    </NavigationContainer>
  );
}

function RootStackNavigator() {
  const tc = useThemeCiro();
  const stackHeader = useMemo(
    () => ({
      headerStyle: { backgroundColor: tc.canvas },
      headerTintColor: tc.ink,
      headerTitleStyle: { fontWeight: "800" as const, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" as const },
      headerShadowVisible: false,
    }),
    [tc],
  );

  const ActionPlanHeaderTitle = useMemo(
    () =>
      function ActionPlanHeaderTitleInner() {
        return (
          <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 2.5, color: tc.ink }}>ACTION PLAN</Text>
        );
      },
    [tc.ink],
  );

  const SimulationHeaderTitle = useMemo(
    () =>
      function SimulationHeaderTitleInner() {
        return (
          <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 2.5, color: tc.ink }}>SIMULATION LIVE</Text>
        );
      },
    [tc.ink],
  );

  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        ...stackHeader,
      }}
    >
      <Stack.Screen name="Landing" component={LandingSplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="AlertAnalysis"
        component={AlertAnalysisScreen}
        options={{
          title: "",
          headerTitle: CriticalHeaderTitle,
          headerTitleAlign: "center",
          headerRight: () => (
            <Pressable hitSlop={12} style={{ paddingRight: 12 }}>
              <Ionicons name="notifications-outline" size={22} color="#dc2626" />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="ActionPlan"
        component={ActionPlanScreen}
        options={{
          title: "",
          headerTitle: ActionPlanHeaderTitle,
          headerTitleAlign: "center",
        }}
      />
      <Stack.Screen
        name="SimulationLive"
        component={SimulationLiveScreen}
        options={{
          title: "",
          headerTitle: SimulationHeaderTitle,
          headerTitleAlign: "center",
        }}
      />
      <Stack.Screen name="DemoMap" component={DemoMapScreen} options={{ title: "Live map" }} />
      <Stack.Screen name="SignalsFeed" component={SignalsFeedScreen} options={{ title: "Signal stream" }} />
      <Stack.Screen name="Crises" component={CrisesScreen} options={{ title: "Crisis panel" }} />
      <Stack.Screen
        name="CrisisDetail"
        component={CrisisDetailScreen}
        options={({ route }) => ({ title: route.params.id })}
      />
      <Stack.Screen name="Resources" component={ResourcesScreen} options={{ title: "ResourcesScreen" }} />
      <Stack.Screen name="Operations" component={OperationsScreen} options={{ title: "Pipeline" }} />
      <Stack.Screen name="AgentTraces" component={AgentTracesScreen} options={{ title: "Agent traces" }} />
      <Stack.Screen name="Integrations" component={IntegrationsScreen} options={{ title: "Integrations" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="Weather" component={WeatherScreen} options={{ title: "Weather" }} />
      <Stack.Screen name="FalseAlarm" component={FalseAlarmScreen} options={{ title: "False alarms" }} />
      <Stack.Screen name="Predictions" component={PredictionsScreen} options={{ title: "Predictions" }} />
    </Stack.Navigator>
  );
}

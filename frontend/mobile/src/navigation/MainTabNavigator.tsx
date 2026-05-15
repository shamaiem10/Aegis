import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { HomeScreen } from "../screens/HomeScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { SimulationTabScreen } from "../screens/SimulationTabScreen";
import { OrchestrationScreen } from "../screens/OrchestrationScreen";
import { ReportsTabScreen } from "../screens/ReportsTabScreen";
import type { MainTabParamList } from "./types";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { on: "home", off: "home-outline" },
  Alerts: { on: "notifications", off: "notifications-outline" },
  Simulation: { on: "star", off: "star-outline" },
  Agents: { on: "hardware-chip", off: "hardware-chip-outline" },
  Reports: { on: "document-text", off: "document-text-outline" },
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Dashboard: "Home",
  Alerts: "Alerts",
  Simulation: "Simulation",
  Agents: "Agents",
  Reports: "Reports",
};

function GlowTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tc, r, minTouch } = useAegisUi();
  const iconSize = r.isTablet ? 26 : 22;
  const lblSize = r.isTablet ? 12 : 10;
  const ring = r.isTablet ? 52 : 46;
  const bar = useMemo(() => createBarStyles(tc), [tc]);
  return (
    <View style={[bar.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = (options.tabBarLabel as string) ?? TAB_LABELS[route.name as keyof MainTabParamList];
        const icons = TAB_ICONS[route.name as keyof MainTabParamList];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            onPress={onPress}
            style={[bar.item, { minHeight: minTouch + 6, justifyContent: "flex-start", paddingTop: 4 }]}
          >
            <View style={[bar.glow, focused ? bar.glowOn : null, { width: ring, height: ring, borderRadius: ring / 2 }]}>
              <Ionicons
                name={(focused ? icons.on : icons.off) as keyof typeof Ionicons.glyphMap}
                size={iconSize}
                color={focused ? tc.accentGreen : tc.inkMuted}
              />
            </View>
            <Text
              style={[bar.lbl, focused ? bar.lblOn : null, { fontSize: lblSize }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createBarStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingTop: 10,
      backgroundColor: tc.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tc.border,
      shadowColor: "#0f172a",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 8,
    },
    item: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    glow: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    glowOn: {
      backgroundColor: tc.accentGreenSoft,
      shadowColor: tc.accentGreen,
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    lbl: {
      fontSize: 10,
      fontWeight: "700",
      color: tc.inkMuted,
      letterSpacing: 0.2,
    },
    lblOn: {
      color: tc.sageDeep,
    },
  });
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlowTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={HomeScreen} options={{ tabBarLabel: TAB_LABELS.Dashboard }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ tabBarLabel: TAB_LABELS.Alerts }} />
      <Tab.Screen name="Simulation" component={SimulationTabScreen} options={{ tabBarLabel: TAB_LABELS.Simulation }} />
      <Tab.Screen name="Agents" component={OrchestrationScreen} options={{ tabBarLabel: TAB_LABELS.Agents }} />
      <Tab.Screen name="Reports" component={ReportsTabScreen} options={{ tabBarLabel: TAB_LABELS.Reports }} />
    </Tab.Navigator>
  );
}

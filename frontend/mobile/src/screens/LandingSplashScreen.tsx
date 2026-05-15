import { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "../navigation/types";
import { useThemeCiro } from "../theme/useThemeCiro";

export function LandingSplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Landing">>();
  const insets = useSafeAreaInsets();
  const schemeDark = useColorScheme() === "dark";
  const tc = useThemeCiro();
  const styles = useMemo(() => createLandingStyles(), []);
  const gradientColors = useMemo(
    () => [tc.heroGradEnd, tc.canvas, tc.background] as [string, string, string],
    [tc],
  );
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [fade, pulse]);

  const goHome = () => {
    navigation.replace("MainTabs");
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.pressRoot, pressed && styles.pressRootPressed]}
      onPress={goHome}
      accessibilityRole="button"
      accessibilityLabel="Continue to home"
      accessibilityHint="Opens the main dashboard"
    >
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      >
        <StatusBar style={schemeDark ? "light" : "dark"} />
        <View pointerEvents="none" style={[styles.alertStripe, { backgroundColor: tc.alert }]} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topBarRow}>
            <View style={[styles.sectorPill, { backgroundColor: tc.warnSurface, borderColor: tc.alert }]}>
              <Animated.View style={[styles.liveDot, { opacity: pulse, backgroundColor: tc.alertDeep }]} />
              <Text style={[styles.sectorLbl, { color: tc.alertDeep }]}>LIVE OPERATIONS</Text>
            </View>
            <Text style={[styles.classification, { color: tc.inkMuted }]}>RESTRICTED</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.centerWrap,
            {
              paddingBottom: insets.bottom + 20,
              opacity: fade,
            },
          ]}
        >
          <View style={[styles.panel, { backgroundColor: tc.card, borderColor: tc.border }]}>
            <View style={[styles.panelAccent, { backgroundColor: tc.alertDeep }]} />
            <View style={styles.panelBody}>
              <View
                style={[
                  styles.iconFrame,
                  { borderColor: tc.border, backgroundColor: tc.warnSurface },
                ]}
              >
                <Ionicons name="warning-outline" size={40} color={tc.alertDeep} />
              </View>
              <Text style={[styles.eyebrow, { color: tc.inkMuted }]}>CRISIS ALERT & RESPONSE</Text>
              <Text style={[styles.title, { color: tc.ink }]}>AEGIS</Text>
              <Text style={[styles.subtitle, { color: tc.inkSoft }]}>
                Urban incident orchestration · Islamabad sector
              </Text>
              <View style={[styles.rule, { backgroundColor: tc.border }]} />
              <Text style={[styles.meta, { color: tc.inkMuted }]}>
                Multi-source signal fusion · Agent-assisted dispatch
              </Text>
              <View style={[styles.statusRow, { borderTopColor: tc.border }]}>
                <Text style={[styles.statusKey, { color: tc.inkMuted }]}>POSTURE</Text>
                <Text style={[styles.statusVal, { color: tc.sageDeep }]}>STANDING BY</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={[styles.footerTxt, { color: tc.inkMuted }]}>Tap anywhere to continue</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function createLandingStyles() {
  return StyleSheet.create({
    pressRoot: { flex: 1 },
    pressRootPressed: { opacity: 0.97 },
    gradient: { flex: 1 },
    alertStripe: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      opacity: 0.95,
    },
    topBar: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    topBarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectorPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 4,
      borderWidth: 1,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    sectorLbl: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.8,
    },
    classification: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
    },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    panel: {
      width: "100%",
      maxWidth: 360,
      flexDirection: "row",
      borderRadius: 4,
      overflow: "hidden",
      borderWidth: 1,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    panelAccent: {
      width: 4,
    },
    panelBody: {
      flex: 1,
      paddingVertical: 28,
      paddingHorizontal: 22,
    },
    iconFrame: {
      width: 64,
      height: 64,
      borderRadius: 4,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2.4,
      marginBottom: 8,
    },
    title: {
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 6,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    rule: {
      height: 1,
      marginVertical: 18,
    },
    meta: {
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 18,
    },
    statusRow: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 14,
      borderTopWidth: 1,
    },
    statusKey: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
    },
    statusVal: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    footer: {
      paddingHorizontal: 24,
      alignItems: "center",
    },
    footerTxt: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.4,
    },
  });
}

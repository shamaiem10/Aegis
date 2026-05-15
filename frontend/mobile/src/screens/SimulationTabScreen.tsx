import { StyleSheet, Text, View, Pressable, ScrollView, Alert, ActivityIndicator, useColorScheme } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";

import { Card, GradientHeroCard, PageHeader, Pill } from "../components/aegis/AppShell";
import { useRootStackNavigation } from "../navigation/useRootStackNavigation";
import { useAegisUi } from "../hooks/useAegisUi";
import { runScenarioPipeline, summarizeBackendError } from "../api/client";
import { useThemeCiro } from "../theme/useThemeCiro";
import { Ionicons } from "@expo/vector-icons";

export function SimulationTabScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const schemeDark = useColorScheme() === "dark";
  const rootNav = useRootStackNavigation();
  const isFocused = useIsFocused();
  const [busy, setBusy] = useState(false);

  const onRunScenario = async () => {
    try {
      setBusy(true);
      const d = await runScenarioPipeline({ merge_live_signals: false });
      Alert.alert("Scenario complete", `Dossier ${d.crisis_id} — see Agents → Traces.`);
    } catch (e) {
      Alert.alert("Scenario failed", summarizeBackendError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={[
          styles.inner,
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 8,
            paddingBottom: r.tabBarClearance,
          },
        ]}
      >
        <PageHeader
          eyebrow="Scenario lab"
          title="Simulation center"
          sub="Replay what-if flows with live posture maps and execution timelines."
          right={<Pill tone="mint">sandbox</Pill>}
        />

        <GradientHeroCard>
          <Text style={styles.recEyebrow}>Recommended</Text>
          <Text style={styles.recTitle}>Run coordinated rehearsal</Text>
          <Text style={styles.recSub}>4 staged interventions · calibrated to latest signal clusters.</Text>
          <View style={styles.recMeta}>
            <View style={styles.recMetaItem}>
              <Ionicons name="time-outline" size={15} color={tc.inkMuted} />
              <Text style={styles.recMetaTxt}>~8 min</Text>
            </View>
            <View style={styles.recMetaItem}>
              <Ionicons name="analytics-outline" size={15} color={tc.sageDeep} />
              <Text style={styles.recMetaTxt}>AI scored</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            onPress={() => rootNav.navigate("SimulationLive")}
          >
            <Text style={styles.ctaTxt}>Open simulation live</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.9 }, busy && { opacity: 0.7 }]}
            onPress={onRunScenario}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={tc.ink} />
            ) : (
              <Text style={styles.ctaSecondaryTxt}>Run dual‑crisis stress scenario</Text>
            )}
          </Pressable>
        </GradientHeroCard>

        <Card>
          <Text style={styles.sectionLabel}>Library</Text>
          <Pressable style={styles.row} onPress={() => rootNav.navigate("Operations")}>
            <Text style={styles.rowTxt}>Pipeline & dispatch graph</Text>
            <Ionicons name="chevron-forward" size={18} color={tc.inkMuted} />
          </Pressable>
          <Pressable style={styles.row} onPress={() => rootNav.navigate("DemoMap")}>
            <Text style={styles.rowTxt}>Crisis map · pins & regions</Text>
            <Ionicons name="chevron-forward" size={18} color={tc.inkMuted} />
          </Pressable>
          <Pressable style={styles.rowLast} onPress={() => rootNav.navigate("ActionPlan")}>
            <Text style={styles.rowTxt}>AI action plan</Text>
            <Ionicons name="chevron-forward" size={18} color={tc.inkMuted} />
          </Pressable>
        </Card>
      </ScrollView>
    </>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.canvas },
    inner: {},
    recEyebrow: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.sageDeep,
      textTransform: "uppercase",
    },
    recTitle: { marginTop: 8, fontSize: 20, fontWeight: "800", color: tc.ink },
    recSub: { marginTop: 6, fontSize: 14, color: tc.inkSoft, lineHeight: 20, fontWeight: "600" },
    recMeta: { flexDirection: "row", marginTop: 12, gap: 16, flexWrap: "wrap" },
    recMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    recMetaTxt: { fontSize: 12, fontWeight: "700", color: tc.inkMuted },
    cta: {
      marginTop: 18,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: tc.accentGreen,
      alignItems: "center",
      shadowColor: tc.accentGreen,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    ctaTxt: { fontSize: 14, fontWeight: "900", color: "#fff", letterSpacing: 0.3 },
    ctaSecondary: {
      marginTop: 10,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: tc.border,
      backgroundColor: tc.canvas,
      alignItems: "center",
    },
    ctaSecondaryTxt: { fontSize: 13, fontWeight: "900", color: tc.ink },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.inkMuted,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tc.border,
    },
    rowLast: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    rowTxt: { flex: 1, fontSize: 15, fontWeight: "700", color: tc.ink },
  });
}

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";

import { Card, PageHeader } from "../components/aegis/AppShell";
import { DEMO_ORCHESTRATION_META } from "../data/demoOrchestrationMeta";
import { useAegisUi } from "../hooks/useAegisUi";
import { getAQIColor } from "../utils/aqi";

export function PredictionsScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";
  const pe = DEMO_ORCHESTRATION_META.prediction_engine as {
    f7_aqi?: Record<string, unknown>;
    dust?: Record<string, unknown>;
    scenario_branching?: {
      tab_a: { label: string; peak_aqi: number; below_200_by: string };
      tab_b: { label: string; peak_aqi: number; below_200_by: string };
    };
  };
  const [scenario, setScenario] = useState<"a" | "b">("a");
  const branch = pe?.scenario_branching;

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.background }]}
      contentContainerStyle={[
        contentWrap,
        styles.inner,
        { paddingHorizontal: r.horizontalPad, paddingTop: r.insets.top + 8 },
      ]}
    >
      <PageHeader
        eyebrow="Intelligence"
        title="Prediction engine"
        sub="F-7 AQI + dust corridor — mock projections from bundled orchestration meta."
      />

      <Card style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <Text style={[styles.section, { color: tc.inkMuted }]}>F-7 AQI timeline (conceptual)</Text>
        <Text style={[styles.body, { color: tc.ink }]}>Peak band: {String(pe?.f7_aqi?.peak_aqi_band ?? "—")}</Text>
        <Text style={[styles.sub, { color: tc.inkSoft }]}>
          Peak in ~{String(pe?.f7_aqi?.peak_in_min ?? "—")} min · Unhealthy+ duration {String(pe?.f7_aqi?.unhealthy_duration_h ?? "—")}h
        </Text>
        <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 8 }]}>
          Spread: {JSON.stringify(pe?.f7_aqi?.spread_radius_km ?? {})}
        </Text>
        <Text style={[styles.sub, { color: tc.inkSoft }]}>{String(pe?.f7_aqi?.recovery_note ?? "")}</Text>
        <View style={{ marginTop: 12 }}>
          {(pe?.f7_aqi?.events as { t_offset_h: number; label: string; aqi_proj: number }[] | undefined)?.map((e, i) => (
            <Text key={i} style={[styles.bullet, { color: getAQIColor(e.aqi_proj, schemeDark) }]}>
              +{e.t_offset_h}h event: {e.label} → AQI ~{e.aqi_proj}
            </Text>
          ))}
        </View>
      </Card>

      <Card style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <Text style={[styles.section, { color: tc.inkMuted }]}>Dust storm (Rawalpindi corridor)</Text>
        <Text style={[styles.body, { color: tc.ink }]}>Peak PM10: {String(pe?.dust?.peak_pm10)}</Text>
        <Text style={[styles.sub, { color: tc.inkSoft }]}>Min visibility: {String(pe?.dust?.min_visibility_m)}</Text>
        <Text style={[styles.sub, { color: tc.inkSoft }]}>Recovery: {String(pe?.dust?.recovery_visibility_h)}</Text>
        <Text style={[styles.sub, { color: tc.amberDeep, marginTop: 10 }]}>{String(pe?.dust?.cascade ?? "")}</Text>
      </Card>

      {branch ? (
        <Card style={[styles.card, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <Text style={[styles.section, { color: tc.inkMuted }]}>Scenario branching (factory outcome)</Text>
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setScenario("a")}
              style={[styles.tab, scenario === "a" && { backgroundColor: tc.tealSoft, borderColor: tc.tealDeep }]}
            >
              <Text style={{ fontWeight: "900", color: tc.ink, fontSize: 12 }}>Tab A</Text>
            </Pressable>
            <Pressable
              onPress={() => setScenario("b")}
              style={[styles.tab, scenario === "b" && { backgroundColor: tc.warnSurface, borderColor: tc.amber }]}
            >
              <Text style={{ fontWeight: "900", color: tc.ink, fontSize: 12 }}>Tab B</Text>
            </Pressable>
          </View>
          <Text style={[styles.body, { color: tc.ink, marginTop: 12 }]}>
            {scenario === "a" ? branch.tab_a.label : branch.tab_b.label}
          </Text>
          <Text style={[styles.sub, { color: tc.inkSoft }]}>
            Peak AQI ~{scenario === "a" ? branch.tab_a.peak_aqi : branch.tab_b.peak_aqi} — below 200 by{" "}
            {scenario === "a" ? branch.tab_a.below_200_by : branch.tab_b.below_200_by}
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { paddingBottom: 48 },
  card: { marginBottom: 14, borderWidth: 1, padding: 14 },
  section: { fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  body: { fontSize: 15, fontWeight: "800" },
  sub: { fontSize: 13, fontWeight: "600", marginTop: 6, lineHeight: 19 },
      bullet: { fontSize: 13, fontWeight: "700", marginTop: 6 },
  tabRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  tab: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center" },
});

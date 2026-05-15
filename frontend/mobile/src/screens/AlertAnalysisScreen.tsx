import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { listSignals } from "../api/client";
import type { SignalApi } from "../api/types";
import { Card, ConfidenceBar, SourcePill, ActionFooter } from "../components/aegis/AppShell";
import { DEMO_ORCHESTRATION_META } from "../data/demoOrchestrationMeta";
import { useAegisUi } from "../hooks/useAegisUi";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeCiro } from "../theme/useThemeCiro";
import { alertIconForSignal } from "../utils/alertIcons";

type Props = NativeStackScreenProps<RootStackParamList, "AlertAnalysis">;

const DEMO = {
  title: "Urban Flooding Detected",
  region: "G-10 · Islamabad",
  time: "3 min ago",
  confidence: 94,
};

function formatShortAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return DEMO.time;
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m <= 0) return "just now";
  if (m === 1) return "1 min ago";
  return `${m} min ago`;
}

export function AlertAnalysisScreen({ navigation, route }: Props) {
  const { signalId } = route.params ?? {};
  const [signal, setSignal] = useState<SignalApi | null>(null);
  const { r, tc, contentWrap } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";

  const load = useCallback(async () => {
    if (!signalId) {
      setSignal(null);
      return;
    }
    try {
      const all = await listSignals();
      setSignal(all.find((s) => s.id === signalId) ?? null);
    } catch {
      setSignal(null);
    }
  }, [signalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayTitle =
    signal?.text && signal.text.length > 0
      ? signal.text.slice(0, 80) + (signal.text.length > 80 ? "…" : "")
      : DEMO.title;
  const regionLine = signal?.region ? signal.region.replace(/\s+corridor$/i, "").trim() : DEMO.region.split(" · ")[0];
  const cityLine = "Islamabad";
  const timeLine = signal ? formatShortAgo(signal.recorded_at) : DEMO.time;
  const cred = typeof signal?.payload?.credibility_pct === "number" ? signal.payload.credibility_pct : null;
  const confidencePct =
    cred != null ? Math.min(99, Math.max(5, cred)) : signal
      ? Math.min(99, Math.max(40, 60 + signal.severity_hint * 4))
      : DEMO.confidence;
  const metaLine = `${regionLine} · ${cityLine} · ${timeLine}`;

  const stackHero = r.isCompact || r.width < 400;
  const iconRing = r.isCompact ? 60 : r.width < 430 ? 64 : 72;
  const iconGlyph = r.isCompact ? 26 : 30;
  const heroIcon = signal ? alertIconForSignal(signal.kind, signal.text) : ("water-outline" as const);

  const linked = (signal?.payload?.linked_crisis_id as string | undefined) ?? "";
  const isF7 = linked === "crisis-f7-003" || displayTitle.toLowerCase().includes("f-7") || displayTitle.includes("PM2.5");
  const flags = signal?.payload?.flags as string[] | undefined;
  const showContradiction =
    flags?.includes("contradiction") ||
    flags?.includes("suspicious") ||
    (cred != null && cred < 25 && linked === "crisis-f7-003");

  const breakdown = DEMO_ORCHESTRATION_META.source_breakdown_f7 as
    | { source: string; count: number; avg_credibility: number }[]
    | undefined;
  const hc = DEMO_ORCHESTRATION_META.hypothesis_conflict as Record<string, unknown> | undefined;
  const leaderboard = DEMO_ORCHESTRATION_META.source_trust_leaderboard as
    | { rank: number; source: string; avg_credibility: number }[]
    | undefined;

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        styles.inner,
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: 8,
          paddingBottom: r.insets.bottom + 96,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={[styles.hero, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <View style={[styles.heroTop, stackHero && styles.heroTopStack]}>
          <View
            style={[
              styles.heroIconRing,
              stackHero && styles.heroIconRingStacked,
              {
                width: iconRing,
                height: iconRing,
                borderRadius: iconRing / 2,
                backgroundColor: isF7 ? (schemeDark ? "#3b0764" : "#f3e8ff") : "#fee2e2",
                borderColor: isF7 ? "#7c3aed" : "#fecaca",
              },
            ]}
          >
            <Ionicons name={heroIcon} size={iconGlyph} color={isF7 ? "#7c3aed" : tc.alertDeep} />
          </View>
          <View style={[styles.heroTextCol, stackHero && styles.heroTextColStacked]}>
            <Text
              style={[styles.heroTitle, { fontSize: r.titleSize(20), color: tc.ink }, stackHero && styles.heroTitleCenter]}
              maxFontSizeMultiplier={1.35}
            >
              {displayTitle}
            </Text>
            <Text
              style={[styles.meta, { fontSize: r.bodySize(13), color: tc.inkSoft }, stackHero && styles.metaCenter]}
              maxFontSizeMultiplier={1.35}
            >
              {metaLine}
            </Text>
          </View>
        </View>
        <ConfidenceBar value={confidencePct} />
        <Text style={[styles.blockLabel, { fontSize: r.bodySize(10), color: tc.inkMuted }]} maxFontSizeMultiplier={1.35}>
          Detected from
        </Text>
        <View style={styles.pillRow}>
          {isF7 ? (
            <>
              <SourcePill iconName="analytics-outline" label="PEPA Sensor Network" />
              <SourcePill iconName="cloud-outline" label="PMD / WeatherAPI" />
              <SourcePill iconName="globe-outline" label="Satellite Imagery" />
              <SourcePill iconName="chatbubbles-outline" label="Social Media" />
              <SourcePill iconName="medkit-outline" label="Hospital Reports" />
            </>
          ) : (
            <>
              <SourcePill iconName="chatbubbles-outline" label="Social Media" />
              <SourcePill iconName="cloud-outline" label="Weather API" />
              <SourcePill iconName="git-network-outline" label="Traffic Data" />
            </>
          )}
        </View>

        {isF7 && breakdown ? (
          <>
            <Text style={[styles.blockLabel, { color: tc.inkMuted }]}>Source breakdown (F-7)</Text>
            {breakdown.map((row) => (
              <Text key={row.source} style={[styles.impact, { color: tc.ink }]}>
                {row.source}: {row.count} signals · avg cred {(row.avg_credibility * 100).toFixed(0)}%
              </Text>
            ))}
          </>
        ) : null}

        {showContradiction ? (
          <Card style={{ marginTop: 14, padding: 12, backgroundColor: schemeDark ? "#422006" : "#fff7ed" }}>
            <Text style={{ fontSize: 13, fontWeight: "900", color: schemeDark ? "#fdba74" : "#9a3412" }}>
              Contradiction panel — Hypothesis A (dominant): Industrial emissions — 14 signals avg 83%. Hypothesis B:
              cross-border/seasonal smog — 4 signals avg 61%.
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12, fontWeight: "600", color: tc.ink }}>
              Resolution: PEPA satellite stack confirmation pending ~20 min.
            </Text>
          </Card>
        ) : null}

        {isF7 && leaderboard ? (
          <>
            <Text style={[styles.blockLabel, { color: tc.inkMuted }]}>Source trust leaderboard</Text>
            {leaderboard.map((L) => (
              <Text key={L.rank} style={[styles.impact, { color: tc.ink }]}>
                {L.rank}. {L.source} — {(L.avg_credibility * 100).toFixed(0)}%
              </Text>
            ))}
          </>
        ) : null}

        {hc && isF7 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.blockLabel, { color: tc.inkMuted }]}>Conflicting hypothesis (meta)</Text>
            <Text style={[styles.subTxt, { color: tc.inkSoft }]}>
              {String((hc as { resolution?: string }).resolution ?? "")}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.blockLabel, { color: tc.inkMuted }]}>Impact analysis</Text>
        <Text style={[styles.impact, { color: tc.ink }]}>
          Roads blocked: <Text style={[styles.impactStrong, { color: tc.ink }]}>7 segments</Text>
        </Text>
        <Text style={[styles.impact, { color: tc.ink }]}>
          Vehicles stranded: <Text style={[styles.impactStrong, { color: tc.ink }]}>~120</Text>
        </Text>
        <Text style={[styles.impact, { color: tc.ink }]}>
          Response delay risk: <Text style={[styles.impactHigh, { color: tc.alertDeep }]}>High</Text>
        </Text>

        {isF7 ? (
          <Pressable onPress={() => navigation.navigate("Predictions")} style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: "900", color: tc.tealDeep }}>Open prediction engine →</Text>
          </Pressable>
        ) : null}
      </Card>

      <ActionFooter
        secondaryLabel="Analyze"
        onSecondary={() => navigation.navigate("ActionPlan")}
        primaryLabel="Trigger Sim"
        onPrimary={() => navigation.navigate("SimulationLive")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { paddingTop: 12 },
  hero: { borderWidth: 1 },
  heroTop: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 4 },
  heroTopStack: { flexDirection: "column", alignItems: "center", gap: 12 },
  heroIconRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#dc2626",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroTitle: { fontWeight: "800", letterSpacing: -0.4 },
  meta: { marginTop: 6, fontWeight: "600" },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroTextColStacked: { width: "100%", alignItems: "center" },
  heroIconRingStacked: { alignSelf: "center" },
  heroTitleCenter: { textAlign: "center", alignSelf: "stretch" },
  metaCenter: { textAlign: "center", alignSelf: "stretch" },
  blockLabel: {
    marginTop: 18,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  impact: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  impactStrong: { fontWeight: "900" },
  impactHigh: { fontWeight: "900" },
  subTxt: { fontSize: 12, marginTop: 6, lineHeight: 18 },
});

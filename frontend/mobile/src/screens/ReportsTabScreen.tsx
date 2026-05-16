import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused, useNavigation, useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { Card, GradientHeroCard } from "../components/aegis/AppShell";
import { useAegisUi } from "../hooks/useAegisUi";
import { fetchLatestDossier, summarizeBackendError } from "../api/client";
import { useThemeCiro } from "../theme/useThemeCiro";

const BARS = [88, 76, 62, 48, 34, 22];

import { usePendingAlerts } from "../../lib/firestore/hooks";
import { approveAndDispatchAlert } from "../../lib/api/gateway";

export function ReportsTabScreen() {
  const schemeDark = useColorScheme() === "dark";
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const nav = useNavigation();
  const isFocused = useIsFocused();
  const { data: stakeholders, loading } = usePendingAlerts();

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
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} style={styles.topBarSide} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={tc.ink} />
          </Pressable>
          <Text style={styles.topTitle}>OUTCOME REPORT</Text>
          <Pressable style={styles.topBarSide} hitSlop={12} onPress={() => {}}>
            <Ionicons name="download-outline" size={22} color={tc.ink} />
          </Pressable>
        </View>

        <GradientHeroCard style={styles.missionCard}>
          <View style={[styles.checkRing, { borderColor: tc.sageDeep, backgroundColor: tc.card }]}>
            <Ionicons name="checkmark-circle" size={28} color={tc.sageDeep} />
          </View>
          <Text style={[styles.missionEyebrow, { color: tc.sageDeep }]}>Mission outcome</Text>
          <Text style={styles.impact}>63% Impact Reduction</Text>
        </GradientHeroCard>

        <Card style={{ backgroundColor: tc.card, borderColor: tc.border, borderWidth: 1 }}>
          <Text style={styles.cardTitle}>Stakeholder alerts</Text>
          <Text style={styles.cardHint}>
            Pending alerts waiting for operator approval.
          </Text>
          {loading && stakeholders.length === 0 ? (
            <Text style={styles.stakeEmpty}>Loading alerts...</Text>
          ) : stakeholders.length === 0 ? (
            <Text style={styles.stakeEmpty}>No pending alerts.</Text>
          ) : (
            stakeholders.map((s, i) => (
              <View
                key={`${s.id}-${i}`}
                style={[styles.stakeBlock, { borderColor: tc.border, backgroundColor: tc.muted }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.stakeAud}>{s.channel ?? "All"}</Text>
                  {s.status === "pending_approval" || s.status === "pending" ? (
                    <Pressable
                      onPress={() => approveAndDispatchAlert(s.id).catch(console.warn)}
                      style={{ backgroundColor: tc.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>Approve</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ fontSize: 11, color: tc.inkSoft }}>{s.status}</Text>
                  )}
                </View>
                <Text style={styles.stakeTitle}>Severity {s.severity}</Text>
                <Text style={styles.stakeBody}>{s.message}</Text>
              </View>
            ))
          )}
        </Card>

        <Card style={{ backgroundColor: tc.card, borderColor: tc.border, borderWidth: 1 }}>
          <Text style={styles.cardTitle}>Congestion Reduction</Text>
          <Text style={styles.cardHint}>last 60 minutes</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.congDelta}>↘ -63%</Text>
          </View>
          <View style={styles.chart}>
            {BARS.map((h, i) => (
              <LinearGradient
                key={i}
                colors={["#ef4444", "#22c55e"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.bar, { height: Math.max(14, Math.round((h / 100) * 104)) }]}
              />
            ))}
          </View>
        </Card>

        <View style={styles.metricRow}>
          <Card style={[styles.metricCard, { backgroundColor: tc.card, borderColor: tc.border, borderWidth: 1 }]}>
            <Text style={styles.metricLbl}>Response time</Text>
            <Text style={styles.metricVal}>4.2 min</Text>
            <Text style={[styles.metricDelta, { color: tc.sageDeep }]}>↓ 41% faster</Text>
            <MiniSpark tc={tc} />
          </Card>
          <Card style={[styles.metricCard, { backgroundColor: tc.card, borderColor: tc.border, borderWidth: 1 }]}>
            <Text style={styles.metricLbl}>Risk mitigation</Text>
            <View style={[styles.ringWrap, { borderColor: tc.accentGreen }]}>
              <Text style={styles.ringNum}>87</Text>
            </View>
            <Text style={[styles.metricDelta, { color: tc.sageDeep }]}>Score Excellent</Text>
          </Card>
        </View>

        <LinearGradient
          colors={schemeDark ? ["rgba(14,165,233,0.15)", "rgba(34,211,238,0.08)"] : ["rgba(14,165,233,0.12)", "rgba(34,211,238,0.06)"]}
          style={[styles.insight, { borderColor: tc.border }]}
        >
          <View style={styles.insightHead}>
            <Ionicons name="bulb-outline" size={18} color={tc.primary} />
            <Text style={styles.insightTitle}>AI Insight</Text>
          </View>
          <Text style={styles.insightBody}>
            Early traffic redirection within 2 minutes of the alert cut peak congestion across three adjacent sectors.
            Notification batching reduced bystander saturation on arterial exits while keeping hospital access intact.
          </Text>
        </LinearGradient>
      </ScrollView>
    </>
  );
}

function MiniSpark({ tc }: { tc: ReturnType<typeof useThemeCiro> }) {
  return (
    <View style={spark.row}>
      {[4, 7, 5, 9, 8, 12].map((h, i) => (
        <View key={i} style={[spark.bar, { height: h, backgroundColor: tc.accentGreen }]} />
      ))}
    </View>
  );
}

const spark = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    marginTop: 10,
    height: 32,
  },
  bar: { width: 5, borderRadius: 3 },
});

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.canvas },
    inner: {},
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    topBarSide: { width: 40, alignItems: "center", justifyContent: "center" },
    topTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 2.2,
      color: tc.ink,
    },
    missionCard: { alignItems: "center" },
    checkRing: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    missionEyebrow: {
      marginTop: 12,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    impact: {
      marginTop: 8,
      fontSize: 26,
      fontWeight: "900",
      color: tc.ink,
      letterSpacing: -0.8,
      textAlign: "center",
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: 8,
    },
    cardTitle: { fontSize: 15, fontWeight: "800", color: tc.ink },
    cardHint: { marginTop: 6, fontSize: 12, color: tc.inkMuted, fontWeight: "600" },
    congDelta: { fontSize: 20, fontWeight: "900", color: "#14b8a6", letterSpacing: -0.5 },
    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 120,
      marginTop: 18,
      gap: 6,
    },
    bar: {
      flex: 1,
      borderRadius: 8,
    },
    metricRow: { flexDirection: "row", gap: 10, marginTop: 6 },
    metricCard: { flex: 1, minHeight: 140, minWidth: 0 },
    metricLbl: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      color: tc.inkMuted,
      textTransform: "uppercase",
    },
    metricVal: { marginTop: 10, fontSize: 22, fontWeight: "900", color: tc.ink },
    metricDelta: { marginTop: 6, fontSize: 12, fontWeight: "800" },
    ringWrap: {
      marginTop: 12,
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 4,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
    },
    ringNum: { fontSize: 16, fontWeight: "900", color: tc.ink },
    insight: {
      marginTop: 16,
      borderRadius: 26,
      padding: 20,
      borderWidth: 1,
      overflow: "hidden",
    },
    insightHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    insightTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: tc.ink,
    },
    insightBody: {
      marginTop: 8,
      fontSize: 14,
      color: tc.inkSoft,
      lineHeight: 21,
      fontWeight: "600",
    },
    stakeBlock: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
    },
    stakeAud: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: tc.tealDeep, textTransform: "uppercase" },
    stakeCh: { marginTop: 4, fontSize: 11, fontWeight: "700", color: tc.inkMuted },
    stakeTitle: { marginTop: 8, fontSize: 15, fontWeight: "900", color: tc.ink },
    stakeBody: { marginTop: 6, fontSize: 13, color: tc.inkSoft, lineHeight: 20, fontWeight: "600" },
    stakeErr: { marginTop: 10, color: tc.alertDeep, fontWeight: "700", fontSize: 12 },
    stakeEmpty: { marginTop: 10, fontSize: 13, color: tc.inkMuted, fontStyle: "italic" },
  });
}

import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ActionPlanResult } from "../../api/agentTypes";
import type { IonName } from "../../utils/alertIcons";
import { Card, GradientHeroCard, MiniBar } from "./AppShell";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useThemeCiro } from "../../theme/useThemeCiro";

const PRI_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#2563eb",
  LOW: "#16a34a",
};

function iconForHint(hint?: string): IonName {
  const h = (hint || "").toLowerCase();
  if (h.includes("medkit")) return "medkit-outline";
  if (h.includes("swap") || h.includes("traffic")) return "swap-horizontal-outline";
  if (h.includes("megaphone")) return "megaphone-outline";
  if (h.includes("radio")) return "radio-outline";
  if (h.includes("water")) return "water-outline";
  if (h.includes("document")) return "document-text-outline";
  return "flash-outline";
}

export function ActionPlanLayout({
  plan,
  loading,
  error,
  errorHint,
  onRetry,
}: {
  plan: ActionPlanResult | null;
  loading: boolean;
  error?: string | null;
  errorHint?: string | null;
  onRetry?: () => void;
}) {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const stackCards = r.isCompact || r.width < 400;
  const iconSz = r.isCompact ? 44 : 48;
  const glyph = r.isCompact ? 22 : 24;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tc.canvas }]}>
        <Text style={[styles.loading, { color: tc.inkSoft }]}>Generating action plan…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: tc.canvas, paddingHorizontal: r.horizontalPad }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={tc.alertDeep} />
        <Text style={[styles.emptyTitle, { color: tc.ink, marginTop: 16 }]}>Agents unavailable</Text>
        <Text style={[styles.loading, { color: tc.inkSoft }]}>{error}</Text>
        {errorHint ? (
          <Text style={[styles.hint, { color: tc.inkMuted }]}>{errorHint}</Text>
        ) : null}
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={[styles.retryBtn, { backgroundColor: tc.tealSoft, borderColor: tc.tealDeep }]}
          >
            <Text style={{ fontWeight: "800", color: tc.tealDeep }}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.centered, { backgroundColor: tc.canvas }]}>
        <Text style={[styles.emptyTitle, { color: tc.ink }]}>No action plan</Text>
        <Text style={[styles.loading, { color: tc.inkSoft }]}>
          Open from an alert to run ActionPlanAgent on cloud-run.
        </Text>
      </View>
    );
  }

  const tasks = plan.tasks ?? [];
  const totalEta =
    plan.totalEtaMinutes > 0 ? `${plan.totalEtaMinutes} min total` : "Staged rollout";

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        styles.inner,
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <GradientHeroCard style={r.isCompact ? styles.heroTight : undefined}>
        <Text style={[styles.eyebrow, { fontSize: r.bodySize(10) }]}>AI ACTION PLAN</Text>
        <Text style={[styles.title, { fontSize: r.titleSize(22) }]}>Coordinated actions</Text>
        <Text style={[styles.sub, { fontSize: r.bodySize(14) }]} numberOfLines={4}>
          {plan.summary}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="analytics-outline" size={14} color={tc.sageDeep} />
            <Text style={[styles.meta, { fontSize: r.bodySize(12) }]}>Gemini agents</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={tc.inkMuted} />
            <Text style={[styles.meta, { fontSize: r.bodySize(12) }]}>{totalEta}</Text>
          </View>
        </View>
      </GradientHeroCard>

      {tasks.map((a, i) => {
        const tint = PRI_COLORS[a.priority] ?? tc.tealDeep;
        const iconName = iconForHint(a.iconHint);
        return (
          <Card key={a.taskId || i} style={styles.item}>
            {stackCards ? (
              <View style={styles.itemStack}>
                <View style={styles.itemHeadRow}>
                  <View style={[styles.iconBlob, { backgroundColor: `${tint}22`, width: iconSz, height: iconSz }]}>
                    <Ionicons name={iconName} size={glyph} color={tint} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.pri, { color: tint }]}>{a.priority}</Text>
                    <Text style={[styles.itemTitle, { color: tc.ink }]} numberOfLines={3}>
                      {a.title}
                    </Text>
                  </View>
                </View>
                <MiniBar value={a.impactScore} color={tint} />
                <Text style={[styles.owner, { color: tc.inkSoft }]}>
                  {a.owner} · {a.etaLabel}
                </Text>
                <Text style={[styles.rationale, { color: tc.inkMuted }]}>{a.rationale}</Text>
              </View>
            ) : (
              <View style={styles.itemRow}>
                <View style={[styles.iconBlob, { backgroundColor: `${tint}22`, width: iconSz, height: iconSz }]}>
                  <Ionicons name={iconName} size={glyph} color={tint} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.pri, { color: tint }]}>{a.priority}</Text>
                  <Text style={[styles.itemTitle, { color: tc.ink }]} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <MiniBar value={a.impactScore} color={tint} />
                  <Text style={[styles.owner, { color: tc.inkSoft }]}>
                    {a.owner} · {a.etaLabel}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.canvas },
    inner: {},
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
    loading: { marginTop: 12, fontWeight: "600", textAlign: "center", lineHeight: 22 },
    emptyTitle: { fontSize: 20, fontWeight: "900" },
    heroTight: { marginBottom: 4 },
    eyebrow: { fontWeight: "900", letterSpacing: 1.4, color: tc.primaryDark },
    title: { marginTop: 6, fontWeight: "800", color: tc.ink },
    sub: { marginTop: 8, fontWeight: "600", color: tc.inkSoft, lineHeight: 21 },
    metaRow: { flexDirection: "row", gap: 16, marginTop: 14, flexWrap: "wrap" },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    meta: { fontWeight: "700" },
    item: { marginTop: 12, padding: 16 },
    itemStack: { gap: 10 },
    itemRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
    itemHeadRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    iconBlob: { borderRadius: 14, alignItems: "center", justifyContent: "center" },
    pri: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
    itemTitle: { marginTop: 4, fontSize: 16, fontWeight: "800", lineHeight: 22 },
    owner: { fontSize: 12, fontWeight: "700" },
    rationale: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
    hint: { marginTop: 14, fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "center" },
    retryBtn: {
      marginTop: 20,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
  });
}

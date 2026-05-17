/**
 * False-alarm tab — compact verification desk.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchFalseAlarmQueue,
  resolveFalseAlarm,
  screenFalseAlarms,
} from "../../api/agents";
import type { FalseAlarmAction, FalseAlarmCheckItem, FalseAlarmScreenResult } from "../../api/agentTypes";
import { getDemoModeResolved, listCrises, listSignals, summarizeBackendError } from "../../api/client";
import { DEMO_ORCHESTRATION_META } from "../../data/demoOrchestrationMeta";
import { useFalseAlarmQueue } from "../../../lib/firestore/hooks";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { Pill } from "./AppShell";
import { AGENT_SETUP_HINT, formatAgentFetchError } from "../../utils/agentErrors";

function actionTone(action: FalseAlarmAction): "alert" | "amber" | "mint" {
  if (action === "RETRACT") return "alert";
  if (action === "VERIFY_FIRST") return "amber";
  return "mint";
}

function actionShort(action: FalseAlarmAction): string {
  if (action === "RETRACT") return "Retract";
  if (action === "VERIFY_FIRST") return "Verify";
  return "OK";
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function demoQueueResult(): FalseAlarmScreenResult {
  const raw = (DEMO_ORCHESTRATION_META.false_alarm_queue ?? []) as {
    id: string;
    title: string;
    reason: string;
    impact: string;
    status: string;
  }[];
  const checks: FalseAlarmCheckItem[] = raw.map((q) => ({
    signalId: q.id,
    crisisId: `pk-${q.id}`,
    title: q.title,
    recommendedAction: "RETRACT",
    reason: q.reason,
    confidencePct: 88,
    credibilityScore: 28,
    corroborationCount: 0,
    impactIfSent: q.impact,
    operatorStatus: "pending",
    source: "social",
    region: "Islamabad",
  }));
  return {
    checks,
    queue: checks,
    screenedCount: checks.length,
    falseAlarmCount: checks.length,
    verifyCount: 0,
    degradedMode: true,
    degradedAgents: ["FalseAlarmAgent"],
    generatedAt: new Date().toISOString(),
    agentName: "FalseAlarmAgent",
  };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function StatCell({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "ok" }) {
  const { tc, r } = useAegisUi();
  const night = useColorScheme() === "dark";
  const bg =
    tone === "warn" ? (night ? "#3b1720" : "#fff1f2") : tone === "ok" ? tc.tealSoft : tc.card;
  const fg = tone === "warn" ? tc.alertDeep : tone === "ok" ? tc.tealDeep : tc.ink;

  return (
    <View style={[st.cell, { backgroundColor: bg, borderColor: tc.borderSoft, minWidth: r.isCompact ? "47%" : "48%" }]}>
      <Text style={[st.val, { color: fg }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[st.lbl, { color: tc.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Section({ title, actionLabel, onAction, children }: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { tc } = useAegisUi();
  return (
    <View style={sec.wrap}>
      <View style={sec.head}>
        <Text style={[sec.title, { color: tc.inkMuted }]}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={[sec.link, { color: tc.tealDeep }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function PendingCard({
  item,
  resolving,
  onFalse,
  onClear,
  onOpen,
}: {
  item: FalseAlarmCheckItem;
  resolving: boolean;
  onFalse: () => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  const { tc, minTouch } = useAegisUi();
  const night = useColorScheme() === "dark";

  return (
    <View style={[card.wrap, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
      <View style={card.head}>
        <Pill tone={actionTone(item.recommendedAction)}>{actionShort(item.recommendedAction)}</Pill>
        <Text style={[card.cred, { color: tc.inkMuted }]}>{item.credibilityScore}% cred</Text>
      </View>
      <Text style={[card.title, { color: tc.ink }]} numberOfLines={2}>
        {clip(item.title, 100)}
      </Text>
      <Text style={[card.reason, { color: tc.inkSoft }]} numberOfLines={2}>
        {clip(item.reason, 140)}
      </Text>
      <Text style={[card.meta, { color: tc.inkMuted }]} numberOfLines={1}>
        {[item.source, item.region, item.corroborationCount > 0 ? `${item.corroborationCount} sources` : "single source"]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      <View style={card.actions}>
        <Pressable
          onPress={onFalse}
          disabled={resolving}
          style={[
            card.btn,
            {
              backgroundColor: night ? "#3b1720" : "#fff1f2",
              borderColor: tc.alert,
              minHeight: Math.max(minTouch, 44),
              opacity: resolving ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[card.btnTxt, { color: tc.alertDeep }]}>False</Text>
        </Pressable>
        <Pressable
          onPress={onClear}
          disabled={resolving}
          style={[
            card.btn,
            {
              backgroundColor: tc.tealSoft,
              borderColor: tc.tealDeep,
              minHeight: Math.max(minTouch, 44),
              opacity: resolving ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[card.btnTxt, { color: tc.tealDeep }]}>Clear</Text>
        </Pressable>
      </View>
      <Pressable onPress={onOpen} style={card.dossier}>
        <Text style={[card.dossierTxt, { color: tc.tealDeep }]}>View dossier</Text>
        <Ionicons name="chevron-forward" size={14} color={tc.tealDeep} />
      </Pressable>
      {resolving ? <ActivityIndicator size="small" color={tc.primary} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function FalseAlarmDeskLayout() {
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const rootNav = useRootStackNavigation();
  const night = useColorScheme() === "dark";

  const { data: liveQueue, loading: fsLoading, usingFallback: fsOffline } = useFalseAlarmQueue();
  const [localQueue, setLocalQueue] = useState<FalseAlarmScreenResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [falseCrises, setFalseCrises] = useState(0);

  const queue = localQueue ?? liveQueue;

  const pending = useMemo(
    () => (queue?.queue ?? []).filter((c) => c.operatorStatus === "pending"),
    [queue],
  );
  const resolved = useMemo(
    () => (queue?.checks ?? []).filter((c) => c.operatorStatus !== "pending").slice(0, 5),
    [queue],
  );
  const clearedCount = useMemo(
    () => (queue?.checks ?? []).filter((c) => c.recommendedAction === "CONFIRM").length,
    [queue],
  );

  const refreshApi = useCallback(async () => {
    try {
      const remote = await fetchFalseAlarmQueue();
      if (remote) setLocalQueue(remote);
    } catch {
      /* Firestore hook is primary */
    }
    try {
      const rows = await listCrises({ status: "false_alarm", limit: 50 });
      setFalseCrises(rows.length);
    } catch {
      setFalseCrises(0);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshApi();
    setRefreshing(false);
  }, [refreshApi]);

  useFocusEffect(
    useCallback(() => {
      void refreshApi();
    }, [refreshApi]),
  );

  const runScreen = async () => {
    setBusy(true);
    setErr("");
    try {
      const signals = await listSignals();
      if (signals.length === 0) {
        setErr("No signals — check API in Settings.");
        return;
      }
      const result = await screenFalseAlarms(signals);
      setLocalQueue(result);
    } catch (e) {
      const demo = await getDemoModeResolved();
      if (demo) {
        setLocalQueue(demoQueueResult());
        setErr("");
      } else {
        const fe = formatAgentFetchError((e as Error).message);
        setErr(fe.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onResolve = async (signalId: string, status: "confirmed_false_alarm" | "cleared") => {
    setResolvingId(signalId);
    setErr("");
    try {
      const updated = await resolveFalseAlarm(signalId, status);
      setLocalQueue(updated);
    } catch (e) {
      setErr(summarizeBackendError((e as Error).message));
    } finally {
      setResolvingId(null);
    }
  };

  const metaLine = queue?.generatedAt
    ? `Last screen ${relativeTime(queue.generatedAt)} ago · ${queue.degradedMode ? "fallback" : "Groq"}${fsOffline ? " · offline cache" : ""}`
    : fsLoading
      ? "Loading queue…"
      : "Run screen to analyze live alerts";

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={tc.primary} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>FALSE ALARM</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>Verification</Text>
        </View>
        <Pill tone={pending.length > 0 ? "alert" : "mint"}>
          {pending.length} pending
        </Pill>
      </View>

      <View style={[styles.statGrid, { gap: r.gap, marginTop: 12 }]}>
        <StatCell label="Pending" value={String(pending.length)} tone={pending.length > 0 ? "warn" : "default"} />
        <StatCell label="Retract" value={String(queue?.falseAlarmCount ?? 0)} tone="warn" />
        <StatCell label="Verify" value={String(queue?.verifyCount ?? 0)} />
        <StatCell label="Screened" value={queue ? String(queue.screenedCount) : "—"} tone="ok" />
      </View>
      <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={2}>
        {metaLine}
        {falseCrises > 0 ? ` · ${falseCrises} crisis log` : ""}
      </Text>

      {err ? (
        <View style={[styles.errBar, { borderColor: tc.alert, backgroundColor: night ? "#3b1720" : "#fff1f2" }]}>
          <Ionicons name="alert-circle-outline" size={16} color={tc.alertDeep} />
          <Text style={[styles.errTxt, { color: tc.ink }]} numberOfLines={3}>
            {err}
          </Text>
          <Text style={[styles.errHint, { color: tc.inkMuted }]} numberOfLines={2}>
            {AGENT_SETUP_HINT}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => void runScreen()}
        disabled={busy}
        style={[
          styles.screenBtn,
          { backgroundColor: tc.primaryDark, marginTop: sectionGap, opacity: busy ? 0.65 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
            <Text style={styles.screenBtnTxt}>Screen live alerts</Text>
          </>
        )}
      </Pressable>

      {fsLoading && !queue ? (
        <ActivityIndicator color={tc.primary} style={{ marginVertical: 24 }} />
      ) : null}

      {pending.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Section title={`PENDING (${pending.length})`}>
            {pending.map((item) => (
              <PendingCard
                key={item.signalId}
                item={item}
                resolving={resolvingId === item.signalId}
                onFalse={() => void onResolve(item.signalId, "confirmed_false_alarm")}
                onClear={() => void onResolve(item.signalId, "cleared")}
                onOpen={() => rootNav.navigate("AlertAnalysis", { signalId: item.signalId })}
              />
            ))}
          </Section>
        </View>
      ) : queue ? (
        <View style={[styles.empty, { marginTop: sectionGap, borderColor: tc.borderSoft, backgroundColor: tc.card }]}>
          <Ionicons name="checkmark-circle-outline" size={28} color={tc.tealDeep} />
          <Text style={[styles.emptyTitle, { color: tc.ink }]}>Queue clear</Text>
          <Text style={[styles.emptySub, { color: tc.inkMuted }]} numberOfLines={2}>
            No flags pending. Screen again when new signals arrive.
          </Text>
        </View>
      ) : null}

      {resolved.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Section title="RECENT DECISIONS">
            {resolved.map((item) => (
              <Pressable
                key={item.signalId}
                onPress={() => rootNav.navigate("AlertAnalysis", { signalId: item.signalId })}
                style={[styles.resolved, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}
              >
                <Pill tone={item.operatorStatus === "confirmed_false_alarm" ? "alert" : "mint"}>
                  {item.operatorStatus === "confirmed_false_alarm" ? "False" : "Cleared"}
                </Pill>
                <Text style={[styles.resolvedTitle, { color: tc.ink }]} numberOfLines={1}>
                  {clip(item.title, 72)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={tc.inkMuted} />
              </Pressable>
            ))}
          </Section>
        </View>
      ) : null}

      {clearedCount > 0 ? (
        <Text style={[styles.clearedNote, { color: tc.inkMuted, marginTop: sectionGap }]}>
          {clearedCount} alert{clearedCount === 1 ? "" : "s"} cleared as OK to dispatch
        </Text>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  cell: {
    flexGrow: 1,
    flexBasis: "48%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  val: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  lbl: { marginTop: 4, fontSize: 11, fontWeight: "700", lineHeight: 14 },
});

const sec = StyleSheet.create({
  wrap: { marginBottom: 4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  link: { fontSize: 13, fontWeight: "800" },
});

const card = StyleSheet.create({
  wrap: { padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cred: { fontSize: 11, fontWeight: "800" },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  reason: { marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  meta: { marginTop: 6, fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnTxt: { fontSize: 13, fontWeight: "800" },
  dossier: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, marginTop: 8 },
  dossierTxt: { fontSize: 12, fontWeight: "800" },
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  statGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { marginTop: 8, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  errBar: { marginTop: 12, padding: 10, borderRadius: 12, borderWidth: 1, gap: 4 },
  errTxt: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  errHint: { fontSize: 10, fontWeight: "600", lineHeight: 14 },
  screenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  screenBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  empty: {
    alignItems: "center",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: "800" },
  emptySub: { marginTop: 4, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 17 },
  resolved: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  resolvedTitle: { flex: 1, fontSize: 13, fontWeight: "700" },
  clearedNote: { fontSize: 11, fontWeight: "600", textAlign: "center" },
});

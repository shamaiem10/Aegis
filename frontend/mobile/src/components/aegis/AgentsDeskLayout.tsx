/**
 * Agents tab — compact desk: run pipeline, queue, traces.
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
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import {
  batchEnrichAlerts,
  enrichAlertWithAgents,
  fetchAgentsHealth,
} from "../../api/agents";
import type { AgentArtifactBundle, AgentPriority } from "../../api/agentTypes";
import { getApiBase, listSignals, summarizeBackendError } from "../../api/client";
import type { SignalApi } from "../../api/types";
import {
  useAntigravityTraces,
  useRecentAgentArtifacts,
  type AntigravityTraceRow,
} from "../../../lib/firestore/hooks";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { formatAgentFetchError } from "../../utils/agentErrors";
import { formatAlertDisplayCompact } from "../../utils/formatAlertDisplay";
import { HomeAlertRow } from "./HomeAlertRow";
import { Pill, type AlertPriority } from "./AppShell";
import { alertIconForSignal } from "../../utils/alertIcons";

const AGENTS: { id: string; label: string; phase: "analysis" | "planning" }[] = [
  { id: "AlertQueueAnalysisAgent", label: "Queue rank", phase: "analysis" },
  { id: "AlertTriageAgent", label: "Triage", phase: "analysis" },
  { id: "CrisisAnalysisAgent", label: "Crisis analysis", phase: "analysis" },
  { id: "ActionPlanAgent", label: "Action plan", phase: "planning" },
  { id: "ContextualResourcePlanAgent", label: "Resources", phase: "planning" },
  { id: "SeverityIndexAgent", label: "Env index", phase: "analysis" },
  { id: "ResourceScenarioPlanningAgent", label: "Scenario", phase: "planning" },
  { id: "CrisisSimulationAnalysisAgent", label: "Simulation", phase: "analysis" },
];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

function lastTraceByAgent(traces: AntigravityTraceRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of traces) {
    if (!row.agentId || map.has(row.agentId)) continue;
    map.set(row.agentId, row.timestamp);
  }
  return map;
}

function priorityTone(p: AgentPriority | string | undefined): "alert" | "amber" | "mint" | "sky" {
  const v = String(p ?? "").toUpperCase();
  if (v === "CRITICAL") return "alert";
  if (v === "HIGH") return "amber";
  if (v === "MEDIUM") return "sky";
  return "mint";
}

function sevToPriority(sev: number): AlertPriority {
  if (sev >= 8) return "HIGH";
  if (sev >= 5) return "MED";
  return "LOW";
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
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

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
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

export function AgentsDeskLayout() {
  const isFocused = useIsFocused();
  const schemeDark = useColorScheme() === "dark";
  const night = schemeDark;
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const rootNav = useRootStackNavigation();

  const { data: traces, loading: tracesLoading, usingFallback: tracesOffline } = useAntigravityTraces();
  const { data: artifacts, loading: artifactsLoading, usingFallback: artifactsOffline } =
    useRecentAgentArtifacts(10);

  const [signals, setSignals] = useState<SignalApi[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [apiBase, setApiBase] = useState("");
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [healthDetail, setHealthDetail] = useState("");
  const [busy, setBusy] = useState<"contextual" | "batch" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastBundle, setLastBundle] = useState<AgentArtifactBundle | null>(null);
  const [batchNote, setBatchNote] = useState("");
  const [err, setErr] = useState("");

  const sortedSignals = useMemo(
    () =>
      [...signals].sort(
        (a, b) => (Number(b.severity_hint) || 0) - (Number(a.severity_hint) || 0),
      ),
    [signals],
  );

  const traceMap = useMemo(() => lastTraceByAgent(traces), [traces]);
  const activeAgents = useMemo(
    () => AGENTS.filter((a) => traceMap.has(a.id)).length,
    [traceMap],
  );

  const refresh = useCallback(async () => {
    setErr("");
    try {
      const base = await getApiBase();
      setApiBase(base);
      const health = await fetchAgentsHealth();
      setHealthOk(health.ok);
      setHealthDetail(health.detail);
    } catch (e) {
      setHealthOk(false);
      setHealthDetail((e as Error).message);
    }
    setSignalsLoading(true);
    try {
      const rows = await listSignals();
      setSignals(rows);
    } catch (e) {
      setSignals([]);
      setErr(summarizeBackendError((e as Error).message));
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const runContextualTop = async () => {
    const top = sortedSignals[0];
    if (!top) {
      setErr("No alerts in queue — check API in Settings.");
      return;
    }
    setBusy("contextual");
    setErr("");
    setBatchNote("");
    try {
      const bundle = await enrichAlertWithAgents(top);
      setLastBundle(bundle);
    } catch (e) {
      const fe = formatAgentFetchError((e as Error).message, apiBase);
      setErr(fe.message);
    } finally {
      setBusy(null);
    }
  };

  const runBatch = async () => {
    if (sortedSignals.length === 0) {
      setErr("No alerts to enrich.");
      return;
    }
    setBusy("batch");
    setErr("");
    try {
      const result = await batchEnrichAlerts(sortedSignals, 5);
      const ok = result.results.filter((x) => x.success).length;
      setBatchNote(`Enriched ${ok}/${result.enriched}`);
    } catch (e) {
      const fe = formatAgentFetchError((e as Error).message, apiBase);
      setErr(fe.message);
    } finally {
      setBusy(null);
    }
  };

  const ctx = lastBundle?.contextual;
  const hostShort = apiBase.replace(/^https?:\/\//, "").split("/")[0] ?? "";

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
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
            <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>AGENTS</Text>
            <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>AI desk</Text>
          </View>
          <Pill tone={healthOk ? "mint" : healthOk === false ? "alert" : "sky"}>
            {healthOk ? "LLM on" : healthOk === false ? "LLM off" : "…"}
          </Pill>
        </View>

        <View style={[styles.statGrid, { gap: r.gap, marginTop: 12 }]}>
          <StatCell label="Alerts" value={signalsLoading ? "…" : String(sortedSignals.length)} />
          <StatCell label="Traces" value={tracesLoading ? "…" : String(traces.length)} tone="ok" />
          <StatCell
            label="Active"
            value={String(activeAgents)}
            tone={activeAgents > 0 ? "ok" : "default"}
          />
          <StatCell
            label="Artifacts"
            value={artifactsOffline ? "—" : String(artifacts.length)}
          />
        </View>

        <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={2}>
          {healthDetail ? clip(healthDetail, 60) : "Groq agents on cloud-run"}
          {hostShort ? ` · ${clip(hostShort, 28)}` : ""}
          {tracesOffline ? " · traces cached" : ""}
        </Text>

        {err ? (
          <View style={[styles.errBar, { borderColor: tc.alert, backgroundColor: night ? "#3b1720" : "#fff1f2" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={tc.alertDeep} />
            <Text style={[styles.errTxt, { color: tc.ink }]} numberOfLines={2}>
              {err}
            </Text>
          </View>
        ) : null}

        <View style={[styles.actionRow, { marginTop: sectionGap, gap: r.gap }]}>
          <Pressable
            onPress={() => void runContextualTop()}
            disabled={!!busy}
            style={[styles.primaryBtn, { backgroundColor: tc.primaryDark, opacity: busy ? 0.65 : 1 }]}
          >
            {busy === "contextual" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flash-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnTxt}>Pipeline · top alert</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => void runBatch()}
            disabled={!!busy}
            style={[
              styles.secondaryBtn,
              { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft, opacity: busy ? 0.65 : 1 },
            ]}
          >
            {busy === "batch" ? (
              <ActivityIndicator color={tc.tealDeep} />
            ) : (
              <Text style={[styles.secondaryBtnTxt, { color: tc.tealDeep }]}>Batch top 5</Text>
            )}
          </Pressable>
        </View>

        {batchNote ? (
          <Text style={[styles.note, { color: tc.tealDeep }]}>{batchNote}</Text>
        ) : null}

        {(ctx || lastBundle?.triage) && (
          <View style={{ marginTop: sectionGap }}>
            <Section
              title="LAST RUN"
              actionLabel="Dossier"
              onAction={() =>
                rootNav.navigate("AlertAnalysis", {
                  signalId: lastBundle?.signalId ?? ctx?.focusSignalId,
                })
              }
            >
              <View style={[styles.runCard, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
                {lastBundle?.triage ? (
                  <View style={styles.runHead}>
                    <Pill tone={priorityTone(lastBundle.triage.priority)}>
                      {lastBundle.triage.priority}
                    </Pill>
                    <Text style={[styles.runTitle, { color: tc.ink }]} numberOfLines={2}>
                      {clip(lastBundle.triage.headline, 100)}
                    </Text>
                  </View>
                ) : null}
                {ctx ? (
                  <Text style={[styles.runMeta, { color: tc.inkMuted }]} numberOfLines={1}>
                    Rank #{ctx.focusRank} · {clip(ctx.competingAlertsNote, 48)}
                  </Text>
                ) : null}
                {ctx?.globalPrioritization.slice(0, 3).map((row) => (
                  <View key={row.signalId} style={styles.queueRow}>
                    <Text style={[styles.queueRank, { color: tc.inkMuted }]}>#{row.rank}</Text>
                    <Text style={[styles.queueTxt, { color: tc.ink }]} numberOfLines={1}>
                      {clip(row.headline, 56)}
                    </Text>
                  </View>
                ))}
                {lastBundle?.degradedAgents?.length ? (
                  <Text style={[styles.degraded, { color: tc.amberDeep }]} numberOfLines={1}>
                    Fallback: {lastBundle.degradedAgents.length} agent(s)
                  </Text>
                ) : null}
              </View>
            </Section>
          </View>
        )}

        <View style={{ marginTop: sectionGap }}>
          <Section title="AGENT STATUS" actionLabel="Traces" onAction={() => rootNav.navigate("AgentTraces")}>
            {AGENTS.map((agent) => {
              const last = traceMap.get(agent.id);
              return (
                <View
                  key={agent.id}
                  style={[styles.agentRow, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}
                >
                  <Ionicons
                    name={agent.phase === "planning" ? "construct-outline" : "analytics-outline"}
                    size={16}
                    color={agent.phase === "planning" ? tc.tealDeep : tc.primary}
                  />
                  <Text style={[styles.agentLbl, { color: tc.ink }]} numberOfLines={1}>
                    {agent.label}
                  </Text>
                  <Text style={[styles.agentTs, { color: last ? tc.tealDeep : tc.inkMuted }]}>
                    {last ? relativeTime(last) : "—"}
                  </Text>
                </View>
              );
            })}
          </Section>
        </View>

        <View style={{ marginTop: sectionGap }}>
          <Section title="QUEUE" actionLabel="Refresh" onAction={() => void refresh()}>
            {signalsLoading ? (
              <ActivityIndicator color={tc.primary} style={{ marginVertical: 12 }} />
            ) : sortedSignals.length === 0 ? (
              <Text style={[styles.empty, { color: tc.inkMuted }]}>
                No signals — check API URL in Settings.
              </Text>
            ) : (
              sortedSignals.slice(0, 5).map((sig) => {
                const display = formatAlertDisplayCompact(sig);
                return (
                  <View key={sig.id} style={styles.rowWrap}>
                    <HomeAlertRow
                      iconName={alertIconForSignal(sig.kind, sig.text)}
                      title={display.title}
                      timeLabel={`Sev ${sig.severity_hint}/10 · ${display.meta}`}
                      priority={sevToPriority(sig.severity_hint)}
                      onPress={() => rootNav.navigate("AlertAnalysis", { signalId: sig.id })}
                    />
                  </View>
                );
              })
            )}
          </Section>
        </View>

        {!artifactsOffline && artifacts.length > 0 ? (
          <View style={{ marginTop: sectionGap }}>
            <Section title="ENRICHED">
              {artifactsLoading ? (
                <ActivityIndicator color={tc.primary} />
              ) : (
                artifacts.slice(0, 3).map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => rootNav.navigate("AlertAnalysis", { signalId: row.id })}
                    style={[styles.miniRow, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}
                  >
                    <Text style={[styles.miniTitle, { color: tc.ink }]} numberOfLines={1}>
                      {clip(row.triage?.headline ?? row.id, 64)}
                    </Text>
                    <Text style={[styles.miniMeta, { color: tc.inkMuted }]}>
                      {row.triage?.priority ?? "—"}
                      {row.updatedAt ? ` · ${relativeTime(row.updatedAt)}` : ""}
                    </Text>
                  </Pressable>
                ))
              )}
            </Section>
          </View>
        ) : null}

        {traces.length > 0 ? (
          <View style={{ marginTop: sectionGap }}>
            <Section title="RECENT TRACES" actionLabel="All" onAction={() => rootNav.navigate("AgentTraces")}>
              {tracesLoading ? (
                <ActivityIndicator color={tc.primary} />
              ) : (
                traces.slice(0, 5).map((row) => (
                  <View
                    key={row.id}
                    style={[styles.traceRow, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}
                  >
                    <View style={[styles.traceDot, { backgroundColor: tc.tealDeep }]} />
                    <Text style={[styles.traceAgent, { color: tc.ink }]} numberOfLines={1}>
                      {row.agentId?.replace(/Agent$/, "") ?? "Agent"}
                    </Text>
                    <Text style={[styles.traceTs, { color: tc.inkMuted }]}>
                      {relativeTime(row.timestamp)}
                    </Text>
                  </View>
                ))
              )}
            </Section>
          </View>
        ) : null}
      </ScrollView>
    </>
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

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  statGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { marginTop: 8, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  errBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  errTxt: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  actionRow: {},
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 8,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  secondaryBtnTxt: { fontWeight: "800", fontSize: 14 },
  note: { marginTop: 6, fontSize: 12, fontWeight: "700" },
  runCard: { padding: 12, borderRadius: 14, borderWidth: 1 },
  runHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  runTitle: { flex: 1, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  runMeta: { marginTop: 8, fontSize: 11, fontWeight: "600" },
  queueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  queueRank: { width: 24, fontSize: 11, fontWeight: "900" },
  queueTxt: { flex: 1, fontSize: 12, fontWeight: "600" },
  degraded: { marginTop: 8, fontSize: 10, fontWeight: "700" },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  agentLbl: { flex: 1, fontSize: 13, fontWeight: "700" },
  agentTs: { fontSize: 11, fontWeight: "800" },
  rowWrap: { marginTop: -2 },
  empty: { fontSize: 12, fontWeight: "600", paddingVertical: 8 },
  miniRow: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  miniTitle: { fontSize: 13, fontWeight: "800" },
  miniMeta: { marginTop: 4, fontSize: 11, fontWeight: "600" },
  traceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  traceDot: { width: 6, height: 6, borderRadius: 3 },
  traceAgent: { flex: 1, fontSize: 12, fontWeight: "800" },
  traceTs: { fontSize: 11, fontWeight: "600" },
});

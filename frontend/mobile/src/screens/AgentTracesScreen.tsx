import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Card, PageHeader } from "../components/aegis/AppShell";
import { fetchLatestDossier, summarizeBackendError, getDemoModeResolved } from "../api/client";
import type { AntigravityTraceStepApi, SimulatedActionApi, SignalCredibilityApi, AuditLogEntryApi } from "../api/types";
import type { RootStackParamList } from "../navigation/types";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";

type TraceFilter = "all" | "aqi" | "environmental";

function traceMatchesFilter(row: AntigravityTraceStepApi, f: TraceFilter): boolean {
  if (f === "all") return true;
  const flags = (row.flags ?? []).map((x) => x.toLowerCase()).join(" ");
  const hay = `${row.agent} ${row.phase} ${row.detail} ${flags}`.toLowerCase();
  if (f === "aqi") {
    return (
      hay.includes("aqi") ||
      hay.includes("pm2.5") ||
      hay.includes("pm10") ||
      (row.flags ?? []).some((fl) => fl.toLowerCase().includes("aqi"))
    );
  }
  return (
    (row.flags ?? []).some((fl) => fl.toLowerCase().includes("environmental")) ||
    /dust|pepa|pmd|satellite|plume|storm|wind|corridor|visibility|mask/.test(hay)
  );
}

export function AgentTracesScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const [traces, setTraces] = useState<AntigravityTraceStepApi[]>([]);
  const [cred, setCred] = useState<SignalCredibilityApi[]>([]);
  const [audit, setAudit] = useState<AuditLogEntryApi[]>([]);
  const [conflict, setConflict] = useState<Record<string, unknown> | null>(null);
  const [degraded, setDegraded] = useState<string[]>([]);
  const [sim, setSim] = useState<SimulatedActionApi[]>([]);
  const [agentKpis, setAgentKpis] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState("");
  const [demo, setDemo] = useState(false);
  const [traceFilter, setTraceFilter] = useState<TraceFilter>("all");

  const filteredTraces = useMemo(
    () => traces.filter((t) => traceMatchesFilter(t, traceFilter)),
    [traces, traceFilter],
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setErr("");
          const dm = await getDemoModeResolved();
          if (alive) setDemo(dm);
          const d = await fetchLatestDossier();
          if (!alive) return;
          const m = d.meta ?? {};
          setTraces(Array.isArray(m.antigravity_trace) ? (m.antigravity_trace as AntigravityTraceStepApi[]) : []);
          setCred(Array.isArray(m.signal_credibility) ? (m.signal_credibility as SignalCredibilityApi[]) : []);
          setAudit(Array.isArray(m.audit_log) ? (m.audit_log as AuditLogEntryApi[]) : []);
          setConflict(typeof m.hypothesis_conflict === "object" && m.hypothesis_conflict ? (m.hypothesis_conflict as Record<string, unknown>) : null);
          setSim(Array.isArray(m.action_simulation) ? (m.action_simulation as SimulatedActionApi[]) : []);
          const im = m.ingest_meta as { degraded_mode?: string[] } | undefined;
          setDegraded(Array.isArray(im?.degraded_mode) ? im!.degraded_mode! : []);
          const kpis = m.agent_kpis;
          setAgentKpis(typeof kpis === "object" && kpis && !Array.isArray(kpis) ? (kpis as Record<string, unknown>) : null);
        } catch (e) {
          if (alive) setErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const filterChips: { id: TraceFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "aqi", label: "AQI analysis" },
    { id: "environmental", label: "Environmental" },
  ];

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        contentWrap,
        styles.inner,
        { paddingHorizontal: r.horizontalPad, paddingTop: r.insets.top + 8 },
      ]}
    >
      <PageHeader
        eyebrow="Agents"
        title="Antigravity traces"
        sub={`Live steps from latest dossier · ${demo ? "demo bundle" : "API"}`}
      />
      {err ? (
        <Card style={styles.err}>
          <Text style={styles.errTxt}>{err}</Text>
        </Card>
      ) : null}
      {degraded.length > 0 ? (
        <Card style={styles.deg}>
          <Text style={styles.degLbl}>Degraded / fallback</Text>
          <Text style={styles.degBody}>{degraded.join("\n")}</Text>
        </Card>
      ) : null}

      <Pressable
        onPress={() => navigation.navigate("FalseAlarm")}
        style={styles.falseAlarmLink}
      >
        <Text style={styles.falseAlarmLinkTxt}>Review false alarm queue →</Text>
      </Pressable>

      {agentKpis && Object.keys(agentKpis).length > 0 ? (
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>Agent KPIs (demo)</Text>
          {Object.entries(agentKpis).map(([k, v]) => (
            <Text key={k} style={styles.kpiRow}>
              <Text style={styles.kpiKey}>{k.replace(/_/g, " ")}</Text>
              <Text style={styles.kpiVal}>{String(v)}</Text>
            </Text>
          ))}
        </Card>
      ) : null}

      <Text style={styles.section}>Trace filters</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {filterChips.map((c) => {
          const on = traceFilter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setTraceFilter(c.id)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.filterHint}>
        Showing {filteredTraces.length} of {traces.length} steps
        {traceFilter === "aqi" ? " · AQI / particulate / flagged analysis" : ""}
        {traceFilter === "environmental" ? " · dust, met, sensors, plume, corridor" : ""}
      </Text>

      {filteredTraces.map((row, i) => (
        <Card key={`${row.agent}-${i}`} style={styles.cardGap}>
          <Text style={styles.agent}>
            {row.agent} · <Text style={styles.phase}>{row.phase}</Text>
          </Text>
          <Text style={styles.meta}>
            {row.confidence != null ? `${Math.round(row.confidence * 100)}% conf` : "—"}
            {row.flags?.length ? ` · ${row.flags.join(", ")}` : ""}
          </Text>
          <Text style={styles.body}>{row.detail}</Text>
          {row.inputs_summary ? <Text style={styles.mono}>in: {row.inputs_summary}</Text> : null}
          {row.outputs_summary ? <Text style={styles.mono}>out: {row.outputs_summary}</Text> : null}
        </Card>
      ))}

      <Text style={styles.section}>Credibility (sample)</Text>
      {cred.slice(0, 8).map((c) => (
        <Card key={c.signal_id} style={styles.cardGap}>
          <Text style={styles.agent}>{c.signal_id}</Text>
          <Text style={styles.body}>
            cred {c.credibility}
            {c.geolocation_confidence != null ? ` · geo ${c.geolocation_confidence}` : ""}
          </Text>
          {c.flags?.length ? <Text style={styles.mono}>{c.flags.join(" · ")}</Text> : null}
        </Card>
      ))}

      <Text style={styles.section}>Hypothesis conflict</Text>
      <Card style={styles.cardGap}>
        <Text style={styles.mono}>{conflict ? JSON.stringify(conflict, null, 2) : "—"}</Text>
      </Card>

      <Text style={styles.section}>Action simulation (summary)</Text>
      {sim.slice(0, 4).map((a) => (
        <Card key={a.action_id} style={styles.cardGap}>
          <Text style={styles.agent}>{a.action_id}</Text>
          <Text style={styles.body}>{a.response_action}</Text>
          {a.possible_side_effects?.length ? (
            <Text style={styles.mono}>fx: {a.possible_side_effects.join("; ")}</Text>
          ) : null}
        </Card>
      ))}

      <Text style={styles.section}>Audit log</Text>
      {audit.slice(-12).map((a, i) => (
        <Text key={`${a.ts}-${i}`} style={styles.auditLine}>
          {a.ts?.slice(11, 19)} · {a.event}
        </Text>
      ))}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    inner: { paddingBottom: 40 },
    section: {
      marginTop: 18,
      marginBottom: 8,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.primaryDark,
      textTransform: "uppercase",
    },
    cardGap: { marginBottom: 12 },
    agent: { fontSize: 15, fontWeight: "800", color: tc.ink },
    phase: { fontWeight: "700", color: tc.accentGreen },
    meta: { marginTop: 4, fontSize: 12, color: tc.inkSoft },
    body: { marginTop: 8, fontSize: 13, color: tc.ink, lineHeight: 20 },
    mono: { marginTop: 6, fontSize: 11, color: tc.inkMuted },
    err: { marginBottom: 12, padding: 12, backgroundColor: "rgba(239,68,68,0.08)" },
    errTxt: { color: "#b91c1c", fontWeight: "700" },
    deg: { marginBottom: 12, borderColor: "rgba(245,158,11,0.5)" },
    degLbl: { fontSize: 11, fontWeight: "900", color: "#b45309" },
    degBody: { marginTop: 6, fontSize: 12, color: tc.ink },
    auditLine: { fontSize: 12, color: tc.inkMuted, marginBottom: 4, fontWeight: "600" },
    falseAlarmLink: {
      marginBottom: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: tc.card,
      borderWidth: 1,
      borderColor: tc.border,
    },
    falseAlarmLinkTxt: { fontSize: 13, fontWeight: "900", color: tc.tealDeep },
    kpiCard: { marginBottom: 12 },
    kpiTitle: { fontSize: 12, fontWeight: "900", color: tc.ink, letterSpacing: 1 },
    kpiRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", gap: 12 },
    kpiKey: { flex: 1, fontSize: 12, color: tc.inkSoft, fontWeight: "700", textTransform: "capitalize" },
    kpiVal: { fontSize: 13, fontWeight: "900", color: tc.ink },
    chipRow: { gap: 8, paddingBottom: 6 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tc.border,
      backgroundColor: tc.card,
      marginRight: 8,
    },
    chipOn: { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft },
    chipTxt: { fontSize: 12, fontWeight: "800", color: tc.ink },
    chipTxtOn: { color: tc.tealDeep },
    filterHint: { fontSize: 11, color: tc.inkMuted, marginBottom: 10, fontWeight: "600" },
  });
}

import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  fetchLatestDossier,
  getDemoModeResolved,
  runPipeline,
  runScenarioPipeline,
} from "../../api/client";
import type { AuditLogEntryApi, CrisisDossierApi } from "../../api/types";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { useThemeCiro } from "../../theme/useThemeCiro";
import { friendlyPipelineError } from "../../utils/backendErrors";

import { Card, PageHeader } from "./AppShell";

const PIPELINE_STEPS = [
  "Fuse signals",
  "Classify crises",
  "Predict severity",
  "Allocate resources",
  "Check false alarms",
  "Compound risks",
  "Draft alerts",
];

const PIPELINE_STEPS_FAST = ["Fuse signals", "Combined AI analysis (classify → allocate → alerts)"];

export function OperationsDesk() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const rootNav = useRootStackNavigation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CrisisDossierApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [fastPipeline, setFastPipeline] = useState(true);
  const [audit, setAudit] = useState<AuditLogEntryApi[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        setDemo(await getDemoModeResolved());
        try {
          const d = await fetchLatestDossier();
          if (!alive) return;
          setResult(d);
          const m = d.meta ?? {};
          setAudit(Array.isArray(m.audit_log) ? (m.audit_log as AuditLogEntryApi[]) : []);
        } catch {
          if (alive) {
            setResult(null);
            setAudit([]);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const applySuccess = (d: CrisisDossierApi, meta?: { fast_mode?: boolean }) => {
    setResult(d);
    setErr(null);
    const m = d.meta ?? {};
    if (Array.isArray(m.audit_log)) setAudit(m.audit_log as AuditLogEntryApi[]);
    const degraded = m.pipeline_degraded as string[] | undefined;
    if (Array.isArray(degraded) && degraded.length) {
      setWarn(`Some agents used fallback mode: ${degraded.join(", ")}`);
    } else {
      setWarn(null);
    }
    const fsNote = m.firestore_skipped;
    if (fsNote) {
      setWarn(
        (w) =>
          `${w ? `${w} ` : ""}Cloud save skipped (Firestore). Results are on this screen — enable Firestore on project aegis-496207 for Reports/Agents sync.`,
      );
    }
    void meta;
  };

  const run = async (mode: "live" | "g10") => {
    setBusy(true);
    setErr(null);
    setWarn(null);
    try {
      const d =
        mode === "g10"
          ? await runScenarioPipeline({
              scenario_id: "g10_flood_heat",
              merge_live_signals: true,
              fast: fastPipeline,
            })
          : await runPipeline({
              include_weather: true,
              fast: fastPipeline,
            });
      applySuccess(d);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErr(friendlyPipelineError(raw));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const steps = fastPipeline && !demo ? PIPELINE_STEPS_FAST : PIPELINE_STEPS;
  const simCount = Array.isArray(result?.meta?.action_simulation)
    ? (result!.meta!.action_simulation as unknown[]).length
    : 0;

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: 40,
        },
      ]}
    >
      <PageHeader
        eyebrow="Command desk"
        title="Run AI pipeline"
        sub="Pulls live feeds, runs Antigravity agents, builds crisis dossiers, and drafts stakeholder alerts for the Reports tab."
      />

      <View style={[styles.howTo, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <Text style={[styles.howTitle, { color: tc.ink }]}>What happens when you tap Run</Text>
        {steps.map((s, i) => (
          <View key={s} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: tc.tealSoft }]}>
              <Text style={[styles.stepNumTxt, { color: tc.tealDeep }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLbl, { color: tc.ink }]}>{s}</Text>
          </View>
        ))}
        <Text style={[styles.howFoot, { color: tc.inkMuted }]}>
          Takes about {fastPipeline ? "30–90" : "2–4"} minutes with Gemini. Keep the app open.
        </Text>
      </View>

      {!demo ? (
        <View style={[styles.toggleCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: tc.ink }]}>Fast mode</Text>
            <Text style={[styles.toggleSub, { color: tc.inkSoft }]}>
              Recommended — fewer AI calls, same story for demos.
            </Text>
          </View>
          <Switch value={fastPipeline} onValueChange={setFastPipeline} />
        </View>
      ) : null}

      <Pressable
        onPress={() => void run("live")}
        disabled={busy}
        style={[styles.primaryBtn, { backgroundColor: tc.primaryDark }, busy && { opacity: 0.65 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnTxt}>
            {demo ? "Simulate pipeline" : "Run live pipeline"}
          </Text>
        )}
      </Pressable>

      {!demo ? (
        <Pressable
          onPress={() => void run("g10")}
          disabled={busy}
          style={[styles.secondaryBtn, { borderColor: tc.tealDeep }, busy && { opacity: 0.65 }]}
        >
          <Ionicons name="layers-outline" size={18} color={tc.tealDeep} />
          <Text style={[styles.secondaryBtnTxt, { color: tc.tealDeep }]}>
            Demo: G-10 flood + heat + air quality + dust
          </Text>
        </Pressable>
      ) : null}

      {err ? (
        <Card style={[styles.errCard, { borderColor: tc.alertDeep, backgroundColor: tc.warnSurface }]}>
          <Ionicons name="warning-outline" size={22} color={tc.alertDeep} />
          <Text style={[styles.errTitle, { color: tc.alertDeep }]}>Pipeline did not finish</Text>
          <Text style={[styles.errBody, { color: tc.ink }]}>{err}</Text>
        </Card>
      ) : null}

      {warn && !err ? (
        <Card style={[styles.warnCard, { borderColor: tc.amber, backgroundColor: tc.warnSurface }]}>
          <Text style={[styles.warnTxt, { color: tc.amberDeep }]}>{warn}</Text>
        </Card>
      ) : null}

      {result ? (
        <Card style={{ marginTop: 16, borderColor: tc.tealDeep, backgroundColor: tc.card }}>
          <View style={styles.successHead}>
            <Ionicons name="checkmark-circle" size={28} color={tc.sageDeep} />
            <Text style={[styles.successTitle, { color: tc.ink }]}>Pipeline complete</Text>
          </View>
          <Text style={[styles.crisisName, { color: tc.ink }]}>
            {(result.meta?.display_name as string) ||
              `${result.classification.category} · ${result.crisis_id}`}
          </Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: tc.tealDeep }]}>{result.severity.score}/10</Text>
              <Text style={[styles.kpiLbl, { color: tc.inkMuted }]}>Severity</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: tc.ink }]}>
                {(result.classification.confidence * 100).toFixed(0)}%
              </Text>
              <Text style={[styles.kpiLbl, { color: tc.inkMuted }]}>Confidence</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiVal, { color: tc.ink }]}>{simCount}</Text>
              <Text style={[styles.kpiLbl, { color: tc.inkMuted }]}>Sim actions</Text>
            </View>
          </View>
          {result.allocation?.notes ? (
            <Text style={[styles.alloc, { color: tc.inkSoft }]} numberOfLines={4}>
              Allocation: {result.allocation.notes}
            </Text>
          ) : null}
          <View style={styles.linkRow}>
            <Pressable
              onPress={() => rootNav.navigate("CrisisDetail", { id: result.crisis_id })}
              style={styles.linkChip}
            >
              <Text style={[styles.linkTxt, { color: tc.tealDeep }]}>Open crisis</Text>
            </Pressable>
            <Pressable onPress={() => rootNav.navigate("SimulationOverview")} style={styles.linkChip}>
              <Text style={[styles.linkTxt, { color: tc.tealDeep }]}>Simulation</Text>
            </Pressable>
            <Pressable onPress={() => rootNav.navigate("MainTabs", { screen: "Reports" })} style={styles.linkChip}>
              <Text style={[styles.linkTxt, { color: tc.tealDeep }]}>Reports</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {audit.length > 0 ? (
        <>
          <Text style={[styles.section, { color: tc.inkMuted }]}>Activity log</Text>
          {audit.slice(0, 8).map((a, i) => (
            <View
              key={`${a.ts}-${a.event}-${i}`}
              style={[styles.logRow, { borderColor: tc.border, backgroundColor: tc.card }]}
            >
              <Text style={[styles.logEvent, { color: tc.ink }]}>{a.event}</Text>
              {typeof a.note === "string" ? (
                <Text style={[styles.logNote, { color: tc.inkSoft }]}>{a.note}</Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    howTo: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
    howTitle: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
    stepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumTxt: { fontSize: 12, fontWeight: "900" },
    stepLbl: { fontSize: 14, fontWeight: "600", flex: 1 },
    howFoot: { marginTop: 8, fontSize: 12, fontWeight: "600" },
    toggleCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 14,
    },
    toggleTitle: { fontSize: 15, fontWeight: "800" },
    toggleSub: { marginTop: 4, fontSize: 12, lineHeight: 17 },
    primaryBtn: {
      paddingVertical: 16,
      borderRadius: 999,
      alignItems: "center",
    },
    primaryBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
    secondaryBtn: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 999,
      borderWidth: 1.5,
    },
    secondaryBtnTxt: { fontSize: 13, fontWeight: "800", textAlign: "center", flex: 1 },
    errCard: {
      marginTop: 16,
      padding: 14,
      borderWidth: 1,
      gap: 8,
    },
    errTitle: { fontSize: 15, fontWeight: "900" },
    errBody: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
    warnCard: { marginTop: 12, padding: 12, borderWidth: 1 },
    warnTxt: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
    successHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    successTitle: { fontSize: 18, fontWeight: "900" },
    crisisName: { marginTop: 10, fontSize: 15, fontWeight: "700", lineHeight: 22 },
    kpiRow: { flexDirection: "row", marginTop: 16, gap: 8 },
    kpi: { flex: 1, alignItems: "center" },
    kpiVal: { fontSize: 20, fontWeight: "900" },
    kpiLbl: { marginTop: 4, fontSize: 10, fontWeight: "700" },
    alloc: { marginTop: 12, fontSize: 13, lineHeight: 19 },
    linkRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
    linkChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: tc.tealSoft,
    },
    linkTxt: { fontSize: 12, fontWeight: "800" },
    section: {
      marginTop: 24,
      marginBottom: 10,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    logRow: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    logEvent: { fontSize: 13, fontWeight: "800" },
    logNote: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  });
}

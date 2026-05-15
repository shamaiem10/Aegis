import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Card, MiniBar } from "../components/aegis/AppShell";
import { fetchLatestDossier, runScenarioPipeline, summarizeBackendError } from "../api/client";
import { useAegisUi } from "../hooks/useAegisUi";
import type { RootStackParamList } from "../navigation/types";
import type { SimulatedActionApi } from "../api/types";
import type { IonName } from "../utils/alertIcons";
import { useThemeCiro } from "../theme/useThemeCiro";
import { Ionicons } from "@expo/vector-icons";

const MOCK_LOGS: { icon: IonName; msg: string; t: string }[] = [
  { icon: "document-text-outline", msg: "Ticket #E-203 created", t: "0:02" },
  { icon: "people-outline", msg: "248 users notified", t: "0:08" },
  { icon: "git-network-outline", msg: "Route updated · 7 segments", t: "0:15" },
  { icon: "trending-down-outline", msg: "Congestion reduced by 63%", t: "0:42" },
];

export function SimulationLiveScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sec, setSec] = useState(42);
  const [actions, setActions] = useState<SimulatedActionApi[]>([]);
  const [crisisId, setCrisisId] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [timelinePct, setTimelinePct] = useState(82);
  const [pick, setPick] = useState<string | null>(null);
  const [m2Advisory, setM2Advisory] = useState(false);

  const formatClock = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerLivePill}>
          <View style={styles.headerLiveDot} />
          <Text style={styles.headerLiveTxt}>{formatClock(sec)}</Text>
        </View>
      ),
    });
  }, [navigation, sec, styles]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setLoading(true);
          setErr("");
          const d = await fetchLatestDossier();
          if (!alive) return;
          setCrisisId(d.crisis_id);
          const m = d.meta?.action_simulation;
          setActions(Array.isArray(m) ? (m as SimulatedActionApi[]) : []);
        } catch (e) {
          if (alive) setErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTimelinePct((p) => (p >= 99 ? 78 : p + 1));
    }, 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSec((s) => (s >= 99 * 60 + 59 ? 42 : s + 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const runScenario = async () => {
    try {
      setRunning(true);
      setErr("");
      const d = await runScenarioPipeline({ merge_live_signals: false });
      setCrisisId(d.crisis_id);
      const m = d.meta?.action_simulation;
      setActions(Array.isArray(m) ? (m as SimulatedActionApi[]) : []);
    } catch (e) {
      setErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[
        styles.inner,
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingBottom: r.insets.bottom + 20,
        },
      ]}
    >
      <Pressable
        style={[styles.runBtn, running && { opacity: 0.75 }]}
        onPress={runScenario}
        disabled={running}
      >
        {running ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.runBtnTxt}>Run stress scenario (API / demo)</Text>
        )}
      </Pressable>
      {crisisId ? <Text style={styles.subId}>Dossier {crisisId}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: 12 }} color={tc.accentGreen} /> : null}

      {actions.length > 0 ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.logTitle}>Environmental + flood actions</Text>
          <Text style={[styles.logMeta, { marginBottom: 10 }]}>Pick a simulated action — uses dossier meta payloads.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {actions.map((a) => (
              <Pressable
                key={a.action_id}
                onPress={() => setPick(a.action_id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: pick === a.action_id ? tc.tealSoft : tc.muted,
                  borderWidth: 1,
                  borderColor: pick === a.action_id ? tc.tealDeep : tc.border,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: tc.ink }}>
                  {a.action_id.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {pick === "school_closure_f7" && !m2Advisory ? (
            <Text style={{ marginTop: 12, fontSize: 12, fontWeight: "800", color: "#c2410c", lineHeight: 18 }}>
              ⚠ Mass simultaneous departure from F-7 schools and offices without traffic management will cause severe
              road congestion — ~3× normal peak. Coordinate M-2 / CDA before issuing closure advisory.
            </Text>
          ) : null}
          {pick === "school_closure_f7" ? (
            <Pressable
              onPress={() => setM2Advisory(true)}
              style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border }}
            >
              <Text style={{ fontWeight: "900", color: tc.tealDeep }}>
                {m2Advisory ? "M-2 advisory logged ✓" : "Mark M-2 partial closure advisory coordinated"}
              </Text>
            </Pressable>
          ) : null}
          {pick ? (
            <View style={{ marginTop: 14 }}>
              {actions
                .filter((a) => a.action_id === pick)
                .map((a) => (
                  <View key={a.action_id}>
                    <Text style={styles.logMsg}>Before: {a.before_state}</Text>
                    <Text style={[styles.logMsg, { marginTop: 6 }]}>Action: {a.response_action}</Text>
                    <Text style={[styles.logMsg, { marginTop: 6 }]}>After: {a.expected_after_state}</Text>
                    {a.possible_side_effects?.length ? (
                      <Text style={[styles.logMeta, { marginTop: 8 }]}>
                        Side effects: {a.possible_side_effects.join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      <View style={[styles.mapRow, r.isCompact && styles.mapRowStack]}>
        <Card style={styles.mapCard}>
          <Text style={styles.mapLbl}>Before</Text>
          <View style={styles.heatBefore}>
            <View style={[styles.blob, { backgroundColor: "#f97316", opacity: 0.85, left: "12%", top: "28%" }]} />
            <View style={[styles.blob, { backgroundColor: "#ef4444", opacity: 0.75, right: "18%", top: "40%" }]} />
          </View>
        </Card>
        <Card style={styles.mapCard}>
          <Text style={styles.mapLbl}>After</Text>
          <View style={styles.heatAfter}>
            <View style={styles.dottedPath} />
            <View style={[styles.node, { backgroundColor: tc.accentGreen, top: "20%", left: "42%" }]} />
            <View style={[styles.node, { backgroundColor: tc.tealDeep, bottom: "30%", right: "28%" }]} />
          </View>
        </Card>
      </View>

      <Card>
        <View style={styles.timeTop}>
          <Text style={styles.timeTitle}>Execution Timeline</Text>
          <Text style={styles.timePct}>{timelinePct}% complete</Text>
        </View>
        <MiniBar value={timelinePct} color={tc.accentGreen} />
        <View style={styles.phaseRow}>
          {["Detect", "Plan", "Dispatch", "Resolve"].map((p) => (
            <Text key={p} style={styles.phaseLbl}>
              {p}
            </Text>
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <View style={styles.logHead}>
          <Text style={styles.logTitle}>System Logs</Text>
          <Ionicons name="pulse-outline" size={22} color={tc.primary} />
        </View>
        {MOCK_LOGS.map((row) => (
          <View key={row.t + row.msg} style={styles.logRow}>
            <Ionicons name={row.icon} size={18} color={tc.sageDeep} style={styles.logIconIon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.logMsg}>{row.msg}</Text>
            </View>
            <Text style={styles.logTime}>{row.t}</Text>
          </View>
        ))}
        {actions.length === 0 && !loading ? null : (
          <>
            {actions.length > 0 ? (
              <Text style={styles.apiSep}>Simulated actions (API)</Text>
            ) : null}
            {actions.map((row) => (
              <View key={row.action_id} style={styles.logRow}>
                <Ionicons name="ellipse-outline" size={16} color={tc.inkMuted} style={styles.logIconIon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logMsg}>{row.response_action}</Text>
                  <Text style={styles.logMeta}>
                    {row.action_id} · Δt {row.response_time_improvement_min ?? "—"} min
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tc.canvas },
  inner: { paddingTop: 12 },
  headerLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 4,
    paddingHorizontal: 12,
      paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: tc.accentGreenSoft,
    borderWidth: 1,
    borderColor: tc.border,
  },
  headerLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tc.accentGreen,
  },
  headerLiveTxt: { fontSize: 12, fontWeight: "900", color: tc.sageDeep },
  runBtn: {
    marginBottom: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: tc.primaryDark,
    alignItems: "center",
  },
  runBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13 },
  subId: { marginTop: 8, fontSize: 11, color: tc.inkMuted, fontWeight: "600" },
  err: { marginTop: 8, color: "#b91c1c", fontWeight: "700", fontSize: 12 },
  mapRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 6 },
  mapRowStack: { flexDirection: "column" },
  mapCard: { flex: 1, padding: 12, minHeight: 140 },
  mapLbl: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: tc.inkMuted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heatBefore: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: tc.cardTint,
    position: "relative",
    overflow: "hidden",
  },
  heatAfter: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    position: "relative",
    overflow: "hidden",
  },
  dottedPath: {
    position: "absolute",
    left: "18%",
    right: "22%",
    top: "52%",
    height: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(56,189,248,0.85)",
  },
  blob: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  node: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#fff",
  },
  timeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "baseline",
  },
  timeTitle: { fontSize: 15, fontWeight: "800", color: tc.ink },
  timePct: { fontSize: 14, fontWeight: "900", color: tc.sageDeep },
  phaseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 2,
  },
  phaseLbl: { fontSize: 10, fontWeight: "800", color: tc.inkMuted, letterSpacing: 0.5 },
  logHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: tc.ink,
  },
  apiSep: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: tc.inkMuted,
    textTransform: "uppercase",
  },
  logRow: { flexDirection: "row", gap: 10, marginBottom: 14, alignItems: "center" },
  logIconIon: { width: 24 },
  logMsg: { fontSize: 13, fontWeight: "700", color: tc.ink, lineHeight: 18 },
  logTime: { fontSize: 12, fontWeight: "800", color: tc.inkMuted },
  logMeta: { marginTop: 4, fontSize: 11, color: tc.inkMuted, fontWeight: "600" },
});
}

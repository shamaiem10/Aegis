import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useResourceInventory } from "../../../lib/firestore/hooks";
import { runCrisisResourceSimulation } from "../../api/agents";
import type { CrisisSimulationResult, ResourceScenarioAdjustment } from "../../api/agentTypes";
import type { ResourceUnitApi, SignalApi } from "../../api/types";
import { listSignals, summarizeBackendError } from "../../api/client";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import type { RootStackParamList } from "../../navigation/types";
import { useThemeCiro } from "../../theme/useThemeCiro";
import { AgentServiceError } from "../../utils/agentErrors";
import { formatAlertDisplay } from "../../utils/formatAlertDisplay";

import { Card, PageHeader, Pill } from "./AppShell";

type Props = {
  initialActionId?: string;
};

type ResourceAdjRow = {
  resourceId: string;
  name: string;
  base: number;
  delta: number;
};

function topUnitsForSimulation(units: ResourceUnitApi[], limit = 8): ResourceAdjRow[] {
  return [...units]
    .sort((a, b) => b.quantity_available - a.quantity_available)
    .slice(0, limit)
    .map((u) => ({
      resourceId: u.resource_id,
      name: u.name,
      base: u.quantity_available,
      delta: 0,
    }));
}

function priTone(p: string): "alert" | "amber" | "mint" | "sky" {
  if (p === "CRITICAL" || p === "HIGH") return "alert";
  if (p === "MEDIUM") return "amber";
  return "mint";
}

export function SimulationLivePanel({ initialActionId: _initialActionId }: Props) {
  const route = useRoute<RouteProp<RootStackParamList, "SimulationLive">>();
  const focusSignalId = route.params?.signalId;
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const rootNav = useRootStackNavigation();
  const { units, loading: invLoading } = useResourceInventory();

  const [focusSignal, setFocusSignal] = useState<SignalApi | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsErr, setSignalsErr] = useState("");

  const [adjRows, setAdjRows] = useState<ResourceAdjRow[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simErr, setSimErr] = useState("");
  const [simResult, setSimResult] = useState<CrisisSimulationResult | null>(null);

  const loadFocus = useCallback(async () => {
    setSignalsLoading(true);
    setSignalsErr("");
    try {
      const all = await listSignals();
      if (focusSignalId) {
        const hit = all.find((s) => s.id === focusSignalId) ?? null;
        if (!hit) {
          setSignalsErr(`Alert ${focusSignalId} not in current feed.`);
          setFocusSignal(null);
        } else {
          setFocusSignal(hit);
        }
      } else {
        const high = all.filter((s) => s.severity_hint >= 7);
        setFocusSignal(high[0] ?? all[0] ?? null);
        if (!all.length) setSignalsErr("No alerts loaded — open Alerts tab first.");
      }
    } catch (e) {
      setSignalsErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
      setFocusSignal(null);
    } finally {
      setSignalsLoading(false);
    }
  }, [focusSignalId]);

  useFocusEffect(
    useCallback(() => {
      void loadFocus();
    }, [loadFocus]),
  );

  useEffect(() => {
    if (units.length > 0 && adjRows.length === 0) {
      setAdjRows(topUnitsForSimulation(units));
    }
  }, [units, adjRows.length]);

  const adjustDelta = (resourceId: string, step: number) => {
    setAdjRows((rows) =>
      rows.map((row) =>
        row.resourceId === resourceId
          ? { ...row, delta: Math.max(-row.base, Math.min(row.base * 2, row.delta + step)) }
          : row,
      ),
    );
    setSimResult(null);
  };

  const runScenario = async () => {
    if (!focusSignal) {
      setSimErr("Select an alert first (open Simulate from alert analysis).");
      return;
    }
    setSimLoading(true);
    setSimErr("");
    try {
      const adjustments: ResourceScenarioAdjustment[] = adjRows
        .filter((row) => row.delta !== 0)
        .map((row) => ({
          resourceId: row.resourceId,
          name: row.name,
          quantityDelta: row.delta,
          newQuantityAvailable: row.base + row.delta,
        }));
      if (!adjustments.length) {
        setSimErr("Change at least one resource (+/−) before simulating.");
        return;
      }
      const result = await runCrisisResourceSimulation(focusSignal, adjustments);
      setSimResult(result);
    } catch (e) {
      setSimResult(null);
      setSimErr(e instanceof AgentServiceError ? e.message : (e as Error).message ?? "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  };

  const focusDisplay = focusSignal ? formatAlertDisplay(focusSignal) : null;

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: 12,
          paddingBottom: r.insets.bottom + 24,
        },
      ]}
    >
      <PageHeader
        eyebrow="Resource simulation"
        title="Simulate this alert"
        sub="Adjust deployable units, then see before/after impact on this alert and other HIGH priority incidents."
      />

      {signalsLoading ? (
        <ActivityIndicator color={tc.primary} style={{ marginVertical: 16 }} />
      ) : signalsErr ? (
        <Card>
          <Text style={{ color: tc.alertDeep, fontWeight: "700" }}>{signalsErr}</Text>
          <Pressable
            onPress={() => rootNav.navigate("MainTabs", { screen: "Alerts" })}
            style={[styles.linkBtn, { borderColor: tc.tealDeep }]}
          >
            <Text style={{ color: tc.tealDeep, fontWeight: "800" }}>Go to Alerts</Text>
          </Pressable>
        </Card>
      ) : focusSignal && focusDisplay ? (
        <Card style={{ marginBottom: 14, borderLeftWidth: 4, borderLeftColor: tc.tealDeep }}>
          <Text style={[styles.focusLbl, { color: tc.inkMuted }]}>FOCUS ALERT</Text>
          <Text style={[styles.focusTitle, { color: tc.ink }]}>{focusDisplay.title}</Text>
          <Text style={[styles.focusMeta, { color: tc.inkSoft }]}>
            {focusDisplay.timeLabel} · severity {focusSignal.severity_hint}/10
          </Text>
          {!focusSignalId ? (
            <Text style={[styles.focusMeta, { color: tc.amberDeep, marginTop: 8 }]}>
              Tip: open Simulate from an alert for a locked focus.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ marginBottom: 14, padding: 16 }}>
        <Text style={[styles.section, { color: tc.inkMuted, marginBottom: 10 }]}>ADJUST RESOURCES</Text>
        {invLoading && !adjRows.length ? (
          <ActivityIndicator color={tc.primary} style={{ marginTop: 4 }} />
        ) : null}
        {adjRows.map((row) => (
          <View key={row.resourceId} style={[styles.adjRow, { borderColor: tc.border }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.adjName, { color: tc.ink }]} numberOfLines={2}>
                {row.name}
              </Text>
              <Text style={[styles.adjMeta, { color: tc.inkMuted }]}>
                {row.base} → {row.base + row.delta}
                {row.delta !== 0 ? ` (${row.delta > 0 ? "+" : ""}${row.delta})` : ""}
              </Text>
            </View>
            <View style={styles.adjBtns}>
              <Pressable onPress={() => adjustDelta(row.resourceId, -2)} style={[styles.adjBtn, { borderColor: tc.border }]}>
                <Text style={{ fontWeight: "900", color: tc.ink }}>−</Text>
              </Pressable>
              <Pressable
                onPress={() => adjustDelta(row.resourceId, 2)}
                style={[styles.adjBtn, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft }]}
              >
                <Text style={{ fontWeight: "900", color: tc.tealDeep }}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => void runScenario()}
          disabled={simLoading || !focusSignal}
          style={[styles.runBtn, { backgroundColor: tc.primaryDark, opacity: simLoading || !focusSignal ? 0.6 : 1 }]}
        >
          {simLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.runBtnTxt}>Run simulation</Text>
          )}
        </Pressable>
        {simErr ? <Text style={[styles.err, { color: tc.alertDeep }]}>{simErr}</Text> : null}
      </Card>

      {simResult || simLoading ? (
        <Card style={{ padding: 16 }}>
          {simLoading && !simResult ? (
            <Text style={[styles.hint, { color: tc.inkSoft }]}>
              Modeling impact on this alert and competing HIGH priority incidents…
            </Text>
          ) : null}
          {simResult ? (
            <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <Pill tone={simResult.degradedMode ? "amber" : "mint"}>
              {simResult.degradedMode ? "Rule-based" : "Groq"}
            </Pill>
            <Pill tone={priTone(simResult.focusPriorityBefore)}>
              Was {simResult.focusPriorityBefore}
            </Pill>
            <Pill tone={priTone(simResult.focusPriorityAfter)}>
              Now {simResult.focusPriorityAfter}
            </Pill>
          </View>

          <Text style={[styles.section, { color: tc.inkMuted }]}>FOCUS ALERT — BEFORE / AFTER</Text>
          <View style={[styles.compareRow, r.isCompact && styles.compareColStack]}>
            <View style={[styles.compareCol, { borderColor: "#f97316", backgroundColor: tc.warnSurface }]}>
              <View style={styles.compareHead}>
                <Ionicons name="alert-circle-outline" size={18} color="#c2410c" />
                <Text style={[styles.compareLbl, { color: "#c2410c" }]}>Before</Text>
              </View>
              <Text style={[styles.compareBody, { color: tc.ink }]}>{simResult.focusAlertBefore}</Text>
              <Text style={[styles.eta, { color: tc.inkMuted }]}>{simResult.focusResponseBefore}</Text>
            </View>
            <View style={styles.arrowCol}>
              <Ionicons name={r.isCompact ? "arrow-down" : "arrow-forward"} size={22} color={tc.tealDeep} />
            </View>
            <View style={[styles.compareCol, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft }]}>
              <View style={styles.compareHead}>
                <Ionicons name="checkmark-circle-outline" size={18} color={tc.tealDeep} />
                <Text style={[styles.compareLbl, { color: tc.tealDeep }]}>After</Text>
              </View>
              <Text style={[styles.compareBody, { color: tc.ink }]}>{simResult.focusAlertAfter}</Text>
              <Text style={[styles.eta, { color: tc.tealDeep }]}>{simResult.focusResponseAfter}</Text>
            </View>
          </View>

          <Text style={[styles.summary, { color: tc.inkSoft }]}>{simResult.crisisImpactSummary}</Text>
          <Pill tone="sky">
            Alert risk {simResult.overallRiskBefore}% → {simResult.overallRiskAfter}%
          </Pill>

          {simResult.highPriorityImpacts.length > 0 ? (
            <Card style={{ marginTop: 16 }}>
              <Text style={[styles.section, { color: tc.inkMuted }]}>OTHER HIGH PRIORITY ALERTS</Text>
              <Text style={[styles.hint, { color: tc.inkSoft, marginBottom: 10 }]}>
                How shifting resources for your focus alert affects the rest of the queue.
              </Text>
              {simResult.highPriorityImpacts.map((p) => (
                <View key={p.signalId} style={[styles.shiftRow, { borderColor: tc.borderSoft }]}>
                  <Text style={[styles.shiftHead, { color: tc.ink }]} numberOfLines={2}>
                    {p.headline}
                  </Text>
                  <Text style={[styles.shiftPri, { color: tc.tealDeep }]}>
                    {p.priorityBefore} → {p.priorityAfter}
                  </Text>
                  <Text style={[styles.shiftNote, { color: tc.ink }]}>{p.impact}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {simResult.recommendedActions.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.section, { color: tc.tealDeep }]}>ANALYSIS OUTPUT</Text>
              {simResult.recommendedActions.map((a) => (
                <Text key={a} style={[styles.bullet, { color: tc.ink }]}>
                  · {a}
                </Text>
              ))}
            </View>
          ) : null}
            </>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    hint: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
    err: { marginTop: 12, fontSize: 13, fontWeight: "600" },
    focusLbl: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
    focusTitle: { marginTop: 6, fontSize: 16, fontWeight: "800", lineHeight: 22 },
    focusMeta: { marginTop: 4, fontSize: 12, fontWeight: "600" },
    section: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    adjRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    adjName: { fontSize: 13, fontWeight: "800" },
    adjMeta: { marginTop: 2, fontSize: 11, fontWeight: "600" },
    adjBtns: { flexDirection: "row", gap: 6 },
    adjBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    runBtn: { marginTop: 14, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    runBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
    compareRow: { flexDirection: "row", alignItems: "stretch", gap: 6, marginTop: 8 },
    compareColStack: { flexDirection: "column" },
    compareCol: { flex: 1, borderRadius: 16, borderWidth: 2, padding: 12, minHeight: 120 },
    compareHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    compareLbl: { fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    compareBody: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
    eta: { marginTop: 10, fontSize: 11, fontWeight: "800" },
    arrowCol: { justifyContent: "center", paddingHorizontal: 2 },
    summary: { marginTop: 14, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    shiftRow: { marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
    shiftHead: { fontSize: 13, fontWeight: "800" },
    shiftPri: { marginTop: 4, fontSize: 12, fontWeight: "900" },
    shiftNote: { marginTop: 6, fontSize: 12, lineHeight: 17, fontWeight: "600" },
    bullet: { marginTop: 8, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    linkBtn: {
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
    },
  });
}

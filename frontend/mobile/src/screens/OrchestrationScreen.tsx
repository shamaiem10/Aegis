import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, useColorScheme } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { Card } from "../components/aegis/AppShell";
import { fetchLatestDossier, summarizeBackendError } from "../api/client";
import type { AntigravityTraceStepApi } from "../api/types";
import { useRootStackNavigation } from "../navigation/useRootStackNavigation";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";
import { Ionicons } from "@expo/vector-icons";
import type { IonName } from "../utils/alertIcons";

/** Pipeline node glows — same hexes as ciro neon tokens. */
const GLOW = {
  blue: "#38bdf8",
  lime: "#a3e635",
  cyan: "#22d3ee",
  red: "#fb7185",
} as const;

type OrchStyles = ReturnType<typeof createOrchestrationStyles>;

function OrchNode({
  label,
  caption,
  iconName,
  glow,
  width,
  iconSize,
  capLines = 2,
  orch,
}: {
  label: string;
  caption: string;
  iconName: IonName;
  glow: string;
  width: number;
  iconSize: number;
  capLines?: number;
  orch: OrchStyles;
}) {
  return (
    <View style={[orch.nodeWrap, { shadowColor: glow, borderColor: glow, width }]}>
      <Ionicons name={iconName} size={iconSize} color={glow} style={{ marginBottom: 6 }} />
      <Text style={orch.nodeLbl}>{label}</Text>
      <Text style={orch.nodeCap} numberOfLines={capLines}>
        {caption}
      </Text>
    </View>
  );
}

export function OrchestrationScreen() {
  const isFocused = useIsFocused();
  const schemeDark = useColorScheme() === "dark";
  const { tc, r, contentWrap } = useAegisUi();
  const rootNav = useRootStackNavigation();
  const orch = useMemo(() => createOrchestrationStyles(tc, schemeDark), [tc, schemeDark]);
  const [traces, setTraces] = useState<AntigravityTraceStepApi[]>([]);
  const [degraded, setDegraded] = useState<string[]>([]);
  const [crisisId, setCrisisId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          setError("");
          const d = await fetchLatestDossier();
          if (!alive) return;
          setCrisisId(d.crisis_id);
          const raw = d.meta?.antigravity_trace;
          setTraces(Array.isArray(raw) ? (raw as AntigravityTraceStepApi[]) : []);
          const im = d.meta?.ingest_meta as { degraded_mode?: string[] } | undefined;
          setDegraded(Array.isArray(im?.degraded_mode) ? im!.degraded_mode! : []);
        } catch (e) {
          if (alive) {
            setError(summarizeBackendError(e instanceof Error ? e.message : String(e)));
            setTraces([]);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const headTraces = traces.slice(0, 5);
  const highStep = traces.find((t) => (t.confidence ?? 0) >= 0.85);
  const confPct = highStep?.confidence != null ? Math.round(highStep.confidence * 100) : 94;
  const analysisCaption = `Confidence: ${confPct}%`;

  const chartPadH = r.isCompact ? 10 : 14;
  const chartInnerW = Math.max(0, r.width - 2 * r.horizontalPad - 2 * chartPadH);
  const midGap = r.isCompact ? 6 : 10;
  const twinSlot = Math.floor((chartInnerW - midGap) / 2);
  const useColumnFlow = r.isCompact || chartInnerW < 300 || r.fontScale > 1.12;
  const nodeWDiamond = Math.min(118, Math.max(80, twinSlot));
  const nodeWColumn = chartInnerW;
  const iconDiamond = r.isCompact ? 22 : 24;
  const titleSize = r.isCompact ? 20 : chartInnerW < 260 ? 21 : 24;

  const chevronColor = schemeDark ? "rgba(148,163,184,0.45)" : tc.inkMuted;

  const reasoningLines: { dt: string; msg: string }[] = [
    { dt: "0.2s", msg: "Signal cluster detected" },
    { dt: "0.8s", msg: "Cross-source correlation +12 events" },
    { dt: "1.4s", msg: "Confidence increased -> 94%" },
    { dt: "2.1s", msg: "Generating rerouting strategy" },
    { dt: "2.9s", msg: "Dispatch simulation initiated" },
  ];

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <ScrollView
        style={orch.wrap}
        contentContainerStyle={[
          orch.inner,
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 10,
            paddingBottom: r.tabBarClearance,
          },
        ]}
      >
        <View style={orch.top}>
          <View style={orch.topLeft}>
            <Text style={orch.orchEyebrow}>Orchestration</Text>
            <Text style={[orch.title, { fontSize: titleSize }]} numberOfLines={2}>
              Multi-Agent Reasoning
            </Text>
            <Text style={orch.subId} numberOfLines={1} ellipsizeMode="middle">
              {crisisId ? `Latest · ${crisisId}` : "Loading dossier…"}
            </Text>
          </View>
          <View style={orch.livePill}>
            <View style={orch.liveDot} />
            <Text style={orch.liveTxt}>Live</Text>
          </View>
        </View>

        {error ? (
          <Card style={orch.errCard}>
            <Text style={orch.errTxt}>{error}</Text>
            <Text style={orch.errHint}>Run pipeline once, or toggle demo in Settings.</Text>
          </Card>
        ) : null}

        {degraded.length > 0 ? (
          <Card style={orch.degradedCard}>
            <Text style={orch.degradedLbl}>Degraded mode</Text>
            <Text style={orch.degradedBody}>{degraded.join(" · ")}</Text>
          </Card>
        ) : null}

        <View style={[orch.chartCard, { paddingHorizontal: chartPadH }]}>
          {useColumnFlow ? (
            <>
              <OrchNode
                label="Signal"
                caption="Ingesting feeds"
                iconName="radio-outline"
                glow={GLOW.blue}
                width={nodeWColumn}
                iconSize={iconDiamond}
                orch={orch}
              />
              <View style={orch.colFlowMark}>
                <Ionicons name="chevron-down" size={18} color={chevronColor} />
              </View>
              <OrchNode
                label="Analysis"
                caption={analysisCaption}
                iconName="analytics-outline"
                glow={GLOW.lime}
                width={nodeWColumn}
                iconSize={iconDiamond}
                capLines={2}
                orch={orch}
              />
              <View style={orch.colFlowMark}>
                <Ionicons name="chevron-down" size={18} color={chevronColor} />
              </View>
              <OrchNode
                label="Planner"
                caption="Routing strategy"
                iconName="map-outline"
                glow={GLOW.cyan}
                width={nodeWColumn}
                iconSize={iconDiamond}
                orch={orch}
              />
              <View style={orch.colFlowMark}>
                <Ionicons name="chevron-down" size={18} color={chevronColor} />
              </View>
              <OrchNode
                label="Execution"
                caption="Dispatch ready"
                iconName="flash-outline"
                glow={GLOW.red}
                width={nodeWColumn}
                iconSize={iconDiamond}
                orch={orch}
              />
            </>
          ) : (
            <>
              <View style={orch.diamondCol}>
                <OrchNode
                  label="Signal"
                  caption="Ingesting feeds"
                  iconName="radio-outline"
                  glow={GLOW.blue}
                  width={nodeWDiamond}
                  iconSize={iconDiamond}
                  orch={orch}
                />
              </View>
              <View style={[orch.midRow, { gap: midGap }]}>
                <View style={orch.midHalf}>
                  <OrchNode
                    label="Analysis"
                    caption={analysisCaption}
                    iconName="analytics-outline"
                    glow={GLOW.lime}
                    width={nodeWDiamond}
                    iconSize={iconDiamond}
                    capLines={2}
                    orch={orch}
                  />
                </View>
                <View style={orch.midHalf}>
                  <OrchNode
                    label="Planner"
                    caption="Routing strategy"
                    iconName="map-outline"
                    glow={GLOW.cyan}
                    width={nodeWDiamond}
                    iconSize={iconDiamond}
                    orch={orch}
                  />
                </View>
              </View>
              <View style={orch.diamondCol}>
                <OrchNode
                  label="Execution"
                  caption="Dispatch ready"
                  iconName="flash-outline"
                  glow={GLOW.red}
                  width={nodeWDiamond}
                  iconSize={iconDiamond}
                  orch={orch}
                />
              </View>
              <View pointerEvents="none" style={orch.connectorV} />
              <View pointerEvents="none" style={orch.connectorH} />
            </>
          )}
        </View>

        <View style={orch.logCard}>
          <View style={orch.logHead}>
            <Text style={orch.logEyebrow}>Reasoning log</Text>
            <Text style={orch.stream}>streaming…</Text>
          </View>
          {reasoningLines.map((row) => (
            <View key={row.dt + row.msg} style={orch.traceRow}>
              <Text style={orch.reasonDt}>{row.dt}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={orch.traceDetail}>{row.msg}</Text>
              </View>
            </View>
          ))}
          {headTraces.length > 0 ? (
            <>
              <Text style={orch.apiTraceSep}>Pipeline trace</Text>
              {headTraces.map((row, i) => (
                <View key={`${row.agent}-${row.phase}-${i}`} style={orch.traceRow}>
                  <View style={orch.traceDot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={orch.traceAgent}>
                      {row.agent} · {row.phase}
                    </Text>
                    <Text style={orch.traceDetail}>{row.detail}</Text>
                    {row.outputs_summary ? (
                      <Text style={orch.traceOut}>{row.outputs_summary}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
          {traces.length > 5 ? (
            <Pressable onPress={() => rootNav.navigate("AgentTraces")} style={orch.moreHint}>
              <Text style={orch.moreHintTxt}>Open full trace →</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function createOrchestrationStyles(tc: ReturnType<typeof useThemeCiro>, schemeDark: boolean) {
  const orchEyebrowColor = schemeDark ? GLOW.cyan : tc.primaryDark;
  const streamColor = schemeDark ? GLOW.cyan : tc.primary;
  const reasonDtColor = schemeDark ? GLOW.cyan : tc.tealDeep;
  const traceAgentColor = schemeDark ? GLOW.lime : tc.tealDeep;
  const traceDotColor = schemeDark ? GLOW.lime : tc.accentGreen;
  const moreHintColor = schemeDark ? GLOW.cyan : tc.tealDeep;
  const liveBg = schemeDark ? "rgba(56,189,248,0.12)" : tc.tealSoft;
  const liveBorder = schemeDark ? "rgba(56,189,248,0.35)" : tc.border;
  const errBg = schemeDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)";
  const errBorder = schemeDark ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.25)";
  const errTxtCol = schemeDark ? "#fecaca" : tc.alertDeep;
  const degBorder = schemeDark ? "rgba(251,191,36,0.4)" : tc.amber;
  const degLbl = schemeDark ? "#fbbf24" : tc.amberDeep;
  const degBody = schemeDark ? "#fef3c7" : tc.ink;

  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.background },
    inner: { paddingTop: 12 },
    nodeWrap: {
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: tc.card,
      borderWidth: 1.5,
      alignItems: "center",
      shadowOpacity: 0.55,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    nodeLbl: {
      fontSize: 11,
      fontWeight: "900",
      color: tc.ink,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    nodeCap: { marginTop: 6, fontSize: 11, color: tc.inkMuted, textAlign: "center", fontWeight: "600" },
    top: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    topLeft: { flex: 1, minWidth: 0, paddingRight: 10 },
    subId: { marginTop: 6, fontSize: 11, color: tc.inkMuted, fontWeight: "600" },
    orchEyebrow: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 3,
      color: orchEyebrowColor,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 8,
      fontSize: 24,
      fontWeight: "800",
      color: tc.ink,
      letterSpacing: -0.6,
    },
    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: liveBg,
      borderWidth: 1,
      borderColor: liveBorder,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: streamColor,
      shadowColor: streamColor,
      shadowOpacity: schemeDark ? 0.9 : 0.35,
      shadowRadius: 6,
    },
    liveTxt: { fontSize: 11, fontWeight: "900", color: streamColor, letterSpacing: 1 },
    errCard: {
      marginBottom: 12,
      padding: 14,
      backgroundColor: errBg,
      borderWidth: 1,
      borderColor: errBorder,
    },
    errTxt: { color: errTxtCol, fontWeight: "700", fontSize: 13 },
    errHint: { marginTop: 6, color: tc.inkMuted, fontSize: 12 },
    degradedCard: {
      marginBottom: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: degBorder,
      backgroundColor: schemeDark ? "transparent" : tc.warnSurface,
    },
    degradedLbl: {
      fontSize: 10,
      fontWeight: "900",
      color: degLbl,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    degradedBody: { marginTop: 6, fontSize: 12, color: degBody, fontWeight: "600" },
    chartCard: {
      backgroundColor: tc.card,
      borderRadius: 28,
      paddingVertical: 22,
      borderWidth: 1,
      borderColor: tc.border,
      position: "relative",
      marginBottom: 18,
      alignSelf: "stretch",
    },
    colFlowMark: { alignItems: "center", paddingVertical: 2 },
    diamondCol: { alignItems: "center" },
    midRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 14,
    },
    midHalf: { flex: 1, minWidth: 0, alignItems: "center" },
    connectorV: {
      position: "absolute",
      left: "50%",
      marginLeft: -1,
      top: "11%",
      bottom: "11%",
      width: 2,
      backgroundColor: schemeDark ? "rgba(148,163,184,0.25)" : "rgba(100,116,139,0.2)",
    },
    connectorH: {
      position: "absolute",
      top: "50%",
      marginTop: -1,
      left: "10%",
      right: "10%",
      height: 2,
      backgroundColor: schemeDark ? "rgba(148,163,184,0.25)" : "rgba(100,116,139,0.2)",
    },
    logCard: {
      backgroundColor: tc.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: tc.border,
      alignSelf: "stretch",
    },
    logHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
      alignItems: "center",
    },
    logEyebrow: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      color: tc.inkMuted,
      textTransform: "uppercase",
    },
    stream: {
      fontSize: 11,
      fontWeight: "800",
      color: streamColor,
      fontStyle: "italic",
    },
    apiTraceSep: {
      marginTop: 16,
      marginBottom: 10,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
      color: tc.inkMuted,
      textTransform: "uppercase",
    },
    reasonDt: {
      fontSize: 12,
      fontWeight: "900",
      color: reasonDtColor,
      width: 44,
      marginTop: 2,
    },
    traceAgent: { fontSize: 12, fontWeight: "900", color: traceAgentColor },
    traceDetail: { marginTop: 4, fontSize: 13, color: tc.ink, lineHeight: 20 },
    traceOut: { marginTop: 4, fontSize: 11, color: tc.inkMuted },
    moreHint: { marginTop: 10 },
    moreHintTxt: { fontSize: 11, color: moreHintColor, fontWeight: "700" },
    traceRow: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
    traceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: traceDotColor,
      marginTop: 6,
    },
  });
}

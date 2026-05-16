import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, useColorScheme } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { AegisMap } from "../../components/AegisMap";
import { Card, MapCardChrome, KpiTile, AlertPreviewRow, Pill, type AlertPriority } from "../components/aegis/AppShell";
import {
  fetchHealth,
  getApiBase,
  defaultApiBase,
  getDemoModeResolved,
  summarizeBackendError,
  connectivityHintForApiBase,
  listSignals,
  listCrises,
} from "../api/client";
import { useAntigravityPulse } from "../../lib/firestore/hooks";
import type { SignalApi, CrisisDossierApi } from "../api/types";
import { useForegroundRegion } from "../hooks/useForegroundRegion";
import { useAegisUi } from "../hooks/useAegisUi";
import { useRootStackNavigation } from "../navigation/useRootStackNavigation";
import { alertIconForSignal, type IonName } from "../utils/alertIcons";
import { getAQIColor, getAQILabel } from "../utils/aqi";
import { getCrisisTypeConfig, crisisThemeHex } from "../constants/crisisTypes";
import { useThemeCiro } from "../theme/useThemeCiro";

function severityToPriority(sev: number): AlertPriority {
  if (sev >= 8) return "HIGH";
  if (sev >= 5) return "MED";
  return "LOW";
}

function formatRelativePkt(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function EnvBar({
  label,
  value,
  color,
  sub,
  tc,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
  tc: ReturnType<typeof useThemeCiro>;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: tc.ink }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: "900", color }}>{value}/100</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: tc.muted, overflow: "hidden", flexDirection: "row" }}>
        <View style={{ flex: value, backgroundColor: color, borderRadius: 4 }} />
        <View style={{ flex: Math.max(0, 100 - value) }} />
      </View>
      <Text style={{ marginTop: 6, fontSize: 11, fontWeight: "600", color: tc.inkSoft }}>{sub}</Text>
    </View>
  );
}

/** Pixel design reference when feed is empty or for first rows in demo (mockup copy). */
const DESIGN_ALERTS: {
  signalId?: string;
  iconName: IonName;
  title: string;
  timeLine: string;
  priority: AlertPriority;
}[] = [
  {
    iconName: "water-outline",
    title: "Flood detected in G-10",
    timeLine: "2m ago · auto-detected",
    priority: "HIGH",
  },
  {
    iconName: "bus-outline",
    title: "Traffic spike in Blue Area",
    timeLine: "14m ago · auto-detected",
    priority: "MED",
  },
];

const AI_PULSE_OBS = [
  "AQI-Sensor-F7-03 reading PM2.5 at 194 µg/m³ — 6.4× WHO daily limit — escalating to High severity",
  "Wind direction shift detected (NW → SE) — industrial plume trajectory now covers F-7 and G-7 residential zones",
  "Dust storm warning issued by PMD for Rawalpindi corridor — visibility forecast <200m by 18:00",
  "CompoundRiskAgent: I-8 heat index 47°C + PM2.5 drift — vulnerable population revised to 4,100.",
];

const FUSION_TICKER: { icon: IonName; label: string }[] = [
  { icon: "water-outline", label: "G-10 water main" },
  { icon: "leaf-outline", label: "PEPA F-7 cluster" },
  { icon: "fitness-outline", label: "AQI sensor lungs" },
  { icon: "globe-outline", label: "Satellite feed" },
  { icon: "business-outline", label: "EPA station" },
  { icon: "cloud-outline", label: "PMD advisory" },
  { icon: "medkit-outline", label: "PIMS respiratory" },
];

export function HomeScreen() {
  const rootNav = useRootStackNavigation();
  const isFocused = useIsFocused();
  const schemeDark = useColorScheme() === "dark";
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createHomeStyles(tc), [tc]);
  const { region, locationError } = useForegroundRegion();
  const [basePreview, setBasePreview] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [mapDelta, setMapDelta] = useState(0.06);
  const [pkFeedAll, setPkFeedAll] = useState<SignalApi[]>([]);
  const [recentSignals, setRecentSignals] = useState<SignalApi[]>([]);
  const [hqOnline, setHqOnline] = useState<boolean | null>(null);
  const [hqHelp, setHqHelp] = useState("");
  const [dashCrises, setDashCrises] = useState<CrisisDossierApi[]>([]);
  const [simCityAqi, setSimCityAqi] = useState(187);
  const [aiPulseIdx, setAiPulseIdx] = useState(0);

  const ping = useCallback(async () => {
    try {
      const d = await getDemoModeResolved();
      setDemoMode(d);
      const b = await getApiBase();
      setBasePreview(b);
      await fetchHealth();
      setHqOnline(true);
      setHqHelp("");
    } catch (e) {
      const raw = (e as Error).message ?? String(e);
      setHqOnline(false);
      setHqHelp(summarizeBackendError(raw));
    }
  }, []);

  const loadSignals = useCallback(async () => {
    try {
      const data = await listSignals();
      const sorted = [...data].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
      setPkFeedAll(sorted);
      setRecentSignals(sorted.slice(0, 2));
      setHqOnline(true);
      setHqHelp("");
    } catch {
      setPkFeedAll([]);
      setRecentSignals([]);
    }
  }, []);

  const loadCrises = useCallback(async () => {
    try {
      const data = await listCrises({ limit: 30 });
      const activeish = data.filter((c) => c.status === "active" || c.status === "monitoring");
      setDashCrises(activeish);
    } catch {
      setDashCrises([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void ping();
      void loadSignals();
      void loadCrises();
    }, [ping, loadSignals, loadCrises]),
  );

  const airCrisisLive = useMemo(
    () => dashCrises.some((c) => c.crisis_id === "crisis-f7-003" || typeof c.meta?.aqi === "number"),
    [dashCrises],
  );

  useEffect(() => {
    if (!airCrisisLive) return;
    const id = setInterval(() => {
      setSimCityAqi((a) => Math.min(310, a + 1 + Math.floor(Math.random() * 3)));
    }, 15_000);
    return () => clearInterval(id);
  }, [airCrisisLive]);

  const { data: pulseMessage } = useAntigravityPulse();

  const maxAqi = useMemo(() => {
    let m = 0;
    for (const c of dashCrises) {
      const aqi = typeof c.meta?.aqi === "number" ? (c.meta.aqi as number) : 0;
      if (aqi > m) m = aqi;
    }
    return m;
  }, [dashCrises]);

  const criticalN = useMemo(
    () => pkFeedAll.filter((s) => s.severity_hint >= 8).length,
    [pkFeedAll],
  );

  const crisisCriticalLabels = useMemo(
    () =>
      dashCrises.filter((c) => {
        const label = (c.meta?.ui_severity_label as string | undefined) ?? "";
        return label === "Critical" || c.severity.score >= 8;
      }).length,
    [dashCrises],
  );

  const showSeverityBanner = crisisCriticalLabels > 0 || maxAqi > 200;

  const activeCount = pkFeedAll.length;
  const crisisProb = pkFeedAll.some((s) => s.severity_hint >= 7) ? 28 : 12;
  const responseEff = demoMode || hqOnline !== false ? 94 : 46;
  const isStable = criticalN === 0 && crisisProb <= 15;

  const kpiSignals = demoMode && activeCount === 0 ? 142 : activeCount;
  const kpiSignalsTrend = demoMode || kpiSignals >= 100 ? "+8" : undefined;
  const kpiCrisisHint = crisisProb > 20 ? "elevated" : "low";
  const kpiResponseTrend = demoMode || hqOnline !== false ? "+3%" : undefined;

  const alertRows = useMemo(() => {
    if (recentSignals.length >= 2) {
      return recentSignals.slice(0, 2).map((s) => ({
        key: s.id,
        signalId: s.id,
        iconName: alertIconForSignal(s.kind, s.text),
        title: s.text.length > 56 ? `${s.text.slice(0, 56)}…` : s.text,
        timeLine: `${formatRelativePkt(s.recorded_at)} · auto-detected`,
        priority: severityToPriority(s.severity_hint),
      }));
    }
    if (recentSignals.length === 1) {
      const s = recentSignals[0];
      return [
        {
          key: s.id,
          signalId: s.id,
          iconName: alertIconForSignal(s.kind, s.text),
          title: s.text.length > 56 ? `${s.text.slice(0, 56)}…` : s.text,
          timeLine: `${formatRelativePkt(s.recorded_at)} · auto-detected`,
          priority: severityToPriority(s.severity_hint),
        },
        { ...DESIGN_ALERTS[1], key: "design-2", signalId: undefined },
      ];
    }
    return DESIGN_ALERTS.map((d, i) => ({ ...d, key: `design-${i}` }));
  }, [recentSignals]);

  const apiLineMini = demoMode ? "demo bundle" : `${basePreview || defaultApiBase()}`;

  const kpiTileW = Math.max(96, Math.min(132, (r.width - r.horizontalPad * 2 - 3 * r.gap) / 4));

  const topCrises = useMemo(() => {
    const sorted = [...dashCrises].sort((a, b) => b.severity.score - a.severity.score);
    return sorted.slice(0, 3);
  }, [dashCrises]);

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.inner,
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 10,
            paddingBottom: r.tabBarClearance,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.greetLine, { fontSize: r.bodySize(15), color: tc.inkSoft }]}>
              Good Morning,
            </Text>
            <Text
              style={[styles.teamTitle, { fontSize: r.titleSize(24), color: tc.ink }]}
              numberOfLines={2}
            >
              Response Team
            </Text>
          </View>
          <View
            style={[
              styles.stablePill,
              { backgroundColor: tc.card, borderColor: tc.border },
              !isStable ? styles.stablePillWarn : null,
            ]}
          >
            <View style={[styles.stableDot, !isStable ? styles.stableDotWarn : null]} />
            <Text
              style={[
                styles.stableTxt,
                { color: tc.mintDark },
                !isStable ? styles.stableTxtWarn : null,
              ]}
              numberOfLines={1}
            >
              {isStable ? "Islamabad Stable" : "Islamabad · watch"}
            </Text>
          </View>
          <Pressable
            onPress={() => rootNav.navigate("Settings")}
            style={[styles.gearBtn, { backgroundColor: tc.card, borderColor: tc.border }]}
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={22} color={tc.inkSoft} />
          </Pressable>
        </View>
        <Text style={[styles.apiMicro, { color: tc.inkMuted }]} numberOfLines={1}>
          {apiLineMini}
        </Text>

        {showSeverityBanner ? (
          <Pressable
            onPress={() => rootNav.navigate("Crises")}
            style={[
              styles.sevBanner,
              {
                backgroundColor: schemeDark ? "#3b0764" : "#f3e8ff",
                borderColor: maxAqi > 200 ? getAQIColor(maxAqi, schemeDark) : tc.border,
              },
            ]}
          >
            <Ionicons name="warning-outline" size={18} color={getAQIColor(maxAqi > 200 ? maxAqi : 180, schemeDark)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.sevBannerTitle, { color: tc.ink }]} numberOfLines={2}>
                {crisisCriticalLabels} Critical
                {maxAqi > 200
                  ? ` · AQI ${Math.max(maxAqi, simCityAqi)} — F-7 Industrial Zone`
                  : ""}
              </Text>
              <Text style={[styles.sevBannerSub, { color: tc.inkSoft }]}>Tap for Active Crises</Text>
            </View>
            {maxAqi > 200 ? (
              <View style={[styles.aqiChip, { borderColor: getAQIColor(maxAqi, schemeDark) }]}>
                <Text style={[styles.aqiChipTxt, { color: getAQIColor(maxAqi, schemeDark) }]}>
                  AQI {maxAqi}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        <Card style={[styles.mapCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
          <MapCardChrome
            eyebrow="LIVE"
            title="Smart City Grid"
            hint="Traffic layer on supported builds. Pins = ingested signals in AOI."
            onZoomIn={() => setMapDelta((d) => Math.max(0.015, d * 0.65))}
            onZoomOut={() => setMapDelta((d) => Math.min(0.25, d * 1.35))}
          />
          {locationError ? <Text style={styles.warn}>{locationError}</Text> : null}
          <View style={[styles.mapWrap, { height: r.mapHeight }]}>
            <AegisMap region={region} latitudeDelta={mapDelta} longitudeDelta={mapDelta} />
          </View>
          <View style={styles.pillRow}>
            <Pill tone="ink">Grid</Pill>
            {demoMode ? <Pill tone="amber">demo</Pill> : <Pill tone="mint">live</Pill>}
            <Pill tone={hqOnline === false ? "alert" : "mint"}>
              {hqOnline === false ? "link down" : "HQ"}
            </Pill>
          </View>
          {!demoMode && hqOnline === false && hqHelp ? (
            <View style={styles.hqBox}>
              <Text style={styles.hqHelp}>
                {hqHelp}
                {connectivityHintForApiBase(basePreview)}
              </Text>
              <Pressable onPress={() => rootNav.navigate("Settings")} style={styles.hqBtn}>
                <Text style={styles.hqBtnTxt}>Connection settings</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 14 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {FUSION_TICKER.map((t, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: tc.card,
                borderWidth: 1,
                borderColor: tc.border,
              }}
            >
              <Ionicons name={t.icon} size={14} color={tc.tealDeep} />
              <Text style={{ fontSize: 11, fontWeight: "800", color: tc.ink }}>{t.label}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill tone="amber">Shared resources: 3 units across 3 incidents</Pill>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.kpiScrollInner, { gap: r.gap, paddingVertical: 2 }]}
          style={styles.kpiScroll}
        >
          <View style={{ width: kpiTileW }}>
            <KpiTile
              label="Active Signals"
              value={String(kpiSignals)}
              trend={kpiSignalsTrend}
              hint="live index"
              hintTone="green"
              iconName="pulse-outline"
            />
          </View>
          <View style={{ width: kpiTileW }}>
            <KpiTile
              label="Crisis Probability"
              value={`${crisisProb}%`}
              hint={kpiCrisisHint}
              hintTone={crisisProb > 20 ? "red" : "green"}
              iconName="warning-outline"
            />
          </View>
          <View style={{ width: kpiTileW }}>
            <KpiTile
              label="Avg City AQI"
              value={airCrisisLive ? String(simCityAqi) : "—"}
              hint={airCrisisLive ? getAQILabel(simCityAqi) : "no AQ crisis"}
              hintTone={airCrisisLive && simCityAqi > 150 ? "red" : "green"}
              iconName="leaf-outline"
            />
          </View>
          <View style={{ width: kpiTileW }}>
            <KpiTile
              label="Response Eff."
              value={`${responseEff}%`}
              trend={kpiResponseTrend}
              hint="ops posture"
              hintTone="green"
              iconName="shield-checkmark-outline"
            />
          </View>
        </ScrollView>

        <Card style={{ marginTop: 16, padding: 16, backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border }}>
          <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: tc.inkMuted }}>
            ENVIRONMENTAL RISK INDEX
          </Text>
          <EnvBar
            label="Heat stress"
            value={74}
            color="#ea580c"
            sub="Heat index 47°C, humidity 68%"
            tc={tc}
          />
          <EnvBar
            label="Air quality"
            value={81}
            color={getAQIColor(280, schemeDark)}
            sub="F-7 plume + boundary drift to G-7"
            tc={tc}
          />
          <EnvBar label="Flood risk" value={62} color="#2563eb" sub="G-10 water main + road ponding" tc={tc} />
        </Card>

        {topCrises.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={[styles.sectionTitle, { color: tc.ink }]}>Active crises</Text>
            {topCrises.map((c) => {
              const ct = (c.meta?.crisis_type as string) ?? c.classification.category;
              const cfg = getCrisisTypeConfig(ct);
              const name = (c.meta?.display_name as string) ?? c.crisis_id;
              const conf = (c.meta?.confidence_pct as number | undefined) ?? c.classification.confidence * 100;
              const aqi = c.meta?.aqi as number | undefined;
              const border = crisisThemeHex(cfg.color, schemeDark);
              return (
                <Pressable
                  key={c.crisis_id}
                  onPress={() => rootNav.navigate("CrisisDetail", { id: c.crisis_id })}
                  style={[
                    {
                      marginTop: 10,
                      padding: 14,
                      borderRadius: 18,
                      backgroundColor: tc.card,
                      borderWidth: 1,
                      borderColor: tc.border,
                      borderLeftWidth: 4,
                      borderLeftColor: border,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name={cfg.icon} size={22} color={border} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: tc.ink }} numberOfLines={2}>
                        {name}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: tc.inkSoft, marginTop: 4 }}>
                        {String(c.meta?.ui_severity_label ?? "")}{" "}
                        {(c.meta?.ui_severity_label as string) ? "·" : ""} confidence {Math.round(conf)}%
                        {typeof aqi === "number" ? ` · AQI ${aqi}` : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Card
          style={{
            marginTop: 18,
            padding: 16,
            backgroundColor: schemeDark ? tc.darkCard : tc.sky,
            borderColor: tc.border,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: tc.tealDeep }}>
            AI PULSE · ANTIGRAVITY
          </Text>
          <Text style={{ marginTop: 10, fontSize: 14, fontWeight: "600", color: tc.ink, lineHeight: 20 }}>
            {String(pulseMessage?.summary ?? "Antigravity orchestration idle.")}
          </Text>
        </Card>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: tc.ink }]}>Recent Alerts</Text>
          <Pressable onPress={() => rootNav.navigate("MainTabs", { screen: "Alerts" })}>
            <Text style={[styles.sectionLink, { color: tc.tealDeep }]}>View all</Text>
          </Pressable>
        </View>

        {alertRows.map((row) => (
          <AlertPreviewRow
            key={row.key}
            iconName={row.iconName}
            title={row.title}
            timeLabel={row.timeLine}
            priority={row.priority}
            onPress={() =>
              row.signalId
                ? rootNav.navigate("AlertAnalysis", { signalId: row.signalId })
                : rootNav.navigate("AlertAnalysis", {})
            }
          />
        ))}
      </ScrollView>
    </>
  );
}

function createHomeStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tc.canvas },
  inner: {},
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  greetLine: {
    fontSize: 15,
    fontWeight: "600",
    color: tc.inkSoft,
  },
  teamTitle: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: tc.ink,
  },
  stablePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tc.accentGreenSoft,
    borderWidth: 1,
    borderColor: tc.borderSoft,
    flexShrink: 1,
    maxWidth: 170,
  },
  stablePillWarn: {
    backgroundColor: tc.warnSurface,
    borderColor: tc.amber,
  },
  stableDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tc.accentGreen,
  },
  stableDotWarn: { backgroundColor: tc.amber },
  stableTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: tc.mintDark,
  },
  stableTxtWarn: { color: tc.amberDeep },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: tc.card,
    borderWidth: 1,
    borderColor: tc.border,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiScroll: { marginTop: 18 },
  kpiScrollInner: { flexDirection: "row", alignItems: "stretch" },
  apiMicro: {
    fontSize: 11,
    color: tc.inkMuted,
    marginBottom: 14,
    fontWeight: "600",
  },
  sevBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  sevBannerTitle: { fontSize: 14, fontWeight: "900" },
  sevBannerSub: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  aqiChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  aqiChipTxt: { fontSize: 11, fontWeight: "900" },
  mapCard: {
    paddingBottom: 16,
    borderRadius: 28,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  mapWrap: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tc.border,
    backgroundColor: tc.muted,
  },
  warn: { color: tc.alertDeep, marginBottom: 8, fontSize: 12, fontWeight: "600" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  sectionHead: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: tc.ink,
    textTransform: "uppercase",
  },
  sectionLink: { fontSize: 14, fontWeight: "800", color: tc.tealDeep },
  hqBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: tc.sky,
    borderWidth: 1,
    borderColor: tc.tealSoft,
  },
  hqHelp: {
    fontSize: 12,
    color: tc.ink,
    lineHeight: 18,
    fontWeight: "600",
  },
  hqBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: tc.card,
    borderWidth: 1,
    borderColor: tc.border,
  },
  hqBtnTxt: { fontSize: 12, fontWeight: "800", color: tc.primaryDark },
  });
}

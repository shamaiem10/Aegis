import { useCallback, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import {
  HomeDashboardLayout,
  type HomeAlertRowData,
  type HomeCrisisCard,
} from "../components/aegis/HomeDashboardLayout";
import { type AlertPriority } from "../components/aegis/AppShell";
import {
  fetchHealth,
  getApiBase,
  pkMockAlertsRemoteBase,
  getDemoModeResolved,
  summarizeBackendError,
  listSignals,
  listCrises,
} from "../api/client";
import { useAntigravityPulse } from "../../lib/firestore/hooks";
import type { SignalApi, CrisisDossierApi } from "../api/types";
import { useForegroundRegion } from "../hooks/useForegroundRegion";
import { usePakistanEnvRiskIndex } from "../hooks/usePakistanEnvRiskIndex";
import { useAegisUi } from "../hooks/useAegisUi";
import { useRootStackNavigation } from "../navigation/useRootStackNavigation";
import { alertIconForSignal, type IonName } from "../utils/alertIcons";
import { getCrisisTypeConfig, crisisThemeHex } from "../constants/crisisTypes";
import {
  allocationSummary,
  avgClassificationConfidencePct,
  crisisDisplayTitle,
  fusionTickerFromSignals,
} from "../utils/homeDashboard";
import { formatAlertDisplay } from "../utils/formatAlertDisplay";

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

function coerceDisplayText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

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

const HOME_ALERT_LIMIT = 5;

export function HomeScreen() {
  const rootNav = useRootStackNavigation();
  const isFocused = useIsFocused();
  const schemeDark = useColorScheme() === "dark";
  const { r } = useAegisUi();
  const { region, locationError } = useForegroundRegion();
  const [basePreview, setBasePreview] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [mapDelta, setMapDelta] = useState(0.06);
  const [pkFeedAll, setPkFeedAll] = useState<SignalApi[]>([]);
  const [hqOnline, setHqOnline] = useState<boolean | null>(null);
  const [hqHelp, setHqHelp] = useState("");
  const [dashCrises, setDashCrises] = useState<CrisisDossierApi[]>([]);

  const pkMockBase = pkMockAlertsRemoteBase();

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
      setHqOnline(true);
      setHqHelp("");
    } catch {
      setPkFeedAll([]);
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

  const { data: pulseMessage } = useAntigravityPulse();
  const { envIndex, loading: envLoading, selectedCity, setSelectedCity } = usePakistanEnvRiskIndex(
    region ? { lat: region.latitude, lon: region.longitude } : null,
  );

  const maxAqi = useMemo(() => {
    let m = 0;
    for (const c of dashCrises) {
      const aqi = typeof c.meta?.aqi === "number" ? (c.meta.aqi as number) : 0;
      if (aqi > m) m = aqi;
    }
    return m;
  }, [dashCrises]);

  const displayAqi = envIndex.pakistanAqi ?? (maxAqi > 0 ? maxAqi : null);

  const criticalN = useMemo(
    () => pkFeedAll.filter((s) => s.severity_hint >= 8).length,
    [pkFeedAll],
  );

  const crisisCriticalLabels = useMemo(
    () =>
      dashCrises.filter((c) => {
        const label = (c.meta?.ui_severity_label as string | undefined) ?? "";
        const score = Number(c.severity?.score);
        return label === "Critical" || (Number.isFinite(score) && score >= 8);
      }).length,
    [dashCrises],
  );

  const showSeverityBanner =
    crisisCriticalLabels > 0 || (displayAqi != null && displayAqi > 200);

  const activeCount = pkFeedAll.length;
  const crisisProbPct = useMemo(() => {
    if (!dashCrises.length) return 0;
    const avg =
      dashCrises.reduce((a, c) => a + (Number(c.severity?.score) || 0), 0) / dashCrises.length;
    return Math.min(99, Math.round(avg * 10));
  }, [dashCrises]);

  const avgConfPct = useMemo(() => avgClassificationConfidencePct(dashCrises), [dashCrises]);
  const responseEffDisplay = avgConfPct != null ? String(avgConfPct) : "—";
  const isStable = criticalN === 0 && crisisProbPct <= 15;
  const kpiCrisisHint = crisisProbPct > 20 ? "elevated" : "low";

  const alertRows: HomeAlertRowData[] = useMemo(() => {
    const fromApi = (signals: SignalApi[]): HomeAlertRowData[] =>
      signals.map((s) => {
        const display = formatAlertDisplay(s);
        return {
          key: s.id,
          signalId: s.id,
          iconName: alertIconForSignal(s.kind, s.text),
          title: display.title,
          timeLine: `${formatRelativePkt(s.recorded_at)} · ${display.timeLabel}`,
          priority: severityToPriority(s.severity_hint),
        };
      });

    if (pkFeedAll.length > 0) return fromApi(pkFeedAll);
    if (demoMode) return DESIGN_ALERTS.map((d, i) => ({ ...d, key: `design-${i}` }));
    return [];
  }, [pkFeedAll, demoMode]);

  const recentAlerts = useMemo(() => alertRows.slice(0, HOME_ALERT_LIMIT), [alertRows]);

  const feedSummary = useMemo(() => {
    if (demoMode) return "Demo mode · offline sample data";
    if (pkMockBase) return "Pakistan category feeds · live mock APIs";
    if (hqOnline === false) return "Backend unreachable · check Settings";
    return "Live API · connected";
  }, [demoMode, pkMockBase, hqOnline]);

  const signalsEmptyHint = useMemo(() => {
    if (demoMode || pkFeedAll.length > 0) return null;
    if (pkMockBase) return "No signals from category feeds yet — open Alerts to refresh.";
    return "No ingested signals yet — verify Backend URL in Settings.";
  }, [demoMode, pkFeedAll.length, pkMockBase]);

  const alertsEmptyHint = useMemo(() => {
    if (recentAlerts.length > 0 || demoMode) return null;
    if (pkMockBase) {
      return "No alerts loaded from Pakistan mock feeds. Check EXPO_PUBLIC_PK_MOCK_ALERTS_URL and restart Expo.";
    }
    return "No alerts from the API. Open Settings → Backend URL, or try the Alerts tab.";
  }, [recentAlerts.length, demoMode, pkMockBase]);

  const topCrises = useMemo(() => {
    const sorted = [...dashCrises].sort(
      (a, b) => (Number(b.severity?.score) || 0) - (Number(a.severity?.score) || 0),
    );
    return sorted.slice(0, 3);
  }, [dashCrises]);

  const crisisCards: HomeCrisisCard[] = useMemo(
    () =>
      topCrises.map((c) => {
        const ct = (c.meta?.crisis_type as string) ?? c.classification?.category ?? "other";
        const cfg = getCrisisTypeConfig(ct);
        const confRaw = c.meta?.confidence_pct as number | undefined;
        const conf =
          typeof confRaw === "number"
            ? confRaw
            : Math.round((Number(c.classification?.confidence) || 0) * 100);
        const aqi = c.meta?.aqi as number | undefined;
        const sevLabel = String(c.meta?.ui_severity_label ?? "").trim();
        const metaParts = [
          sevLabel || null,
          sevLabel ? `confidence ${Math.round(conf)}%` : `confidence ${Math.round(conf)}%`,
          typeof aqi === "number" ? `AQI ${aqi}` : null,
        ].filter(Boolean);
        return {
          crisisId: c.crisis_id,
          name: crisisDisplayTitle(c),
          metaLine: metaParts.join(" · "),
          icon: cfg.icon,
          borderColor: crisisThemeHex(cfg.color, schemeDark),
        };
      }),
    [topCrises, schemeDark],
  );

  const fusionChips = useMemo(() => {
    if (demoMode) return [];
    return fusionTickerFromSignals(pkFeedAll);
  }, [pkFeedAll, demoMode]);

  const allocHint = useMemo(() => allocationSummary(dashCrises), [dashCrises]);

  const localityLabel = useMemo(() => {
    const reg = pkFeedAll[0]?.region?.trim() || dashCrises[0]?.fused?.[0]?.region?.trim();
    return reg && reg.length > 0 ? reg.slice(0, 28) : "Operations";
  }, [pkFeedAll, dashCrises]);

  const pulseText = useMemo(() => {
    const s = coerceDisplayText(pulseMessage?.summary as unknown);
    if (s) return s;
    const c = topCrises[0];
    if (c) {
      const w = coerceDisplayText(c.severity?.weather_note);
      const ra = coerceDisplayText(c.classification?.rationale);
      const pick = w || ra;
      if (pick) return pick.length > 320 ? `${pick.slice(0, 317)}…` : pick;
    }
    return "No live orchestration summary yet. Open a crisis dossier or configure Firestore antigravity pulse.";
  }, [pulseMessage, topCrises]);

  const severityBannerLeadCrisis = useMemo(() => {
    const c =
      topCrises.find((x) => {
        const lbl = (x.meta?.ui_severity_label as string | undefined) ?? "";
        const score = Number(x.severity?.score);
        return lbl === "Critical" || (Number.isFinite(score) && score >= 8);
      }) ?? topCrises[0];
    if (!c) return "";
    const t = crisisDisplayTitle(c);
    return t.length > 48 ? `${t.slice(0, 45)}…` : t;
  }, [topCrises]);

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <HomeDashboardLayout
        contentPadding={{
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 10,
          paddingBottom: r.tabBarClearance,
        }}
        localityLabel={localityLabel}
        isStable={isStable}
        feedSummary={feedSummary}
        onSettings={() => rootNav.navigate("Settings")}
        showSeverityBanner={showSeverityBanner}
        crisisCriticalLabels={crisisCriticalLabels}
        displayAqi={displayAqi}
        severityBannerLeadCrisis={severityBannerLeadCrisis}
        onOpenCrises={() => rootNav.navigate("Crises")}
        region={region}
        mapDelta={mapDelta}
        locationError={locationError}
        onZoomIn={() => setMapDelta((d) => Math.max(0.015, d * 0.65))}
        onZoomOut={() => setMapDelta((d) => Math.min(0.25, d * 1.35))}
        demoMode={demoMode}
        hqOnline={hqOnline}
        hqHelp={hqHelp}
        basePreview={basePreview}
        onConnectionSettings={() => rootNav.navigate("Settings")}
        fusionChips={fusionChips}
        allocHint={allocHint}
        signalsEmptyHint={signalsEmptyHint}
        kpiSignals={activeCount}
        crisisProbPct={crisisProbPct}
        kpiCrisisHint={kpiCrisisHint}
        envLoading={envLoading}
        responseEffDisplay={responseEffDisplay}
        envIndex={envIndex}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        topCrises={crisisCards}
        onOpenCrisis={(id) => rootNav.navigate("CrisisDetail", { id })}
        pulseText={pulseText}
        alertRows={recentAlerts}
        alertsEmptyHint={alertsEmptyHint}
        onViewAllAlerts={() => rootNav.navigate("MainTabs", { screen: "Alerts" })}
        onOpenAlerts={() => rootNav.navigate("MainTabs", { screen: "Alerts" })}
        onOpenCrisesTab={() => rootNav.navigate("Crises")}
        onOpenAlert={(signalId) =>
          rootNav.navigate("AlertAnalysis", signalId ? { signalId } : {})
        }
      />
    </>
  );
}

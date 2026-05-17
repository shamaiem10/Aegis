/**
 * Home dashboard — compact hierarchy: status → stats → actions → env → alerts.
 */

import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AegisMap } from "../../../components/AegisMap";
import { Card, Pill } from "./AppShell";
import { EnvCityPicker } from "./EnvCityPicker";
import { EnvRiskBar } from "./EnvRiskBars";
import { HomeAlertRow } from "./HomeAlertRow";
import type { PakistanEnvCityKey, PakistanLiveEnvSnapshot } from "../../api/pakistanEnvLive";
import type { MapRegion } from "../../types/map-region";
import type { IonName } from "../../utils/alertIcons";
import { getAQIColor, getAQILabel } from "../../utils/aqi";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { useAiSeverityIndex } from "../../../lib/firestore/hooks";

export type HomeAlertRowData = {
  key: string;
  signalId?: string;
  iconName: IonName;
  title: string;
  timeLine: string;
  priority: import("./AppShell").AlertPriority;
};

export type HomeCrisisCard = {
  crisisId: string;
  name: string;
  metaLine: string;
  icon: IonName;
  borderColor: string;
};

export type FusionChip = { label: string; icon: IonName };

function StatCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "ok";
}) {
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

function ActionTile({ label, icon, onPress }: { label: string; icon: IonName; onPress: () => void }) {
  const { tc, minTouch } = useAegisUi();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        act.tile,
        {
          backgroundColor: tc.card,
          borderColor: tc.borderSoft,
          minHeight: Math.max(minTouch, 48),
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={tc.tealDeep} />
      <Text style={[act.lbl, { color: tc.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Block({
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
    <View style={blk.wrap}>
      <View style={blk.head}>
        <Text style={[blk.title, { color: tc.inkMuted }]}>{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={[blk.link, { color: tc.tealDeep }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const PULSE_PLACEHOLDER_PREFIX = "No live orchestration summary yet";

export function HomeDashboardLayout({
  contentPadding,
  localityLabel,
  isStable,
  feedSummary,
  onSettings,
  showSeverityBanner,
  crisisCriticalLabels,
  displayAqi,
  severityBannerLeadCrisis,
  onOpenCrises,
  region,
  mapDelta,
  locationError,
  onZoomIn,
  onZoomOut,
  demoMode,
  hqOnline,
  hqHelp: _hqHelp,
  basePreview: _basePreview,
  onConnectionSettings,
  fusionChips: _fusionChips,
  allocHint: _allocHint,
  signalsEmptyHint: _signalsEmptyHint,
  kpiSignals,
  crisisProbPct,
  kpiCrisisHint,
  envLoading,
  responseEffDisplay,
  envIndex,
  selectedCity,
  onSelectCity,
  topCrises,
  onOpenCrisis,
  pulseText,
  alertRows,
  alertsEmptyHint,
  onViewAllAlerts,
  onOpenAlerts,
  onOpenCrisesTab,
  onOpenAlert,
}: {
  contentPadding: { paddingHorizontal: number; paddingTop: number; paddingBottom: number };
  localityLabel: string;
  isStable: boolean;
  feedSummary: string;
  onSettings: () => void;
  showSeverityBanner: boolean;
  crisisCriticalLabels: number;
  displayAqi: number | null;
  severityBannerLeadCrisis: string;
  onOpenCrises: () => void;
  region: MapRegion | null;
  mapDelta: number;
  locationError: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  demoMode: boolean;
  hqOnline: boolean | null;
  hqHelp: string;
  basePreview: string;
  onConnectionSettings: () => void;
  fusionChips: FusionChip[];
  allocHint: { units: number; incidents: number } | null;
  signalsEmptyHint: string | null;
  kpiSignals: number;
  crisisProbPct: number;
  kpiCrisisHint: string;
  envLoading: boolean;
  responseEffDisplay: string;
  envIndex: PakistanLiveEnvSnapshot;
  selectedCity: PakistanEnvCityKey;
  onSelectCity: (id: PakistanEnvCityKey) => void;
  topCrises: HomeCrisisCard[];
  onOpenCrisis: (id: string) => void;
  pulseText: string;
  alertRows: HomeAlertRowData[];
  alertsEmptyHint: string | null;
  onViewAllAlerts: () => void;
  onOpenAlerts: () => void;
  onOpenCrisesTab: () => void;
  onOpenAlert: (signalId?: string) => void;
}) {
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const rootNav = useRootStackNavigation();
  const night = useColorScheme() === "dark";
  const { data: aiSeverity, loading: aiSevLoading } = useAiSeverityIndex(
    envIndex,
    selectedCity,
    envLoading,
  );

  const heatVal = aiSeverity?.heat.value ?? envIndex.heat.value;
  const airVal = aiSeverity?.air.value ?? envIndex.air.value;
  const floodVal = aiSeverity?.flood.value ?? envIndex.flood.value;
  const mapH = r.isCompact ? Math.min(160, r.mapHeight) : Math.min(200, r.mapHeight);
  const showPulse =
    pulseText.trim().length > 0 && !pulseText.startsWith(PULSE_PLACEHOLDER_PREFIX);
  const connLabel =
    hqOnline === false ? "Offline" : demoMode ? "Demo" : hqOnline ? "Live" : "…";
  const aqiHint =
    displayAqi != null ? getAQILabel(displayAqi) : envLoading ? "Loading" : "—";

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[contentWrap, contentPadding, styles.inner]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>HOME</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]} numberOfLines={1}>
            {localityLabel}
          </Text>
        </View>
        <Pressable
          onPress={onSettings}
          style={[styles.iconBtn, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={22} color={tc.inkSoft} />
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <Pill tone={isStable ? "mint" : "amber"}>{isStable ? "Steady" : "Elevated"}</Pill>
        <Pill tone={hqOnline === false ? "alert" : demoMode ? "amber" : "mint"}>{connLabel}</Pill>
        <Text style={[styles.feed, { color: tc.inkMuted }]} numberOfLines={1}>
          {feedSummary}
        </Text>
      </View>

      {hqOnline === false ? (
        <Pressable onPress={onConnectionSettings} style={[styles.offlineBar, { borderColor: tc.amber }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={tc.amberDeep} />
          <Text style={[styles.offlineTxt, { color: tc.ink }]} numberOfLines={2}>
            API unreachable — tap to fix connection
          </Text>
        </Pressable>
      ) : null}

      {showSeverityBanner ? (
        <Pressable
          onPress={onOpenCrises}
          style={[
            styles.alertBanner,
            {
              backgroundColor: night ? "#3b1720" : "#fff1f2",
              borderColor: tc.alert,
            },
          ]}
        >
          <Ionicons name="warning" size={18} color={tc.alertDeep} />
          <Text style={[styles.alertBannerTxt, { color: tc.ink }]} numberOfLines={2}>
            {crisisCriticalLabels} critical
            {displayAqi != null && displayAqi > 150 ? ` · AQI ${displayAqi}` : ""}
            {severityBannerLeadCrisis ? ` · ${severityBannerLeadCrisis}` : ""}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={tc.inkMuted} />
        </Pressable>
      ) : null}

      {/* Stats 2×2 */}
      <View style={[styles.statGrid, { gap: r.gap }]}>
        <StatCell label="Signals" value={String(kpiSignals)} />
        <StatCell
          label="Crisis risk"
          value={`${crisisProbPct}%`}
          tone={crisisProbPct > 25 ? "warn" : "default"}
        />
        <StatCell
          label="Air quality"
          value={displayAqi != null ? String(displayAqi) : "—"}
          tone={displayAqi != null && displayAqi > 150 ? "warn" : "default"}
        />
        <StatCell
          label="Confidence"
          value={hqOnline === false ? "—" : responseEffDisplay}
          tone="ok"
        />
      </View>
      <Text style={[styles.statHint, { color: tc.inkMuted }]} numberOfLines={1}>
        {kpiCrisisHint} risk · {aqiHint}
      </Text>

      {/* Quick actions 2×2 */}
      <View style={[styles.actionGrid, { gap: r.gap, marginTop: sectionGap }]}>
        <ActionTile label="Alerts" icon="notifications-outline" onPress={onOpenAlerts} />
        <ActionTile label="Reports" icon="document-text-outline" onPress={() => rootNav.navigate("MainTabs", { screen: "Reports" })} />
        <ActionTile label="Crises" icon="flame-outline" onPress={onOpenCrisesTab} />
        <ActionTile
          label="Resources"
          icon="medkit-outline"
          onPress={() => rootNav.navigate("EmergencyResources")}
        />
      </View>

      {/* Map — compact */}
      <Card style={[styles.mapCard, { marginTop: sectionGap, borderColor: tc.borderSoft }]}>
        <View style={styles.mapHead}>
          <Text style={[styles.mapTitle, { color: tc.ink }]}>Live map</Text>
          <View style={styles.mapZoom}>
            <Pressable onPress={onZoomOut} hitSlop={8} style={styles.zoomBtn}>
              <Ionicons name="remove" size={18} color={tc.inkSoft} />
            </Pressable>
            <Pressable onPress={onZoomIn} hitSlop={8} style={styles.zoomBtn}>
              <Ionicons name="add" size={18} color={tc.inkSoft} />
            </Pressable>
          </View>
        </View>
        {locationError ? (
          <Text style={[styles.mapErr, { color: tc.alertDeep }]} numberOfLines={2}>
            {locationError}
          </Text>
        ) : null}
        <View style={[styles.mapBox, { height: mapH, backgroundColor: tc.muted }]}>
          <AegisMap region={region} latitudeDelta={mapDelta} longitudeDelta={mapDelta} />
        </View>
      </Card>

      {/* Environment — one card, tight */}
      <View style={{ marginTop: sectionGap }}>
        <Block title="ENVIRONMENT">
          <Card style={{ borderColor: tc.borderSoft, padding: 14 }}>
            <View style={styles.envHead}>
              <Pill tone={aiSeverity?.degradedMode ? "amber" : "mint"}>
                {aiSevLoading ? "Updating…" : "AI index"}
              </Pill>
              {aiSeverity ? (
                <Text style={[styles.riskScore, { color: tc.ink }]}>
                  Risk {aiSeverity.overallRiskScore}%
                </Text>
              ) : null}
            </View>
            <EnvCityPicker selected={selectedCity} onSelect={onSelectCity} disabled={envLoading} />
            {aiSeverity?.countrySummary ? (
              <Text style={[styles.aiLine, { color: tc.inkSoft }]} numberOfLines={2}>
                {aiSeverity.countrySummary}
              </Text>
            ) : null}
            <EnvRiskBar
              label="Heat"
              value={heatVal}
              color="#ea580c"
              sub={aiSeverity?.heat.sub ?? envIndex.heat.sub}
            />
            <EnvRiskBar
              label="Air"
              value={airVal}
              color={displayAqi != null ? getAQIColor(displayAqi, night) : "#7c3aed"}
              sub={aiSeverity?.air.sub ?? envIndex.air.sub}
            />
            <EnvRiskBar
              label="Flood"
              value={floodVal}
              color="#2563eb"
              sub={aiSeverity?.flood.sub ?? envIndex.flood.sub}
            />
          </Card>
        </Block>
      </View>

      {showPulse ? (
        <View style={[styles.pulseBox, { marginTop: sectionGap, backgroundColor: tc.tealSoft, borderColor: tc.borderSoft }]}>
          <Text style={[styles.pulseLbl, { color: tc.tealDeep }]}>AI pulse</Text>
          <Text style={[styles.pulseTxt, { color: tc.ink }]} numberOfLines={3}>
            {pulseText}
          </Text>
        </View>
      ) : null}

      {topCrises.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Block title="TOP CRISES" actionLabel="All" onAction={onOpenCrisesTab}>
            {topCrises.slice(0, 2).map((c) => (
              <Pressable
                key={c.crisisId}
                onPress={() => onOpenCrisis(c.crisisId)}
                style={[styles.crisisRow, { backgroundColor: tc.card, borderColor: tc.borderSoft, borderLeftColor: c.borderColor }]}
              >
                <Ionicons name={c.icon} size={20} color={c.borderColor} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.crisisName, { color: tc.ink }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[styles.crisisMeta, { color: tc.inkMuted }]} numberOfLines={1}>
                    {c.metaLine}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={tc.inkMuted} />
              </Pressable>
            ))}
          </Block>
        </View>
      ) : null}

      <View style={{ marginTop: sectionGap }}>
        <Block title="RECENT ALERTS" actionLabel="All" onAction={onViewAllAlerts}>
          {alertRows.slice(0, 3).map((row) => (
            <HomeAlertRow
              key={row.key}
              iconName={row.iconName}
              title={row.title}
              timeLabel={row.timeLine}
              priority={row.priority}
              onPress={() => onOpenAlert(row.signalId)}
            />
          ))}
          {alertRows.length === 0 && alertsEmptyHint ? (
            <Text style={[styles.empty, { color: tc.inkMuted }]}>{alertsEmptyHint}</Text>
          ) : null}
        </Block>
      </View>
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

const act = StyleSheet.create({
  tile: {
    flex: 1,
    flexBasis: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  lbl: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
});

const blk = StyleSheet.create({
  wrap: { marginBottom: 4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  link: { fontSize: 13, fontWeight: "800" },
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { paddingBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 },
  feed: { flex: 1, minWidth: 100, fontSize: 11, fontWeight: "600" },
  offlineBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  offlineTxt: { flex: 1, fontSize: 12, fontWeight: "600" },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertBannerTxt: { flex: 1, fontSize: 13, fontWeight: "800" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 14 },
  statHint: { marginTop: 6, fontSize: 11, fontWeight: "600" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap" },
  mapCard: { padding: 12 },
  mapHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  mapTitle: { fontSize: 15, fontWeight: "800" },
  mapZoom: { flexDirection: "row", gap: 4 },
  zoomBtn: { padding: 6 },
  mapErr: { fontSize: 11, marginBottom: 6 },
  mapBox: { borderRadius: 12, overflow: "hidden" },
  envHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  riskScore: { fontSize: 13, fontWeight: "800" },
  aiLine: { fontSize: 12, fontWeight: "600", marginBottom: 8, lineHeight: 17 },
  pulseBox: { padding: 12, borderRadius: 12, borderWidth: 1 },
  pulseLbl: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: "#0d9488" },
  pulseTxt: { marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  crisisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  crisisName: { fontSize: 14, fontWeight: "800" },
  crisisMeta: { marginTop: 2, fontSize: 11, fontWeight: "600" },
  empty: { fontSize: 13, fontWeight: "600", lineHeight: 19, marginTop: 4 },
});

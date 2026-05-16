/**
 * Home dashboard presentation — sectioned cards, 2×2 KPI grid, no nested horizontal KPI scroll.
 */

import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AegisMap } from "../../../components/AegisMap";
import {
  Card,
  MapCardChrome,
  KpiTile,
  Pill,
  type AlertPriority,
} from "./AppShell";
import { EnvCityPicker } from "./EnvCityPicker";
import { EnvRiskBar } from "./EnvRiskBars";
import { HomeAlertRow } from "./HomeAlertRow";
import type { PakistanEnvCityKey, PakistanLiveEnvSnapshot } from "../../api/pakistanEnvLive";
import type { MapRegion } from "../../types/map-region";
import type { IonName } from "../../utils/alertIcons";
import { getAQIColor, getAQILabel } from "../../utils/aqi";
import { useAegisUi } from "../../hooks/useAegisUi";
import { connectivityHintForApiBase } from "../../api/client";

export type HomeAlertRowData = {
  key: string;
  signalId?: string;
  iconName: IonName;
  title: string;
  timeLine: string;
  priority: AlertPriority;
};

export type HomeCrisisCard = {
  crisisId: string;
  name: string;
  metaLine: string;
  icon: IonName;
  borderColor: string;
};

export type FusionChip = { label: string; icon: IonName };

function SectionCard({
  eyebrow,
  title,
  subtitle,
  children,
  accent,
}: {
  eyebrow: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  accent?: "default" | "pulse";
}) {
  const { tc, cardPadding, cardRadius } = useAegisUi();
  const night = useColorScheme() === "dark";

  return (
    <View
      style={[
        sec.wrap,
        {
          padding: cardPadding,
          borderRadius: cardRadius,
          backgroundColor: accent === "pulse" ? (night ? tc.cardTint : tc.sky) : tc.card,
          borderColor: tc.border,
        },
      ]}
    >
      <Text style={[sec.eyebrow, { color: accent === "pulse" ? tc.tealDeep : tc.inkMuted }]}>{eyebrow}</Text>
      {title ? <Text style={[sec.title, { color: tc.ink }]}>{title}</Text> : null}
      {subtitle ? <Text style={[sec.sub, { color: tc.inkMuted }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IonName;
  onPress: () => void;
}) {
  const { tc, minTouch } = useAegisUi();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        qa.btn,
        {
          backgroundColor: tc.card,
          borderColor: tc.border,
          minHeight: minTouch,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={tc.tealDeep} />
      <Text style={[qa.label, { color: tc.ink }]}>{label}</Text>
    </Pressable>
  );
}

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
  hqHelp,
  basePreview,
  onConnectionSettings,
  fusionChips,
  allocHint,
  signalsEmptyHint,
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
  contentPadding: {
    paddingHorizontal: number;
    paddingTop: number;
    paddingBottom: number;
  };
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
  const { tc, r, contentWrap, sectionGap, cardRadius } = useAegisUi();
  const night = useColorScheme() === "dark";

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      style={[styles.scroll, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[contentWrap, contentPadding, styles.inner]}
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.greet, { color: tc.inkSoft, fontSize: r.bodySize(14) }]}>Good morning</Text>
            <Text style={[styles.headline, { color: tc.ink, fontSize: r.titleSize(26) }]} numberOfLines={2}>
              Response Team
            </Text>
          </View>
          <Pressable
            onPress={onSettings}
            style={[styles.gear, { backgroundColor: tc.card, borderColor: tc.border }]}
            hitSlop={12}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={tc.inkSoft} />
          </Pressable>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isStable ? tc.accentGreenSoft : tc.warnSurface,
              borderColor: isStable ? tc.borderSoft : tc.amber,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: isStable ? tc.accentGreen : tc.amber }]} />
          <Text
            style={[styles.statusTxt, { color: isStable ? tc.mintDark : tc.amberDeep }]}
            numberOfLines={1}
          >
            {isStable ? `${localityLabel} · steady` : `${localityLabel} · watch`}
          </Text>
        </View>

        <Text style={[styles.feedLine, { color: tc.inkMuted }]} numberOfLines={1}>
          {feedSummary}
        </Text>
      </View>

      <View style={[styles.quickRow, { gap: r.gap }]}>
        <QuickAction label="Alerts" icon="notifications-outline" onPress={onOpenAlerts} />
        <QuickAction label="Crises" icon="flame-outline" onPress={onOpenCrisesTab} />
      </View>

      {showSeverityBanner ? (
        <Pressable
          onPress={onOpenCrises}
          style={[
            styles.banner,
            {
              backgroundColor: night ? "#3b0764" : "#f3e8ff",
              borderColor:
                displayAqi != null && displayAqi > 200 ? getAQIColor(displayAqi, night) : tc.border,
            },
          ]}
        >
          <Ionicons
            name="warning-outline"
            size={20}
            color={getAQIColor(displayAqi != null && displayAqi > 200 ? displayAqi : 180, night)}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.bannerTitle, { color: tc.ink }]} numberOfLines={2}>
              {crisisCriticalLabels} critical incident{crisisCriticalLabels === 1 ? "" : "s"}
              {displayAqi != null && displayAqi > 200 ? ` · AQI ${displayAqi}` : ""}
              {severityBannerLeadCrisis ? ` · ${severityBannerLeadCrisis}` : ""}
            </Text>
            <Text style={[styles.bannerSub, { color: tc.inkSoft }]}>Tap to review active crises</Text>
          </View>
          {displayAqi != null && displayAqi > 200 ? (
            <View style={[styles.aqiChip, { borderColor: getAQIColor(displayAqi, night) }]}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: getAQIColor(displayAqi, night) }}>
                {displayAqi}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <Card style={[styles.mapCard, { backgroundColor: tc.card, borderColor: tc.border, borderRadius: cardRadius }]}>
        <MapCardChrome
          eyebrow="LIVE MAP"
          title="Operations grid"
          hint="Your device region. Pins appear when signals include coordinates."
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        />
        {locationError ? <Text style={[styles.warn, { color: tc.alertDeep }]}>{locationError}</Text> : null}
        <View style={[styles.mapWrap, { height: r.mapHeight, borderColor: tc.border, backgroundColor: tc.muted }]}>
          <AegisMap region={region} latitudeDelta={mapDelta} longitudeDelta={mapDelta} />
        </View>
        <View style={styles.pillRow}>
          <Pill tone="ink">Grid</Pill>
          {demoMode ? <Pill tone="amber">Demo</Pill> : <Pill tone="mint">Live feeds</Pill>}
          <Pill tone={hqOnline === false ? "alert" : "mint"}>{hqOnline === false ? "Offline" : "Connected"}</Pill>
        </View>
        {!demoMode && hqOnline === false && hqHelp ? (
          <View style={[styles.hqBox, { backgroundColor: tc.sky, borderColor: tc.tealSoft }]}>
            <Text style={[styles.hqHelp, { color: tc.ink }]}>
              {hqHelp}
              {connectivityHintForApiBase(basePreview)}
            </Text>
            <Pressable onPress={onConnectionSettings} style={[styles.hqBtn, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <Text style={[styles.hqBtnTxt, { color: tc.primaryDark }]}>Connection settings</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {fusionChips.length > 0 ? (
        <View style={[styles.chipWrap, { marginTop: sectionGap }]}>
          {fusionChips.map((t, i) => (
            <View
              key={`${t.label}-${i}`}
              style={[styles.chip, { backgroundColor: tc.card, borderColor: tc.border }]}
            >
              <Ionicons name={t.icon} size={14} color={tc.tealDeep} />
              <Text style={[styles.chipTxt, { color: tc.ink }]}>{t.label}</Text>
            </View>
          ))}
        </View>
      ) : signalsEmptyHint ? (
        <Text style={[styles.hint, { color: tc.inkSoft, marginTop: sectionGap }]}>{signalsEmptyHint}</Text>
      ) : null}

      {allocHint && allocHint.units > 0 ? (
        <View style={{ marginTop: 10 }}>
          <Pill tone="amber">
            {allocHint.units} resource unit{allocHint.units === 1 ? "" : "s"} · {allocHint.incidents} dossier
            {allocHint.incidents === 1 ? "" : "s"}
          </Pill>
        </View>
      ) : null}

      <View style={[styles.kpiGrid, { marginTop: sectionGap, gap: r.gap }]}>
        <View style={styles.kpiCell}>
          <KpiTile
            label="Active signals"
            value={String(kpiSignals)}
            hint="from ingested feeds"
            hintTone="green"
            iconName="pulse-outline"
          />
        </View>
        <View style={styles.kpiCell}>
          <KpiTile
            label="Crisis probability"
            value={`${crisisProbPct}%`}
            hint={kpiCrisisHint}
            hintTone={crisisProbPct > 20 ? "red" : "green"}
            iconName="warning-outline"
          />
        </View>
        <View style={styles.kpiCell}>
          <KpiTile
            label="City AQI"
            value={displayAqi != null ? String(displayAqi) : "—"}
            hint={
              displayAqi != null ?
                `${getAQILabel(displayAqi)} · Open-Meteo`
              : envLoading ?
                "loading air…"
              : "unavailable"
            }
            hintTone={displayAqi != null && displayAqi > 150 ? "red" : "green"}
            iconName="leaf-outline"
          />
        </View>
        <View style={styles.kpiCell}>
          <KpiTile
            label="Response eff."
            value={hqOnline === false ? "—" : responseEffDisplay}
            hint="avg dossier confidence"
            hintTone="green"
            iconName="shield-checkmark-outline"
          />
        </View>
      </View>

      <View style={{ marginTop: sectionGap }}>
        <SectionCard
          eyebrow="ENVIRONMENTAL RISK"
          subtitle="Open-Meteo air & heat · GDACS floods (independent of alert mocks)"
        >
          <EnvCityPicker selected={selectedCity} onSelect={onSelectCity} disabled={envLoading} />
          {envLoading ? (
            <Text style={[styles.hint, { color: tc.inkSoft, marginTop: 10 }]}>
              Loading environmental data
              {selectedCity === "all" ? " for Pakistan…" : ` for ${selectedCity}…`}
            </Text>
          ) : null}
          {!envLoading && !envIndex.hasAny ? (
            <Text style={[styles.hint, { color: tc.inkSoft, marginTop: 10 }]}>
              Live environmental APIs unreachable. Mock alerts on the Alerts tab are unchanged.
            </Text>
          ) : null}
          <EnvRiskBar label="Heat stress" value={envIndex.heat.value} color="#ea580c" sub={envIndex.heat.sub} />
          <EnvRiskBar
            label="Air quality"
            value={envIndex.air.value}
            color={displayAqi != null ? getAQIColor(displayAqi, night) : "#7c3aed"}
            sub={envIndex.air.sub}
          />
          <EnvRiskBar label="Flood risk" value={envIndex.flood.value} color="#2563eb" sub={envIndex.flood.sub} />
        </SectionCard>
      </View>

      {topCrises.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionEyebrow, { color: tc.inkMuted }]}>ACTIVE CRISES</Text>
            <Pressable onPress={onOpenCrisesTab} hitSlop={8}>
              <Text style={[styles.sectionLink, { color: tc.tealDeep }]}>See all</Text>
            </Pressable>
          </View>
          {topCrises.map((c) => (
            <Pressable
              key={c.crisisId}
              onPress={() => onOpenCrisis(c.crisisId)}
              style={[
                styles.crisisCard,
                {
                  backgroundColor: tc.card,
                  borderColor: tc.border,
                  borderLeftColor: c.borderColor,
                },
              ]}
            >
              <Ionicons name={c.icon} size={22} color={c.borderColor} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.crisisTitle, { color: tc.ink }]} numberOfLines={2}>
                  {c.name}
                </Text>
                <Text style={[styles.crisisMeta, { color: tc.inkSoft }]} numberOfLines={2}>
                  {c.metaLine}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={tc.inkMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: sectionGap }}>
        <SectionCard eyebrow="AI PULSE · ANTIGRAVITY" accent="pulse">
          <Text style={[styles.pulseBody, { color: tc.ink }]}>{pulseText}</Text>
        </SectionCard>
      </View>

      <View style={[styles.sectionHead, { marginTop: sectionGap }]}>
        <Text style={[styles.sectionEyebrow, { color: tc.inkMuted }]}>RECENT ALERTS</Text>
        <Pressable onPress={onViewAllAlerts} hitSlop={8}>
          <Text style={[styles.sectionLink, { color: tc.tealDeep }]}>View all</Text>
        </Pressable>
      </View>

      {alertRows.map((row) => (
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
        <Text style={[styles.hint, { color: tc.inkSoft, marginTop: 8, lineHeight: 20 }]}>{alertsEmptyHint}</Text>
      ) : null}
    </ScrollView>
  );
}

const sec = StyleSheet.create({
  wrap: { borderWidth: 1 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { marginTop: 6, fontSize: 17, fontWeight: "800" },
  sub: { marginTop: 6, fontSize: 12, fontWeight: "600", lineHeight: 17 },
});

const qa = StyleSheet.create({
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: { fontSize: 14, fontWeight: "800" },
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: {},
  headerBlock: { marginBottom: 4 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greet: { fontWeight: "600" },
  headline: { marginTop: 4, fontWeight: "800", letterSpacing: -0.5 },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
  feedLine: { marginTop: 10, fontSize: 12, fontWeight: "600" },
  quickRow: { flexDirection: "row", marginTop: 16, marginBottom: 4 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
  },
  bannerTitle: { fontSize: 15, fontWeight: "900", lineHeight: 21 },
  bannerSub: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  aqiChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  mapCard: {
    marginTop: 14,
    paddingBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  mapWrap: { borderRadius: 22, overflow: "hidden", borderWidth: 1 },
  warn: { marginBottom: 8, fontSize: 12, fontWeight: "600" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  hqBox: { marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  hqHelp: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  hqBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hqBtnTxt: { fontSize: 12, fontWeight: "800" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 12, fontWeight: "800" },
  hint: { fontSize: 13, fontWeight: "600" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiCell: { width: "48%", flexGrow: 1, minWidth: 148 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionEyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  sectionLink: { fontSize: 14, fontWeight: "800" },
  crisisCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  crisisTitle: { fontSize: 16, fontWeight: "900", lineHeight: 22 },
  crisisMeta: { marginTop: 4, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  pulseBody: { marginTop: 4, fontSize: 15, fontWeight: "600", lineHeight: 22 },
});

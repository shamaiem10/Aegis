/**
 * Mobile-first layout for alert analysis — sectioned cards, full-width chips, pinned footer.
 */

import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AgentArtifactBundle } from "../../api/agentTypes";
import type { AlertAnalysisViewModel } from "../../utils/alertAnalysisViewModel";
import type { IonName } from "../../utils/alertIcons";
import { alertIconForSignal } from "../../utils/alertIcons";
import type { SignalApi } from "../../api/types";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useThemeCiro } from "../../theme/useThemeCiro";
import { Card, ConfidenceBar, Pill } from "./AppShell";

function Section({
  title,
  icon,
  children,
  tc,
}: {
  title: string;
  icon: IonName;
  children: ReactNode;
  tc: ReturnType<typeof useThemeCiro>;
}) {
  return (
    <View style={[sec.wrap, { backgroundColor: tc.card, borderColor: tc.border }]}>
      <View style={sec.head}>
        <View style={[sec.iconBox, { backgroundColor: tc.tealSoft }]}>
          <Ionicons name={icon} size={16} color={tc.tealDeep} />
        </View>
        <Text style={[sec.title, { color: tc.inkMuted }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SourceRow({
  icon,
  label,
  credibilityPct,
  tc,
}: {
  icon: IonName;
  label: string;
  credibilityPct: number;
  tc: ReturnType<typeof useThemeCiro>;
}) {
  return (
    <View style={[src.row, { borderColor: tc.borderSoft, backgroundColor: tc.muted }]}>
      <View style={[src.iconRing, { backgroundColor: tc.card }]}>
        <Ionicons name={icon} size={18} color={tc.tealDeep} />
      </View>
      <View style={src.textCol}>
        <Text style={[src.label, { color: tc.ink }]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={[src.cred, { color: tc.inkSoft }]}>Credibility {credibilityPct}%</Text>
      </View>
      <View style={[src.badge, { backgroundColor: tc.tealSoft }]}>
        <Text style={[src.badgeTxt, { color: tc.tealDeep }]}>{credibilityPct}</Text>
      </View>
    </View>
  );
}

function MetricTile({
  label,
  value,
  emphasis,
  tc,
  fullWidth,
}: {
  label: string;
  value: string;
  emphasis?: "high" | "normal";
  tc: ReturnType<typeof useThemeCiro>;
  fullWidth: boolean;
}) {
  return (
    <View
      style={[
        met.tile,
        fullWidth ? met.tileFull : met.tileHalf,
        {
          backgroundColor: tc.muted,
          borderColor: emphasis === "high" ? tc.alert : tc.borderSoft,
          borderWidth: emphasis === "high" ? 1.5 : 1,
        },
      ]}
    >
      <Text style={[met.label, { color: tc.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
      <Text
        style={[met.value, { color: emphasis === "high" ? tc.alertDeep : tc.ink }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

export function AlertAnalysisLayout({
  vm,
  signal,
  agentArtifacts,
  agentsLoading,
  agentsError,
  agentsErrorHint,
  onOpenCrisis,
  onOpenActionPlan,
  footer,
}: {
  vm: AlertAnalysisViewModel;
  signal: SignalApi;
  agentArtifacts?: AgentArtifactBundle | null;
  agentsLoading?: boolean;
  agentsError?: string | null;
  agentsErrorHint?: string | null;
  onOpenCrisis: () => void;
  onOpenActionPlan?: () => void;
  footer: ReactNode;
}) {
  const tc = useThemeCiro();
  const r = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const schemeDark = useColorScheme() === "dark";

  const priorityTone = vm.priority === "HIGH" ? "alert" : vm.priority === "MED" ? "amber" : "mint";
  const accentColor =
    vm.priority === "HIGH" ? tc.alert : vm.priority === "MED" ? tc.amber : tc.tealDeep;
  const heroIcon = alertIconForSignal(signal.kind, signal.text);
  const metricFull = r.isCompact || r.width < 380;

  return (
    <View style={[root.wrap, { backgroundColor: tc.canvas }]}>
      <ScrollView
        style={root.scroll}
        contentContainerStyle={[
          root.scrollInner,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: Math.max(8, insets.top > 20 ? 4 : 8),
            paddingBottom: 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card
          style={[
            root.hero,
            {
              backgroundColor: tc.card,
              borderColor: tc.border,
              borderLeftColor: accentColor,
            },
          ]}
        >
          <View style={root.heroBadgeRow}>
            <Pill tone={priorityTone}>{vm.priority}</Pill>
            <Pill tone="ink">{vm.categoryLabel}</Pill>
            <Pill tone="mint">{vm.kindLabel}</Pill>
          </View>

          <View style={root.heroBody}>
            <View style={[root.heroIcon, { backgroundColor: schemeDark ? tc.tealSoft : tc.sky }]}>
              <Ionicons name={heroIcon} size={r.isCompact ? 28 : 32} color={tc.tealDeep} />
            </View>
            <View style={root.heroText}>
              <Text
                style={[root.heroTitle, { color: tc.ink, fontSize: r.titleSize(17) }]}
                maxFontSizeMultiplier={1.25}
              >
                {vm.title}
              </Text>
              <Text style={[root.heroLoc, { color: tc.inkSoft, fontSize: r.bodySize(13) }]}>
                {vm.locationLine}
              </Text>
              <Text style={[root.heroTime, { color: tc.inkMuted, fontSize: r.bodySize(12) }]}>
                {vm.timestampPkt}
              </Text>
            </View>
          </View>

          <ConfidenceBar value={vm.confidencePct} />
        </Card>

        <Section title="Incident narrative" icon="document-text-outline" tc={tc}>
          <Text style={[root.body, { color: tc.ink, fontSize: r.bodySize(15) }]}>{vm.fullNarrative}</Text>
        </Section>

        <Section title="Detected from" icon="git-network-outline" tc={tc}>
          <View style={root.sourceList}>
            {vm.detectedSources.map((src) => (
              <SourceRow
                key={src.label}
                icon={src.icon}
                label={src.label}
                credibilityPct={src.credibilityPct}
                tc={tc}
              />
            ))}
          </View>
        </Section>

        {vm.sourceBreakdown.length > 0 ? (
          <Section title="Source breakdown" icon="pie-chart-outline" tc={tc}>
            {vm.sourceBreakdown.map((row) => (
              <View key={row.source} style={[root.breakRow, { borderBottomColor: tc.borderSoft }]}>
                <Text style={[root.breakSource, { color: tc.ink }]} numberOfLines={2}>
                  {row.source}
                </Text>
                <Text style={[root.breakMeta, { color: tc.inkSoft }]}>
                  {row.count} signal{row.count === 1 ? "" : "s"} · {row.avgCredibilityPct}% avg
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {vm.showMisinfoWarning ? (
          <View style={[root.warn, { backgroundColor: schemeDark ? tc.warnSurface : "#fff7ed", borderColor: tc.amber }]}>
            <Ionicons name="warning-outline" size={20} color={schemeDark ? tc.amberDeep : "#9a3412"} />
            <View style={root.warnText}>
              <Text style={[root.warnTitle, { color: schemeDark ? tc.amberDeep : "#9a3412" }]}>
                Verification warning
              </Text>
              <Text style={[root.warnBody, { color: tc.ink }]}>{vm.misinfoNote}</Text>
            </View>
          </View>
        ) : null}

        {agentsLoading ? (
          <Section title="Agent analysis" icon="sparkles-outline" tc={tc}>
            <Text style={[root.body, { color: tc.inkSoft, fontSize: r.bodySize(14) }]}>
              AI agents analyzing alert (triage + dossier — ~15–30s, action plan on demand)…
            </Text>
          </Section>
        ) : null}

        {agentsError ? (
          <View style={[root.warn, { backgroundColor: schemeDark ? "#3b1720" : "#fef2f2", borderColor: tc.alert }]}>
            <Ionicons name="cloud-offline-outline" size={20} color={tc.alertDeep} />
            <View style={root.warnText}>
              <Text style={[root.warnTitle, { color: tc.alertDeep }]}>Live agents required</Text>
              <Text style={[root.warnBody, { color: tc.ink }]}>{agentsError}</Text>
              {agentsErrorHint ? (
                <Text style={[root.warnBody, { color: tc.inkSoft, marginTop: 8, fontSize: 12 }]}>
                  {agentsErrorHint}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {agentArtifacts?.triage ? (
          <Section title="AI triage" icon="sparkles-outline" tc={tc}>
            <Pill tone={agentArtifacts.triage.priority === "CRITICAL" ? "alert" : "mint"}>
              {agentArtifacts.triage.disposition.replace(/_/g, " ")}
            </Pill>
            <Text style={[root.impactLead, { color: tc.ink, fontSize: r.bodySize(15), marginTop: 10 }]}>
              {agentArtifacts.triage.rationale}
            </Text>
            {agentArtifacts.triage.recommendedNextSteps.map((step) => (
              <View
                key={step}
                style={[root.actionCard, { backgroundColor: tc.muted, borderColor: tc.borderSoft }]}
              >
                <Text style={[root.actionTxt, { color: tc.ink, fontSize: r.bodySize(14) }]}>{step}</Text>
              </View>
            ))}
            {agentArtifacts.triage.assignTo.length > 0 ? (
              <Text style={[root.origin, { color: tc.inkMuted, marginTop: 8 }]}>
                Assign: {agentArtifacts.triage.assignTo.join(" · ")}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {agentArtifacts?.analysis ? (
          <Section title="Dossier analysis" icon="layers-outline" tc={tc}>
            <Text style={[root.body, { color: tc.ink, fontSize: r.bodySize(15) }]}>
              {agentArtifacts.analysis.executiveSummary}
            </Text>
            {agentArtifacts.analysis.keyRisks.map((risk) => (
              <Text key={risk} style={[root.origin, { color: tc.alertDeep, marginTop: 6 }]}>
                · {risk}
              </Text>
            ))}
          </Section>
        ) : null}

        <Section title="Impact analysis" icon="analytics-outline" tc={tc}>
          <Text style={[root.impactLead, { color: tc.inkSoft, fontSize: r.bodySize(14) }]}>
            {vm.impactSummary}
          </Text>
          <View style={root.metricGrid}>
            {vm.impactRows.map((row) => (
              <MetricTile
                key={row.label}
                label={row.label}
                value={row.value}
                emphasis={row.emphasis}
                tc={tc}
                fullWidth={metricFull}
              />
            ))}
          </View>
        </Section>

        <Section title="Recommended actions" icon="checkmark-done-outline" tc={tc}>
          {vm.recommendedActions.map((action, i) => (
            <View
              key={action}
              style={[root.actionCard, { backgroundColor: tc.muted, borderColor: tc.borderSoft }]}
            >
              <View style={[root.actionNum, { backgroundColor: tc.tealSoft }]}>
                <Text style={[root.actionNumTxt, { color: tc.tealDeep }]}>{i + 1}</Text>
              </View>
              <Text style={[root.actionTxt, { color: tc.ink, fontSize: r.bodySize(14) }]}>{action}</Text>
            </View>
          ))}
        </Section>

        <Section title="Signal metadata" icon="information-circle-outline" tc={tc}>
          <MetaLine label="Signal ID" value={vm.signalId} tc={tc} mono />
          <MetaLine label="Feed" value={vm.sourceFeed} tc={tc} />
          <MetaLine label="Coordinates" value={vm.coordinates} tc={tc} />
          <MetaLine label="Severity" value={`${vm.severityHint} / 10`} tc={tc} />
          <Text style={[root.origin, { color: tc.inkMuted }]} numberOfLines={3}>
            {vm.dataOrigin}
          </Text>
        </Section>

        {onOpenActionPlan && !agentsError ? (
          <Pressable
            onPress={onOpenActionPlan}
            style={({ pressed }) => [
              root.cta,
              {
                backgroundColor: schemeDark ? "#1e3a5f" : tc.sky,
                borderColor: tc.tealDeep,
                opacity: pressed ? 0.9 : 1,
                marginBottom: 10,
              },
            ]}
          >
            <Text style={[root.ctaTxt, { color: tc.tealDeep }]}>View AI action plan</Text>
            <Ionicons name="flash-outline" size={20} color={tc.tealDeep} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={onOpenCrisis}
          style={({ pressed }) => [
            root.cta,
            {
              backgroundColor: tc.tealSoft,
              borderColor: tc.tealDeep,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[root.ctaTxt, { color: tc.tealDeep }]}>Open linked crisis dossier</Text>
          <Ionicons name="chevron-forward" size={20} color={tc.tealDeep} />
        </Pressable>
      </ScrollView>

      <View
        style={[
          root.footer,
          {
            paddingHorizontal: r.horizontalPad,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: 12,
            backgroundColor: tc.card,
            borderTopColor: tc.border,
          },
        ]}
      >
        {footer}
      </View>
    </View>
  );
}

function MetaLine({
  label,
  value,
  tc,
  mono,
}: {
  label: string;
  value: string;
  tc: ReturnType<typeof useThemeCiro>;
  mono?: boolean;
}) {
  return (
    <View style={meta.row}>
      <Text style={[meta.label, { color: tc.inkMuted }]}>{label}</Text>
      <Text
        style={[meta.value, { color: tc.ink }, mono && meta.mono]}
        numberOfLines={2}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const root = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollInner: { gap: 14 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  hero: {
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 20,
  },
  heroBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  heroBody: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontWeight: "800", lineHeight: 24, letterSpacing: -0.3 },
  heroLoc: { marginTop: 6, fontWeight: "700", lineHeight: 20 },
  heroTime: { marginTop: 4, fontWeight: "600" },
  body: { lineHeight: 24, fontWeight: "500" },
  sourceList: { gap: 10, marginTop: 4 },
  breakRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakSource: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  breakMeta: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  warn: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  warnText: { flex: 1, minWidth: 0 },
  warnTitle: { fontSize: 14, fontWeight: "900" },
  warnBody: { marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  impactLead: { lineHeight: 22, fontWeight: "600", marginBottom: 12 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  actionNum: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionNumTxt: { fontSize: 14, fontWeight: "900" },
  actionTxt: { flex: 1, minWidth: 0, lineHeight: 22, fontWeight: "600" },
  origin: { marginTop: 12, fontSize: 11, fontWeight: "600", lineHeight: 16 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  ctaTxt: { fontSize: 16, fontWeight: "900", flex: 1 },
});

const sec = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    flex: 1,
  },
});

const src = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, minWidth: 0 },
  label: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  cred: { marginTop: 2, fontSize: 12, fontWeight: "600" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 36,
    alignItems: "center",
  },
  badgeTxt: { fontSize: 13, fontWeight: "900" },
});

const met = StyleSheet.create({
  tile: {
    padding: 14,
    borderRadius: 14,
    minHeight: 72,
    justifyContent: "center",
  },
  tileHalf: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
  },
  tileFull: {
    width: "100%",
  },
  label: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  value: { marginTop: 6, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
});

const meta = StyleSheet.create({
  row: { marginTop: 10 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  value: { marginTop: 4, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  mono: { fontFamily: "monospace" },
});

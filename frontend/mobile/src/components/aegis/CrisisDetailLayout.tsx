/**
 * Crisis dossier — compact detail view with working status controls.
 */

import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { CrisisOrchestrationPanel } from "./CrisisOrchestrationPanel";
import { CrisisResourceAllocator } from "./CrisisResourceAllocator";
import { getCrisis, parseHttpErrorMessage, patchCrisisStatus } from "../../api/client";
import { useResourceInventory } from "../../../lib/firestore/hooks";
import type { CrisisDossierApi, CrisisStatusApi } from "../../api/types";
import type { RootStackParamList } from "../../navigation/types";
import { getCrisisTypeConfig, crisisThemeHex } from "../../constants/crisisTypes";
import { getAQIColor, getAQILabel } from "../../utils/aqi";
import { useAegisUi } from "../../hooks/useAegisUi";
import { Pill } from "./AppShell";

type Nav = NativeStackNavigationProp<RootStackParamList, "CrisisDetail">;
type Route = RouteProp<RootStackParamList, "CrisisDetail">;

const STATUSES: CrisisStatusApi[] = ["active", "monitoring", "resolved"];

const STATUS_LABEL: Record<CrisisStatusApi, string> = {
  active: "Active",
  monitoring: "Monitoring",
  resolved: "Resolved",
  false_alarm: "False alarm",
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function isDebugFactor(f: string): boolean {
  return /^severity_hint=/i.test(f) || /^kind=/i.test(f);
}

function severityTone(score: number): "alert" | "amber" | "mint" | "sky" {
  if (score >= 8) return "alert";
  if (score >= 6) return "amber";
  if (score >= 4) return "sky";
  return "mint";
}

function StatCell({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "ok" }) {
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

function Block({ title, children }: { title: string; children: ReactNode }) {
  const { tc } = useAegisUi();
  return (
    <View style={blk.wrap}>
      <Text style={[blk.title, { color: tc.inkMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

export function CrisisDetailLayout({
  navigation,
  route,
}: {
  navigation: Nav;
  route: Route;
}) {
  const { id } = route.params;
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const night = useColorScheme() === "dark";

  const [d, setD] = useState<CrisisDossierApi | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const { refresh: refreshInventory } = useResourceInventory();

  const load = useCallback(async () => {
    setLoadErr(null);
    setLoading(true);
    try {
      setD(await getCrisis(id));
    } catch (e) {
      setLoadErr(parseHttpErrorMessage((e as Error).message));
      setD(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const meta = d?.meta ?? {};
  const displayName = (meta.display_name as string) || d?.crisis_id || id;
  const crisisType = (meta.crisis_type as string) ?? d?.classification.category ?? "";
  const cfg = getCrisisTypeConfig(crisisType);
  const accent = crisisThemeHex(cfg.color, night);
  const aqi = typeof meta.aqi === "number" ? meta.aqi : null;
  const score = d?.severity.score ?? 0;
  const confPct = d ? Math.round(d.classification.confidence * 100) : 0;
  const factors = (d?.severity.factors ?? []).filter((f) => !isDebugFactor(f));

  useLayoutEffect(() => {
    navigation.setOptions({ title: clip(displayName, 32) });
  }, [navigation, displayName]);

  const setStatus = async (status: CrisisStatusApi) => {
    if (!d || d.status === status) return;
    const hadAllocation = (d.allocation?.units?.length ?? 0) > 0;
    const prev = d;
    setD({ ...d, status });
    setBusy(true);
    setStatusErr(null);
    setStatusNote(null);
    try {
      const updated = await patchCrisisStatus(id, status);
      setD(updated);
      if (
        (status === "resolved" || status === "false_alarm") &&
        hadAllocation &&
        (updated.allocation?.units?.length ?? 0) === 0
      ) {
        setStatusNote("Committed resources returned to the regional pool.");
        await refreshInventory();
      }
    } catch (e) {
      setD(prev);
      setStatusErr(parseHttpErrorMessage((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !d) {
    return (
      <View style={[styles.centered, { backgroundColor: tc.canvas }]}>
        <ActivityIndicator color={tc.primary} />
        <Text style={[styles.loadingTxt, { color: tc.inkMuted }]}>Loading dossier…</Text>
      </View>
    );
  }

  if (loadErr && !d) {
    return (
      <View style={[styles.centered, { backgroundColor: tc.canvas, paddingHorizontal: r.horizontalPad }]}>
        <Ionicons name="alert-circle-outline" size={32} color={tc.alertDeep} />
        <Text style={[styles.errTitle, { color: tc.ink }]}>Could not load crisis</Text>
        <Text style={[styles.errBody, { color: tc.inkMuted }]}>{loadErr}</Text>
        <Pressable onPress={() => void load()} style={[styles.retryBtn, { backgroundColor: tc.primaryDark }]}>
          <Text style={styles.retryTxt}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!d) return null;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: 12,
          paddingBottom: 48,
        },
      ]}
    >
      <View style={[styles.hero, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}>
        <View style={[styles.heroIcon, { backgroundColor: accent }]}>
          <Ionicons name={cfg.icon} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.heroTitle, { color: tc.ink }]} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={[styles.heroSub, { color: tc.inkMuted }]} numberOfLines={1}>
            {crisisType}
          </Text>
        </View>
        <Pill tone={severityTone(score)}>{score}/10</Pill>
      </View>

      <View style={[styles.statGrid, { gap: r.gap, marginTop: sectionGap }]}>
        <StatCell label="Status" value={STATUS_LABEL[d.status] ?? d.status} />
        <StatCell label="Confidence" value={`${confPct}%`} tone="ok" />
        <StatCell
          label="Signals"
          value={String(d.fused.length)}
        />
        <StatCell
          label="Resources"
          value={String(d.allocation.units.length)}
        />
      </View>

      {d.status !== "false_alarm" ? (
        <View style={{ marginTop: sectionGap }}>
          <Text style={[styles.lbl, { color: tc.inkMuted }]}>UPDATE STATUS</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => {
              const on = d.status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => void setStatus(s)}
                  disabled={busy}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: on ? tc.primaryDark : tc.card,
                      borderColor: on ? tc.primaryDark : tc.borderSoft,
                      opacity: busy ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.statusTxt, { color: on ? "#fff" : tc.ink }]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {busy ? <ActivityIndicator color={tc.primary} style={{ marginTop: 8 }} /> : null}
          {d.status !== "resolved" && (d.allocation?.units?.length ?? 0) > 0 ? (
            <Text style={[styles.resolveHint, { color: tc.inkMuted }]}>
              Resolving returns allocated units to inventory.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.falseNote, { color: tc.amberDeep }]}>
          Marked false alarm
          {meta.false_alarm_reason ? ` — ${String(meta.false_alarm_reason)}` : ""}
        </Text>
      )}

      {statusErr ? (
        <View style={[styles.errBar, { borderColor: tc.alert, backgroundColor: night ? "#3b1720" : "#fff1f2" }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={tc.alertDeep} />
          <Text style={[styles.errBarTxt, { color: tc.ink }]} numberOfLines={3}>
            {statusErr}
          </Text>
        </View>
      ) : null}

      {statusNote ? (
        <View style={[styles.okBar, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft, marginTop: 12 }]}>
          <Ionicons name="checkmark-circle-outline" size={16} color={tc.tealDeep} />
          <Text style={[styles.errBarTxt, { color: tc.tealDeep }]}>{statusNote}</Text>
        </View>
      ) : null}

      {d.status !== "false_alarm" && d.status !== "resolved" ? (
        <CrisisResourceAllocator
          crisisId={id}
          dossier={d}
          disabled={busy}
          onSaved={(updated) => setD(updated)}
        />
      ) : null}

      {aqi != null ? (
        <View style={[styles.aqiCard, { marginTop: sectionGap, borderColor: getAQIColor(aqi, night) }]}>
          <Text style={[styles.aqiVal, { color: getAQIColor(aqi, night) }]}>{aqi}</Text>
          <Text style={[styles.aqiLbl, { color: tc.inkMuted }]}>{getAQILabel(aqi)}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: sectionGap }}>
        <Block title="SUMMARY">
          <View style={[styles.card, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
            <Text style={[styles.body, { color: tc.ink }]} numberOfLines={4}>
              {clip(d.classification.rationale, 280)}
            </Text>
            {d.severity.weather_note ? (
              <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={2}>
                Weather: {clip(d.severity.weather_note, 120)}
              </Text>
            ) : null}
          </View>
        </Block>
      </View>

      {factors.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Block title="FACTORS">
            {factors.slice(0, 4).map((f, i) => (
              <Text key={i} style={[styles.bullet, { color: tc.inkSoft }]} numberOfLines={2}>
                · {f}
              </Text>
            ))}
          </Block>
        </View>
      ) : null}

      <View style={{ marginTop: sectionGap }}>
        <Block title={`SIGNALS (${d.fused.length})`}>
          {d.fused.slice(0, 4).map((f) => (
            <Pressable
              key={f.id}
              onPress={() => navigation.navigate("AlertAnalysis", { signalId: f.id })}
              style={[styles.signalRow, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}
            >
              <Text style={[styles.signalTxt, { color: tc.ink }]} numberOfLines={2}>
                {clip(f.summary, 140)}
              </Text>
              <Text style={[styles.meta, { color: tc.inkMuted }]}>
                {f.region} · sev {f.fused_severity_hint}
              </Text>
            </Pressable>
          ))}
        </Block>
      </View>

      {d.allocation.units.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Block title="ALLOCATIONS">
            {d.allocation.units.slice(0, 5).map((u) => (
              <Text key={u.resource_id} style={[styles.bullet, { color: tc.ink }]} numberOfLines={1}>
                · {u.name} ×{u.quantity_available}
              </Text>
            ))}
            {d.allocation.notes ? (
              <Text style={[styles.meta, { color: tc.inkMuted, marginTop: 6 }]} numberOfLines={2}>
                {clip(d.allocation.notes, 100)}
              </Text>
            ) : null}
          </Block>
        </View>
      ) : null}

      <View style={[styles.actions, { gap: r.gap, marginTop: sectionGap }]}>
        <Pressable
          onPress={() => navigation.navigate("MainTabs", { screen: "Reports" })}
          style={[styles.actionBtn, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft }]}
        >
          <Ionicons name="document-text-outline" size={18} color={tc.tealDeep} />
          <Text style={[styles.actionLbl, { color: tc.tealDeep }]}>Reports</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("MainTabs", { screen: "Alerts" })}
          style={[styles.actionBtn, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}
        >
          <Ionicons name="notifications-outline" size={18} color={tc.tealDeep} />
          <Text style={[styles.actionLbl, { color: tc.ink }]}>Alerts</Text>
        </Pressable>
      </View>

      <CrisisOrchestrationPanel dossier={d} />
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

const blk = StyleSheet.create({
  wrap: { marginBottom: 4 },
  title: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingTxt: { fontSize: 13, fontWeight: "600" },
  errTitle: { fontSize: 16, fontWeight: "800" },
  errBody: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  retryBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  retryTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 17, fontWeight: "800", lineHeight: 22 },
  heroSub: { marginTop: 4, fontSize: 12, fontWeight: "600" },
  statGrid: { flexDirection: "row", flexWrap: "wrap" },
  lbl: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    flexGrow: 1,
    minWidth: "30%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statusTxt: { fontSize: 13, fontWeight: "800" },
  resolveHint: { marginTop: 8, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  falseNote: { marginTop: 12, fontSize: 13, fontWeight: "700" },
  okBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  errBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  errBarTxt: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  aqiCard: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  aqiVal: { fontSize: 36, fontWeight: "900" },
  aqiLbl: { marginTop: 4, fontSize: 12, fontWeight: "700" },
  card: { padding: 12, borderRadius: 14, borderWidth: 1 },
  body: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  meta: { marginTop: 8, fontSize: 11, fontWeight: "600" },
  bullet: { fontSize: 13, fontWeight: "600", marginBottom: 4, lineHeight: 18 },
  signalRow: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  signalTxt: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  actions: { flexDirection: "row" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionLbl: { fontSize: 13, fontWeight: "800" },
});

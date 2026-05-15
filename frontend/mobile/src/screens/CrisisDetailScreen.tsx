import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { getCrisis, patchCrisisStatus } from "../api/client";
import type { CrisisDossierApi, CrisisStatusApi } from "../api/types";
import type { RootStackParamList } from "../navigation/types";
import { getCrisisTypeConfig, crisisThemeHex } from "../constants/crisisTypes";
import { getAQIColor, getAQILabel } from "../utils/aqi";
import { useAegisUi } from "../hooks/useAegisUi";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "CrisisDetail">;
  route: RouteProp<RootStackParamList, "CrisisDetail">;
};

const STATUSES: CrisisStatusApi[] = ["active", "monitoring", "resolved"];

export function CrisisDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { tc, r, contentWrap } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";
  const [d, setD] = useState<CrisisDossierApi | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const dossier = await getCrisis(id);
      setD(dossier);
      const em = dossier.meta?.etaMinutes;
      setEtaMin(typeof em === "number" ? em : null);
    } catch (e) {
      setErr(String((e as Error).message));
      setD(null);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (etaMin == null || etaMin <= 0) return;
    const idInt = setInterval(() => {
      setEtaMin((m) => (m != null && m > 0 ? m - 1 : 0));
    }, 60_000);
    return () => clearInterval(idInt);
  }, [etaMin, id]);

  const setStatus = async (status: CrisisStatusApi) => {
    if (!d || d.status === status) return;
    setBusy(true);
    setErr(null);
    try {
      setD(await patchCrisisStatus(id, status));
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const meta = d?.meta ?? {};
  const crisisType = (meta.crisis_type as string) ?? d?.classification.category ?? "";
  const cfg = getCrisisTypeConfig(crisisType);
  const accent = crisisThemeHex(cfg.color, schemeDark);
  const aqi = typeof meta.aqi === "number" ? meta.aqi : null;
  const isAir = crisisType === "Air Quality Emergency";
  const isDust = crisisType === "Dust Storm";
  const isHeat = crisisType === "Heatwave";
  const compound = meta.compound_risk as
    | {
        linked_crisis_id?: string;
        linked_title?: string;
        body?: string;
      }
    | undefined;

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.background }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: 48,
        },
      ]}
    >
      <Text style={[styles.h1, { color: tc.ink }]}>{(meta.display_name as string) ?? id}</Text>
      {err ? <Text style={[styles.err, { color: tc.alertDeep }]}>{err}</Text> : null}
      {!d && !err ? <Text style={[styles.muted, { color: tc.inkSoft }]}>Loading…</Text> : null}

      {isAir && aqi != null ? (
        <View
          style={[
            styles.evoRow,
            { backgroundColor: schemeDark ? "rgba(59, 7, 100, 0.35)" : "#f3e8ff" },
          ]}
        >
          <Ionicons name="trending-up-outline" size={18} color={accent} />
          <Text style={[styles.evoTxt, { color: tc.ink }]}>
            Plume SPREADING — wind shift detected (NW → SE)
          </Text>
        </View>
      ) : null}
      {isDust ? (
        <View style={[styles.evoRow, { backgroundColor: tc.warnSurface }]}>
          <Ionicons name="arrow-forward-outline" size={18} color={tc.amberDeep} />
          <Text style={[styles.evoTxt, { color: tc.ink }]}>
            Storm APPROACHING — {etaMin != null ? `${etaMin} min` : "—"} to impact
          </Text>
        </View>
      ) : null}

      {isHeat && compound?.linked_crisis_id ? (
        <View style={[styles.compound, { borderColor: tc.amber, backgroundColor: tc.warnSurface }]}>
          <Text style={[styles.compoundTitle, { color: tc.amberDeep }]}>Compound risk detected</Text>
          <Text style={[styles.body, { color: tc.ink, marginTop: 6 }]}>
            {compound.body ??
              "Adjacent air quality crisis may compound heat stress for vulnerable residents."}
          </Text>
          <Pressable
            onPress={() => navigation.navigate("CrisisDetail", { id: compound.linked_crisis_id! })}
            style={{ marginTop: 10 }}
          >
            <Text style={{ fontWeight: "900", color: tc.tealDeep }}>
              View {compound.linked_title ?? "linked crisis"} →
            </Text>
          </Pressable>
        </View>
      ) : null}

      {d ? (
        <>
          <Section title="Status" tc={tc}>
            <Text style={[styles.body, { color: tc.ink }]}>
              {d.status}
              {d.meta?.false_alarm_reason ? ` — ${String(d.meta.false_alarm_reason)}` : ""}
            </Text>
            {d.status !== "false_alarm" ? (
              <View style={styles.statusRow}>
                {STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => void setStatus(s)}
                    disabled={busy}
                    style={[
                      styles.statusChip,
                      { backgroundColor: tc.muted },
                      d.status === s && [styles.statusChipOn, { backgroundColor: tc.ink }],
                      busy && { opacity: 0.5 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipTxt,
                        { color: tc.inkSoft },
                        d.status === s && styles.statusChipTxtOn,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {busy ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
          </Section>

          <Section title="Classification" tc={tc}>
            <Text style={[styles.body, { color: tc.ink }]}>
              {crisisType} · {(d.classification.confidence * 100).toFixed(0)}% conf.
            </Text>
            <Text style={[styles.sub, { color: tc.inkSoft }]}>{d.classification.rationale}</Text>
          </Section>

          {isAir && aqi != null ? (
            <Section title="Air quality metrics" tc={tc}>
              <View style={[styles.gauge, { borderColor: getAQIColor(aqi, schemeDark) }]}>
                <Text style={[styles.gaugeVal, { color: getAQIColor(aqi, schemeDark) }]}>{aqi}</Text>
                <Text style={[styles.sub, { color: tc.inkSoft }]}>{getAQILabel(aqi)} · 0–500 scale</Text>
              </View>
              {meta.pollutants && typeof meta.pollutants === "object" ? (
                <View style={{ marginTop: 12 }}>
                  {Object.entries(meta.pollutants as Record<string, unknown>).map(([k, v]) => {
                    if (typeof v !== "object" || v === null) return null;
                    const row = v as { value: number; unit: string; whoLimit?: number; multiplier?: number };
                    return (
                      <Text key={k} style={[styles.bullet, { color: tc.ink }]}>
                        • {k}: {row.value} {row.unit}
                        {row.multiplier != null ? ` — ${row.multiplier}× limit` : ""}
                      </Text>
                    );
                  })}
                </View>
              ) : null}
              <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 10 }]}>
                Wind {String(meta.windDirection ?? "")} · {String(meta.windSpeed ?? "")}
              </Text>
              <Text style={[styles.body, { color: tc.ink, marginTop: 8 }]}>
                Source: {String(meta.sourceAttribution ?? "—")}
              </Text>
              <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 8 }]}>
                {String(meta.health_impact_note ?? "")}
              </Text>
              {meta.hypothesis_a && meta.hypothesis_b ? (
                <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: tc.card }}>
                  <Text style={[styles.body, { color: tc.ink }]}>Conflicting hypotheses</Text>
                  <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 6 }]}>
                    A — {(meta.hypothesis_a as { title: string }).title} ·{" "}
                    {(meta.hypothesis_a as { confidence_pct: number }).confidence_pct}% ·{" "}
                    {(meta.hypothesis_a as { signals: number }).signals} signals
                  </Text>
                  <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 4 }]}>
                    B — {(meta.hypothesis_b as { title: string }).title} ·{" "}
                    {(meta.hypothesis_b as { confidence_pct: number }).confidence_pct}% ·{" "}
                    {(meta.hypothesis_b as { signals: number }).signals} signals
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => navigation.navigate("Predictions")}
                  style={[styles.linkChip, { borderColor: tc.border, backgroundColor: tc.card }]}
                >
                  <Text style={[styles.linkChipTxt, { color: tc.tealDeep }]}>Prediction engine</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate("MainTabs", { screen: "Reports" })}
                  style={[styles.linkChip, { borderColor: tc.border, backgroundColor: tc.card }]}
                >
                  <Text style={[styles.linkChipTxt, { color: tc.tealDeep }]}>Stakeholder messages</Text>
                </Pressable>
              </View>
            </Section>
          ) : null}

          {isDust ? (
            <Section title="Storm metrics" tc={tc}>
              <Text style={[styles.body, { color: tc.ink }]}>
                Visibility {String((meta.primary_metric as { value?: number } | undefined)?.value ?? "—")} km → peak ~{" "}
                {String((meta.primary_metric as { projected?: number } | undefined)?.projected ?? "0.18")} km
              </Text>
              <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 6 }]}>
                PM10 peak forecast {String(meta.forecastPM10Peak ?? "850+ µg/m³")}
              </Text>
              <Text style={[styles.sub, { color: tc.inkSoft, marginTop: 6 }]}>
                {String(meta.transportRisk ?? "")}
              </Text>
              <Text style={[styles.body, { color: tc.ink, marginTop: 10 }]}>
                Arrival in {etaMin != null ? `${etaMin} min` : "—"} · Duration 2–4h at peak
              </Text>
              <Pressable onPress={() => navigation.navigate("Predictions")} style={{ marginTop: 14 }}>
                <Text style={{ fontWeight: "900", color: tc.tealDeep }}>Dust corridor predictions →</Text>
              </Pressable>
            </Section>
          ) : null}

          <Section title="Severity" tc={tc}>
            <Text style={[styles.body, { color: tc.ink }]}>Score {d.severity.score}/10</Text>
            {d.severity.factors.map((f, i) => (
              <Text key={i} style={[styles.bullet, { color: tc.inkSoft }]}>
                • {f}
              </Text>
            ))}
            {d.severity.weather_note ? (
              <Text style={[styles.sub, { color: tc.inkSoft }]}>Weather: {d.severity.weather_note}</Text>
            ) : null}
          </Section>

          <Section title="Timeline" tc={tc}>
            {isAir ? (
              <>
                <Text style={[styles.bullet, { color: tc.inkSoft }]}>• Sensor threshold crossed — F7 cluster</Text>
                <Text style={[styles.bullet, { color: tc.inkSoft }]}>• PMD advisory cross-check</Text>
                <Text style={[styles.bullet, { color: tc.inkSoft }]}>• PEPA satellite confirmation queued</Text>
                <Text style={[styles.bullet, { color: tc.inkSoft }]}>• Health advisory draft (6 audiences)</Text>
              </>
            ) : (
              <Text style={[styles.sub, { color: tc.inkSoft }]}>Standard fusion timeline — see Operations log.</Text>
            )}
          </Section>

          <Section title="Fused signals" tc={tc}>
            {d.fused.map((f) => (
              <View key={f.id} style={[styles.card, { borderColor: tc.border, backgroundColor: tc.card }]}>
                <Text style={[styles.body, { color: tc.ink }]}>{f.summary}</Text>
                <Text style={[styles.sub, { color: tc.inkSoft }]}>
                  {f.region} · sev {f.fused_severity_hint}
                </Text>
              </View>
            ))}
          </Section>

          <Section title="Allocations" tc={tc}>
            <Text style={[styles.sub, { color: tc.inkSoft }]}>{d.allocation.notes}</Text>
            {d.allocation.units.map((u) => (
              <Text key={u.resource_id} style={[styles.bullet, { color: tc.ink }]}>
                • {u.name} ×{u.quantity_available}
              </Text>
            ))}
          </Section>

          <Section title="Swipe actions (demo)" tc={tc}>
            <Text style={[styles.sub, { color: tc.inkSoft }]}>
              {isAir
                ? "Issue Health Advisory · Send Alert · Escalate PEPA"
                : "Send Alert · Reassign · Stand down"}
            </Text>
            {isAir ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => navigation.navigate("MainTabs", { screen: "Reports" })}
                  style={[styles.linkChip, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft }]}
                >
                  <Text style={[styles.linkChipTxt, { color: tc.tealDeep }]}>Issue health advisory (drafts)</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate("Predictions")}
                  style={[styles.linkChip, { borderColor: tc.border, backgroundColor: tc.card }]}
                >
                  <Text style={[styles.linkChipTxt, { color: tc.tealDeep }]}>Scenario branch A/B</Text>
                </Pressable>
              </View>
            ) : null}
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}

function Section({
  title,
  children,
  tc,
}: {
  title: string;
  children: React.ReactNode;
  tc: ReturnType<typeof useAegisUi>["tc"];
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[styles.section, { color: tc.inkMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  h1: {
    fontSize: 18,
    fontWeight: "800",
  },
  err: { marginTop: 8 },
  muted: { marginTop: 8 },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  body: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 4 },
  bullet: { fontSize: 13, marginTop: 4 },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  statusChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  statusChipOn: {},
  statusChipTxt: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  statusChipTxtOn: { color: "#fff" },
  gauge: {
    marginTop: 8,
    padding: 20,
    borderRadius: 999,
    borderWidth: 4,
    alignSelf: "flex-start",
    alignItems: "center",
    minWidth: 140,
  },
  gaugeVal: { fontSize: 36, fontWeight: "900" },
  evoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
  },
  evoTxt: { flex: 1, fontSize: 13, fontWeight: "700" },
  compound: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
  },
  compoundTitle: { fontSize: 13, fontWeight: "900" },
  linkChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkChipTxt: { fontSize: 12, fontWeight: "900" },
});

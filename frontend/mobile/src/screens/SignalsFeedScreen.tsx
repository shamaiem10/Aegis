import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useSignalStream } from "../../lib/firestore/hooks";
import type { SignalApi } from "../api/types";
import { Card, PageHeader, Pill } from "../components/aegis/AppShell";
import type { PillTone } from "../components/aegis/AppShell";
import type { RootStackParamList } from "../navigation/types";
import { signalListKey } from "../utils/signalListKey";
import { useAegisUi } from "../hooks/useAegisUi";
import { useThemeCiro } from "../theme/useThemeCiro";
import { getAQIColor } from "../utils/aqi";

type Nav = NativeStackNavigationProp<RootStackParamList, "SignalsFeed">;

type FilterKey = "all" | "air" | "environmental" | "social" | "verified";

function getBadgeForSeverity(sev: number): string {
  if (sev >= 8) return "CRITICAL";
  if (sev >= 6) return "WARNING";
  if (sev >= 4) return "SUSPICIOUS";
  return "VERIFIED";
}

function getToneForSeverity(sev: number): PillTone {
  if (sev >= 8) return "alert";
  if (sev >= 6) return "amber";
  if (sev >= 4) return "sky";
  return "mint";
}

function credPct(s: SignalApi): number | null {
  const p = s.payload?.credibility_pct;
  return typeof p === "number" ? p : null;
}

function categoryOf(s: SignalApi): "air" | "environmental" | "other" {
  const t = `${s.kind} ${s.text} ${s.source}`.toLowerCase();
  if (/pepa|pims|satellite|pmd|aqi|pm2|pm10|smog|dust|visibility|epa|ogdcl/.test(t)) {
    if (/dust|pmd|visibility|corridor/.test(t)) return "environmental";
    return "air";
  }
  if (/open-meteo|heat|weatherapi|wind|forecast/.test(t)) return "environmental";
  return "other";
}

/** Mention velocity sparkline — 90 points, 3 series with setInterval tick */
function VelocityChart({ schemeDark }: { schemeDark: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => (x + 1) % 90), 2000);
    return () => clearInterval(id);
  }, []);
  const n = 24;
  const series = useMemo(() => {
    const g10 = Array.from({ length: n }, (_, i) => 30 + Math.min(70, (i + tick) * 2.5 + (i % 5) * 3));
    const f7 = Array.from({ length: n }, (_, i) => 25 + Math.min(92, i * 2.2 + tick * 0.8));
    const i8 = Array.from({ length: n }, (_, i) => 40 + Math.sin((i + tick) * 0.35) * 18 + 15);
    return { g10, f7, i8 };
  }, [tick, n]);
  const W = 280;
  const H = 72;
  return (
    <Card style={{ marginBottom: 14, padding: 12 }}>
      <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 1, color: schemeDark ? "#94a3b8" : "#64748b" }}>
        MENTION VELOCITY (90 MIN)
      </Text>
      <View style={{ height: H, marginTop: 10, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={i} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View
              style={{
                height: Math.max(4, (series.g10[i] / 100) * H),
                borderRadius: 2,
                backgroundColor: "#2563eb",
                opacity: 0.85,
                marginBottom: 1,
              }}
            />
            <View
              style={{
                height: Math.max(4, (series.f7[i] / 100) * H),
                borderRadius: 2,
                backgroundColor: getAQIColor(280, schemeDark),
                opacity: 0.95,
                marginBottom: 1,
              }}
            />
            <View
              style={{
                height: Math.max(4, (series.i8[i] / 100) * H),
                borderRadius: 2,
                backgroundColor: "#ea580c",
                opacity: 0.85,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563eb" }}>● G-10 flood buzz</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: getAQIColor(290, schemeDark) }}>
          ● F-7 air quality
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#ea580c" }}>● I-8 heat mentions</Text>
      </View>
    </Card>
  );
}

import { useForegroundRegion } from "../hooks/useForegroundRegion";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function SignalsFeedScreen({ navigation }: { navigation: Nav }) {
  const { tc, r, contentWrap } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";
  const [filter, setFilter] = useState<FilterKey>("all");
  const { data, loading } = useSignalStream(filter === "all" ? undefined : filter);
  const { region } = useForegroundRegion();

  const counts = useMemo(() => {
    const air = data.filter((s) => categoryOf(s) === "air").length;
    const env = data.filter((s) => categoryOf(s) === "environmental").length;
    const social = data.filter((s) => /social|twitter|flagged/i.test(s.source)).length;
    const ver = data.filter((s) => credPct(s) != null && (credPct(s) as number) >= 85).length;
    return { all: data.length, air, environmental: env, social, verified: ver };
  }, [data]);

  const filtered = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "air") return data.filter((s) => categoryOf(s) === "air");
    if (filter === "environmental") return data.filter((s) => categoryOf(s) === "environmental");
    if (filter === "social") return data.filter((s) => /social|twitter|flagged/i.test(s.source));
    return data.filter((s) => credPct(s) != null && (credPct(s) as number) >= 85);
  }, [data, filter]);

  const misinfo = data.some((s) => {
    const f = s.payload?.flags as string[] | undefined;
    return f?.includes("contradiction") || f?.includes("suspicious");
  });

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "air", label: `Air Quality ${counts.air}` },
    { key: "environmental", label: `Environmental ${counts.environmental}` },
    { key: "social", label: `Social ${counts.social}` },
    { key: "verified", label: `High trust ${counts.verified}` },
  ];

  return (
    <View style={[styles.wrap, { backgroundColor: tc.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(s, i) => signalListKey(s, i)}
        extraData={filter}
        contentContainerStyle={[
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 8,
            paddingBottom: 40,
          },
        ]}
        ListHeaderComponent={
          <>
            {misinfo ? (
              <View
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: schemeDark ? "#422006" : "#fff7ed",
                  borderWidth: 1,
                  borderColor: "#fdba74",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "800", color: schemeDark ? "#fdba74" : "#9a3412" }}>
                  ⚠ Suspicious signal linked to F-7 Air Quality — likely misinformation. Verify before any escalation.
                </Text>
              </View>
            ) : null}
            <PageHeader
              eyebrow="Pakistan AOI"
              title="Signal stream"
              sub="Filters + mention velocity. Same signal source as HQ; demo bundle uses Islamabad v2 seed when offline."
              right={<Pill tone="sky">{loading ? "Loading..." : `${data.length} signals`}</Pill>}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
              {chips.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => setFilter(c.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: filter === c.key ? tc.tealSoft : tc.card,
                      borderColor: filter === c.key ? tc.tealDeep : tc.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: filter === c.key ? tc.tealDeep : tc.ink,
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <VelocityChart schemeDark={schemeDark} />
          </>
        }
        renderItem={({ item }) => {
          const cred = credPct(item);
          const flags = item.payload?.flags as string[] | undefined;
          const link = item.payload?.linked_crisis_id as string | undefined;
          
          let distStr = "—";
          if (region) {
            const d = haversineDistance(region.latitude, region.longitude, item.lat, item.lon);
            distStr = d < 10 ? d.toFixed(1) + "km" : Math.round(d) + "km";
          }

          return (
            <Pressable onPress={() => navigation.navigate("AlertAnalysis", { signalId: item.id })}>
              <Card style={[styles.card, { borderColor: tc.border, backgroundColor: tc.card }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.id, { color: tc.ink }]}>{item.id}</Text>
                  <Pill tone={getToneForSeverity(item.severity_hint)}>{getBadgeForSeverity(item.severity_hint)}</Pill>
                </View>
                <Text style={[styles.source, { color: tc.primaryDark }]}>{item.source}</Text>
                <Text style={[styles.text, { color: tc.ink }]}>{item.text}</Text>
                {cred != null ? (
                  <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "800", color: tc.inkSoft }}>
                    Credibility {cred}%
                    {link ? ` · → ${link}` : ""}
                  </Text>
                ) : null}
                {flags?.length ? (
                  <Text style={{ marginTop: 4, fontSize: 11, fontWeight: "800", color: tc.alertDeep }}>
                    FLAGS: {flags.join(", ")}
                  </Text>
                ) : null}
                <Text style={[styles.time, { color: tc.inkSoft }]}>{new Date(item.recorded_at).toLocaleString()}</Text>
                <View style={styles.metrics}>
                  <Metric label="sev" val={item.severity_hint} tc={tc} />
                  <Metric label="lat" val={parseFloat(item.lat.toFixed(2))} tc={tc} />
                  <Metric label="lon" val={parseFloat(item.lon.toFixed(2))} tc={tc} />
                  <MetricStr label="dist" val={distStr} tc={tc} />
                </View>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ textAlign: "center", color: tc.inkSoft, marginTop: 24 }}>No signals for this filter.</Text>
          ) : null
        }
      />
    </View>
  );
}

function Metric({ label, val, tc }: { label: string; val: number; tc: ReturnType<typeof useThemeCiro> }) {
  return (
    <View style={metricStyles.cell}>
      <Text style={[metricStyles.lab, { color: tc.inkSoft }]}>{label}</Text>
      <Text style={[metricStyles.val, { color: tc.ink }]}>{val}</Text>
    </View>
  );
}

function MetricStr({ label, val, tc }: { label: string; val: string; tc: ReturnType<typeof useThemeCiro> }) {
  return (
    <View style={metricStyles.cell}>
      <Text style={[metricStyles.lab, { color: tc.inkSoft }]}>{label}</Text>
      <Text style={[metricStyles.val, { color: tc.ink }]}>{val}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  cell: { alignItems: "center" },
  lab: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  val: { fontSize: 14, fontWeight: "800" },
});

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginRight: 6 },
  card: { marginBottom: 12, borderWidth: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  id: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "800",
  },
  source: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  text: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  time: { marginTop: 8, fontSize: 11 },
  metrics: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

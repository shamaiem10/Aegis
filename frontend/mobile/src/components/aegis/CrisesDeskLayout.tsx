/**
 * Crisis panel — compact list with working filters.
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { useCrisisStream } from "../../../lib/firestore/hooks";
import type { CrisisDossierApi } from "../../api/types";
import type { RootStackParamList } from "../../navigation/types";
import { getCrisisTypeConfig, crisisThemeHex } from "../../constants/crisisTypes";
import { getAQIColor } from "../../utils/aqi";
import { useAegisUi } from "../../hooks/useAegisUi";
import { Pill } from "./AppShell";

type Nav = NativeStackNavigationProp<RootStackParamList, "Crises">;

type CrisisFilter = "all" | "active" | "monitoring" | "false_alarm";

const FILTERS: { key: CrisisFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "monitoring", label: "Watch" },
  { key: "false_alarm", label: "False" },
];

function crisisName(item: CrisisDossierApi): string {
  const n = (item.meta?.display_name as string) ?? "";
  return n || item.crisis_id;
}

function crisisMeta(item: CrisisDossierApi): string {
  const ct = (item.meta?.crisis_type as string) ?? item.classification.category;
  const badge =
    item.status === "false_alarm"
      ? "False alarm"
      : item.status === "monitoring"
        ? "Monitoring"
        : String(item.meta?.ui_severity_label ?? `Sev ${item.severity.score}`);
  const aqi = item.meta?.aqi as number | undefined;
  return [ct, badge, typeof aqi === "number" ? `AQI ${aqi}` : null].filter(Boolean).join(" · ");
}

function isCritical(item: CrisisDossierApi): boolean {
  const lbl = String(item.meta?.ui_severity_label ?? "");
  const score = Number(item.severity?.score);
  return lbl === "Critical" || (Number.isFinite(score) && score >= 8);
}

function matchesFilter(item: CrisisDossierApi, filter: CrisisFilter): boolean {
  if (filter === "all") return true;
  if (filter === "false_alarm") return item.status === "false_alarm";
  if (filter === "monitoring") return item.status === "monitoring";
  return item.status === "active";
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

function CrisisRow({
  item,
  onPress,
}: {
  item: CrisisDossierApi;
  onPress: () => void;
}) {
  const { tc } = useAegisUi();
  const night = useColorScheme() === "dark";
  const ct = (item.meta?.crisis_type as string) ?? item.classification.category;
  const cfg = getCrisisTypeConfig(ct);
  const border = crisisThemeHex(cfg.color, night);

  return (
    <Pressable
      onPress={onPress}
      style={[row.wrap, { backgroundColor: tc.card, borderColor: tc.borderSoft, borderLeftColor: border }]}
    >
      <View style={[row.icon, { backgroundColor: border }]}>
        <Ionicons name={cfg.icon} size={18} color="#fff" />
      </View>
      <View style={row.body}>
        <Text style={[row.title, { color: tc.ink }]} numberOfLines={1}>
          {crisisName(item)}
        </Text>
        <Text style={[row.meta, { color: tc.inkMuted }]} numberOfLines={1}>
          {crisisMeta(item)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tc.inkMuted} />
    </Pressable>
  );
}

function ListHeader({
  children,
}: {
  children: ReactNode;
}) {
  return <View style={{ marginBottom: 4 }}>{children}</View>;
}

export function CrisesDeskLayout({ navigation }: { navigation: Nav }) {
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const night = useColorScheme() === "dark";
  const { data: unsortedRows, loading, usingFallback: firestoreIssue } = useCrisisStream();
  const [filter, setFilter] = useState<CrisisFilter>("all");

  const rows = useMemo(
    () => [...unsortedRows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [unsortedRows],
  );

  const filtered = useMemo(() => rows.filter((c) => matchesFilter(c, filter)), [rows, filter]);

  const maxAqi = useMemo(() => {
    let m = 0;
    for (const c of rows) {
      const a = typeof c.meta?.aqi === "number" ? (c.meta.aqi as number) : 0;
      if (a > m) m = a;
    }
    return m;
  }, [rows]);

  const criticalCount = useMemo(() => rows.filter(isCritical).length, [rows]);
  const activeCount = useMemo(() => rows.filter((c) => c.status === "active").length, [rows]);
  const f7Crisis = useMemo(() => rows.find((c) => c.crisis_id === "crisis-f7-003"), [rows]);

  const filterCounts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((c) => c.status === "active").length,
      monitoring: rows.filter((c) => c.status === "monitoring").length,
      false_alarm: rows.filter((c) => c.status === "false_alarm").length,
    }),
    [rows],
  );

  const header = (
    <ListHeader>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>CRISES</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>Panel</Text>
        </View>
        <Pill tone={criticalCount > 0 ? "alert" : "mint"}>{rows.length} live</Pill>
      </View>

      <View style={[styles.statGrid, { gap: r.gap, marginTop: 12 }]}>
        <StatCell label="Active" value={String(activeCount)} tone={activeCount > 0 ? "warn" : "default"} />
        <StatCell label="Critical" value={String(criticalCount)} tone={criticalCount > 0 ? "warn" : "default"} />
        <StatCell
          label="Peak AQI"
          value={maxAqi > 0 ? String(maxAqi) : "—"}
          tone={maxAqi > 150 ? "warn" : "default"}
        />
        <StatCell label="Watching" value={String(filterCounts.monitoring)} />
      </View>

      <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={2}>
        {firestoreIssue ? "Firestore offline — check env or network" : "Live stream · tap row for dossier"}
      </Text>

      {maxAqi > 200 && f7Crisis ? (
        <Pressable
          onPress={() => navigation.navigate("CrisisDetail", { id: f7Crisis.crisis_id })}
          style={[
            styles.warnBar,
            {
              marginTop: sectionGap,
              backgroundColor: night ? "#3b0764" : "#ede9fe",
              borderColor: getAQIColor(maxAqi, night),
            },
          ]}
        >
          <Ionicons name="leaf-outline" size={16} color={getAQIColor(maxAqi, night)} />
          <Text style={[styles.warnTxt, { color: tc.ink }]} numberOfLines={2}>
            Hazardous AQI {maxAqi} — tap for F-7 dossier
          </Text>
          <Ionicons name="chevron-forward" size={16} color={tc.inkMuted} />
        </Pressable>
      ) : null}

      <View style={[styles.chipGrid, { gap: r.gap, marginTop: sectionGap }]}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          const cnt = filterCounts[f.key];
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? tc.tealSoft : tc.card,
                  borderColor: on ? tc.tealDeep : tc.borderSoft,
                },
              ]}
            >
              <Text style={[styles.chipLbl, { color: on ? tc.tealDeep : tc.ink }]}>{f.label}</Text>
              <Text style={[styles.chipCnt, { color: on ? tc.tealDeep : tc.inkMuted }]}>{cnt}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.status, { color: tc.inkMuted }]}>
        {loading ? "Loading…" : `${filtered.length} shown`}
      </Text>
    </ListHeader>
  );

  return (
    <View style={[styles.outer, { backgroundColor: tc.canvas }]}>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.crisis_id}
        contentContainerStyle={[
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 8,
            paddingBottom: r.tabBarClearance,
          },
        ]}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <CrisisRow
            item={item}
            onPress={() => navigation.navigate("CrisisDetail", { id: item.crisis_id })}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: tc.inkMuted }]}>
              {rows.length === 0
                ? "No crises yet — run pipeline or seed Firestore."
                : "No crises in this filter."}
            </Text>
          ) : (
            <ActivityIndicator color={tc.primary} style={{ marginTop: 24 }} />
          )
        }
      />
    </View>
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

const row = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800" },
  meta: { marginTop: 4, fontSize: 11, fontWeight: "600" },
});

const styles = StyleSheet.create({
  outer: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  statGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { marginTop: 8, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  warnBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "700" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: "22%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  chipLbl: { fontSize: 12, fontWeight: "800" },
  chipCnt: { fontSize: 11, fontWeight: "800" },
  status: { marginTop: 10, marginBottom: 6, fontSize: 11, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 24, fontSize: 13, fontWeight: "600", lineHeight: 19 },
});

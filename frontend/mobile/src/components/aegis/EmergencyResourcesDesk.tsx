/**
 * Emergency resources — compact inventory list.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useResourceInventory } from "../../../lib/firestore/hooks";
import type { ResourceUnitApi } from "../../api/types";
import { useAegisUi } from "../../hooks/useAegisUi";
import {
  RESOURCE_KIND_FILTERS,
  kindIcon,
  kindLabel,
  type ResourceFilterKey,
} from "../../utils/resourceKinds";
import { Pill } from "./AppShell";

function formatUpdatedShort(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { tc } = useAegisUi();
  return (
    <View style={sec.wrap}>
      <Text style={[sec.title, { color: tc.inkMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function UnitRow({ unit }: { unit: ResourceUnitApi }) {
  const { tc } = useAegisUi();
  const total = unit.quantity_total ?? unit.quantity_available;
  const avail = unit.quantity_available;
  const pct = total > 0 ? Math.round((avail / total) * 100) : 100;
  const low = pct < 25 || unit.status === "deployed";

  const meta = [
    kindLabel(unit.kind),
    unit.source === "openstreetmap" ? "OSM" : "Official",
    total > 0 ? `${avail}/${total}` : `${avail} units`,
  ].join(" · ");

  return (
    <View style={[row.wrap, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
      <View style={[row.icon, { backgroundColor: tc.tealSoft }]}>
        <Ionicons name={kindIcon(unit.kind)} size={18} color={tc.tealDeep} />
      </View>
      <View style={row.body}>
        <View style={row.head}>
          <Text style={[row.name, { color: tc.ink }]} numberOfLines={1}>
            {unit.name}
          </Text>
          <Pill tone={low ? "amber" : "mint"}>{avail}</Pill>
        </View>
        {unit.agency ? (
          <Text style={[row.agency, { color: tc.inkSoft }]} numberOfLines={1}>
            {unit.agency}
          </Text>
        ) : null}
        <Text style={[row.meta, { color: tc.inkMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

export function EmergencyResourcesDesk() {
  const { tc, r, contentWrap, sectionGap } = useAegisUi();
  const { data: pools, units, region, updatedAt, sources, loading, usingFallback, error, refresh } =
    useResourceInventory();

  const [filter, setFilter] = useState<ResourceFilterKey>("all");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const filteredUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      if (filter !== "all" && u.kind !== filter) return false;
      if (!q) return true;
      const hay = `${u.name} ${u.agency ?? ""} ${u.tags?.join(" ") ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [units, filter, query]);

  const stats = useMemo(() => {
    const available = units.reduce((s, u) => s + u.quantity_available, 0);
    const total = units.reduce((s, u) => s + (u.quantity_total ?? u.quantity_available), 0);
    return { facilities: units.length, available, total, poolTypes: pools.length };
  }, [units, pools]);

  const regionLabel = region.replace(/_/g, " · ");
  const searchActive = query.trim().length > 0;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={tc.primary} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>RESOURCES</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>Emergency</Text>
        </View>
        <Pill tone={usingFallback ? "amber" : "mint"}>{usingFallback ? "Cached" : "Live"}</Pill>
        <Pressable onPress={() => void onRefresh()} hitSlop={12} style={styles.refreshBtn}>
          {loading ? (
            <ActivityIndicator size="small" color={tc.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={22} color={tc.inkSoft} />
          )}
        </Pressable>
      </View>

      <View style={[styles.statGrid, { gap: r.gap, marginTop: 12 }]}>
        <StatCell label="Facilities" value={String(stats.facilities)} />
        <StatCell label="Available" value={String(stats.available)} tone="ok" />
        <StatCell label="Capacity" value={`${stats.available}/${stats.total}`} />
        <StatCell label="Updated" value={formatUpdatedShort(updatedAt).split(",")[0] ?? "—"} />
      </View>

      <Text style={[styles.meta, { color: tc.inkMuted }]} numberOfLines={2}>
        {regionLabel}
        {sources ? ` · ${sources.curated} official · ${sources.openstreetmap} OSM` : ""}
        {updatedAt ? ` · ${formatUpdatedShort(updatedAt)}` : ""}
      </Text>

      {error && !units.length ? (
        <Text style={[styles.err, { color: tc.alertDeep }]} numberOfLines={2}>
          {error}
        </Text>
      ) : null}

      {pools.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <Section title="POOLS">
            {pools.slice(0, 6).map((p) => {
              const pct = p.total > 0 ? Math.round((p.deployed / p.total) * 100) : 0;
              return (
                <View
                  key={p.type}
                  style={[styles.poolRow, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}
                >
                  <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={16} color={tc.tealDeep} />
                  <Text style={[styles.poolLbl, { color: tc.ink }]} numberOfLines={1}>
                    {p.type}
                  </Text>
                  <Text style={[styles.poolCnt, { color: tc.inkMuted }]}>
                    {p.deployed}/{p.total}
                  </Text>
                  <Text style={[styles.poolPct, { color: pct > 70 ? tc.amberDeep : tc.tealDeep }]}>
                    {pct}%
                  </Text>
                </View>
              );
            })}
          </Section>
        </View>
      ) : null}

      <View style={[styles.search, { backgroundColor: tc.card, borderColor: tc.borderSoft, marginTop: sectionGap }]}>
        <Ionicons name="search-outline" size={18} color={tc.inkMuted} />
        <TextInput
          placeholder="Search name or agency…"
          placeholderTextColor={tc.inkMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: tc.ink }]}
        />
        {searchActive ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={tc.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.chipGrid, { gap: r.gap, marginTop: 10 }]}>
        {RESOURCE_KIND_FILTERS.map((f) => {
          const on = filter === f.key;
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
              <Ionicons name={f.icon} size={14} color={on ? tc.tealDeep : tc.inkMuted} />
              <Text style={[styles.chipLbl, { color: on ? tc.tealDeep : tc.ink }]} numberOfLines={1}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.status, { color: tc.inkMuted }]}>
        {loading ? "Loading…" : `${filteredUnits.length} of ${units.length} facilities`}
      </Text>

      <View style={{ marginTop: 8 }}>
        {loading && filteredUnits.length === 0 ? (
          <ActivityIndicator color={tc.primary} style={{ marginVertical: 24 }} />
        ) : null}
        {!loading && filteredUnits.length === 0 ? (
          <Text style={[styles.empty, { color: tc.inkMuted }]}>
            No matches — change filter or pull to refresh.
          </Text>
        ) : null}
        {filteredUnits.map((u) => (
          <UnitRow key={u.resource_id} unit={u} />
        ))}
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

const sec = StyleSheet.create({
  wrap: { marginBottom: 4 },
  title: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
});

const row = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: "800" },
  agency: { marginTop: 2, fontSize: 12, fontWeight: "600" },
  meta: { marginTop: 4, fontSize: 11, fontWeight: "600" },
});

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  refreshBtn: { padding: 4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { marginTop: 8, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  err: { marginTop: 10, fontSize: 12, fontWeight: "700" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600", paddingVertical: 8 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipLbl: { fontSize: 11, fontWeight: "800" },
  status: { marginTop: 10, fontSize: 11, fontWeight: "600" },
  poolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  poolLbl: { flex: 1, fontSize: 13, fontWeight: "700" },
  poolCnt: { fontSize: 12, fontWeight: "700" },
  poolPct: { fontSize: 11, fontWeight: "900", minWidth: 36, textAlign: "right" },
  empty: { textAlign: "center", marginVertical: 20, fontSize: 13, fontWeight: "600" },
});

/**
 * Alerts tab — compact feed: search, wrap filters, scannable rows.
 */

import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SignalApi } from "../../api/types";
import type { PkAlertCategoryFilter } from "../../api/pkMockFeed";
import { Pill, type AlertPriority } from "./AppShell";
import { HomeAlertRow } from "./HomeAlertRow";
import type { IonName } from "../../utils/alertIcons";
import { useAegisUi } from "../../hooks/useAegisUi";

export type AlertCategoryChip = {
  key: PkAlertCategoryFilter;
  label: string;
  count: number;
};

export type AlertsFeedRow = {
  key: string;
  signalId: string;
  iconName: IonName;
  title: string;
  meta: string;
  priority: AlertPriority;
};

export function AlertsFeedLayout({
  rows,
  loading,
  refreshing,
  onRefresh,
  contentPadding,
  criticalCount,
  totalCount,
  filteredCount,
  categoryFilteredCount,
  searchActive,
  searchQuery,
  onSearchQuery,
  categoryFilter,
  onCategoryFilter,
  chips,
  misinfoWarning,
  emptyMessage,
  onOpenAlert,
}: {
  rows: AlertsFeedRow[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  contentPadding: {
    paddingHorizontal: number;
    paddingTop: number;
    paddingBottom: number;
  };
  criticalCount: number;
  totalCount: number;
  filteredCount: number;
  categoryFilteredCount: number;
  searchActive: boolean;
  searchQuery: string;
  onSearchQuery: (q: string) => void;
  categoryFilter: PkAlertCategoryFilter;
  onCategoryFilter: (key: PkAlertCategoryFilter) => void;
  chips: AlertCategoryChip[];
  misinfoWarning: boolean;
  emptyMessage: string | null;
  onOpenAlert: (signalId: string) => void;
}) {
  const { tc, r, contentWrap } = useAegisUi();
  const night = useColorScheme() === "dark";

  const statusLine = loading
    ? "Loading…"
    : searchActive
      ? `${filteredCount} match${filteredCount === 1 ? "" : "es"}`
      : `${filteredCount} alert${filteredCount === 1 ? "" : "s"}`;

  const header = (
    <View style={styles.headerBlock}>
      {misinfoWarning ? (
        <Pressable
          style={[
            styles.warnBar,
            {
              backgroundColor: night ? tc.warnSurface : "#fff7ed",
              borderColor: night ? tc.amber : "#fdba74",
            },
          ]}
        >
          <Ionicons name="warning-outline" size={16} color={tc.amberDeep} />
          <Text style={[styles.warnTxt, { color: tc.ink }]} numberOfLines={2}>
            Suspicious signal — verify before escalating
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.titleRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: tc.tealDeep }]}>ALERTS</Text>
          <Text style={[styles.title, { color: tc.ink, fontSize: r.titleSize(22) }]}>
            Field feed
          </Text>
        </View>
        <Pill tone={criticalCount > 0 ? "alert" : "mint"}>
          {loading ? "…" : `${criticalCount} critical`}
        </Pill>
      </View>

      <View style={[styles.search, { backgroundColor: tc.card, borderColor: tc.borderSoft }]}>
        <Ionicons name="search-outline" size={18} color={tc.inkMuted} />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQuery}
          placeholder="Search city or keyword…"
          placeholderTextColor={tc.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: tc.ink }]}
        />
        {searchActive ? (
          <Pressable onPress={() => onSearchQuery("")} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={tc.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.chipGrid, { gap: r.gap }]}>
        {chips.map((c) => {
          const on = categoryFilter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => onCategoryFilter(c.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? tc.tealSoft : tc.card,
                  borderColor: on ? tc.tealDeep : tc.borderSoft,
                },
              ]}
            >
              <Text style={[styles.chipLbl, { color: on ? tc.tealDeep : tc.ink }]} numberOfLines={1}>
                {c.label}
              </Text>
              <Text style={[styles.chipCnt, { color: on ? tc.tealDeep : tc.inkMuted }]}>{c.count}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.status, { color: tc.inkMuted }]} numberOfLines={1}>
        {statusLine}
        {!loading && totalCount > 0 ? ` · ${totalCount} total` : ""}
        {!loading && searchActive && categoryFilteredCount !== filteredCount
          ? ` · ${categoryFilteredCount} in filter`
          : ""}
      </Text>
    </View>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: tc.canvas }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[contentWrap, contentPadding, styles.list]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.primary} />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <HomeAlertRow
              iconName={item.iconName}
              title={item.title}
              timeLabel={item.meta}
              priority={item.priority}
              onPress={() => onOpenAlert(item.signalId)}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading && emptyMessage ? (
            <EmptyState message={emptyMessage} />
          ) : null
        }
      />
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  const { tc } = useAegisUi();
  return (
    <View style={styles.empty}>
      <Ionicons name="notifications-off-outline" size={32} color={tc.inkMuted} />
      <Text style={[styles.emptyTxt, { color: tc.inkMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { paddingBottom: 8 },
  headerBlock: { marginBottom: 4 },
  warnBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 2, fontWeight: "800" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600", paddingVertical: 8 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    flexGrow: 1,
    flexBasis: "30%",
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  chipLbl: { fontSize: 12, fontWeight: "800", flexShrink: 1 },
  chipCnt: { fontSize: 11, fontWeight: "800" },
  status: { marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: "600" },
  rowWrap: { marginTop: -2 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12, paddingHorizontal: 20 },
  emptyTxt: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 19 },
});

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { listSignals } from "../api/client";
import {
  pkMockCategoryFromSignal,
  signalMatchesPkCategoryFilter,
  signalMatchesSearchQuery,
  type PkAlertCategoryFilter,
} from "../api/pkMockFeed";
import type { SignalApi } from "../api/types";
import {
  AlertPreviewRow,
  PageHeader,
  Pill,
  type AlertPriority,
} from "../components/aegis/AppShell";
import { useRootStackNavigation } from "../navigation/useRootStackNavigation";
import { useAegisUi } from "../hooks/useAegisUi";
import { signalListKey } from "../utils/signalListKey";
import { alertIconForSignal } from "../utils/alertIcons";
import { formatAlertDisplay } from "../utils/formatAlertDisplay";
import { useThemeCiro } from "../theme/useThemeCiro";

function severityToPriority(sev: number): AlertPriority {
  if (sev >= 8) return "HIGH";
  if (sev >= 5) return "MED";
  return "LOW";
}

export function AlertsScreen() {
  const { tc, r, contentWrap } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";
  const styles = useMemo(() => createStyles(tc), [tc]);
  const rootNav = useRootStackNavigation();
  const isFocused = useIsFocused();
  const [data, setData] = useState<SignalApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PkAlertCategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await listSignals();
      const sorted = [...res].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );
      setData(sorted);
    } catch (e) {
      console.warn(e);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const categoryCounts = useMemo(() => {
    const counts = { all: data.length, accidents: 0, earthquakes: 0, floods: 0, disease: 0 };
    for (const s of data) {
      const cat = pkMockCategoryFromSignal(s);
      if (cat === "accidents" || cat === "earthquakes" || cat === "floods" || cat === "disease") {
        counts[cat] += 1;
      }
    }
    return counts;
  }, [data]);

  const categoryFiltered = useMemo(
    () => data.filter((s) => signalMatchesPkCategoryFilter(s, categoryFilter)),
    [data, categoryFilter],
  );

  const filtered = useMemo(
    () => categoryFiltered.filter((s) => signalMatchesSearchQuery(s, searchQuery)),
    [categoryFiltered, searchQuery],
  );

  const searchActive = searchQuery.trim().length > 0;

  const critical = filtered.filter((s) => s.severity_hint >= 8).length;

  const filterChips: { key: PkAlertCategoryFilter; label: string }[] = [
    { key: "all", label: `All ${categoryCounts.all}` },
    { key: "accidents", label: `Accidents ${categoryCounts.accidents}` },
    { key: "earthquakes", label: `Earthquakes ${categoryCounts.earthquakes}` },
    { key: "floods", label: `Floods ${categoryCounts.floods}` },
    { key: "disease", label: `Disease ${categoryCounts.disease}` },
  ];

  const misinfo = data.some((s) => {
    const flags = s.payload?.flags as string[] | undefined;
    return flags?.includes("contradiction") || flags?.includes("suspicious");
  });

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
    <View style={styles.wrap}>
      <FlatList
        data={filtered}
        keyExtractor={(s, i) => signalListKey(s, i)}
        extraData={`${categoryFilter}-${searchQuery}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.list,
          contentWrap,
          {
            paddingHorizontal: r.horizontalPad,
            paddingTop: r.insets.top + 8,
            paddingBottom: r.tabBarClearance,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={tc.primary}
          />
        }
        ListHeaderComponent={
          <>
            {misinfo ? (
              <View
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: schemeDark ? tc.warnSurface : "#fff7ed",
                  borderWidth: 1,
                  borderColor: schemeDark ? tc.amber : "#fdba74",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "800", color: schemeDark ? tc.amberDeep : "#9a3412" }}>
                  ⚠ Suspicious signal linked to F-7 Air Quality — likely misinformation. Verify before any escalation.
                </Text>
              </View>
            ) : null}
            <PageHeader
              eyebrow="Pakistan feed"
              title="Field alerts"
              sub="Search by city, keyword, or source. Use category chips to narrow the feed."
              right={<Pill tone={critical > 0 ? "alert" : "mint"}>{loading ? "…" : `${critical} critical`}</Pill>}
            />
            <View
              style={[
                styles.searchBar,
                { backgroundColor: tc.card, borderColor: tc.border },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={tc.inkMuted} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search alerts (e.g. Karachi, flood, dengue)…"
                placeholderTextColor={tc.inkMuted}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="never"
                returnKeyType="search"
                style={[styles.searchInput, { color: tc.ink }]}
              />
              {searchActive ? (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={10}
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={20} color={tc.inkMuted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {filterChips.map((c) => {
                const on = categoryFilter === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategoryFilter(c.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? tc.tealSoft : tc.card,
                        borderColor: on ? tc.tealDeep : tc.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipTxt, on && { color: tc.tealDeep }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={[styles.filterHint, { color: tc.inkMuted }]}>
              {loading ?
                "Loading…"
              : searchActive ?
                `Showing ${filtered.length} match${filtered.length === 1 ? "" : "es"} · ${categoryFiltered.length} in category · ${data.length} total`
              : `Showing ${filtered.length} of ${data.length} alerts`}
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const display = formatAlertDisplay(item);
          return (
            <AlertPreviewRow
              iconName={alertIconForSignal(item.kind, item.text)}
              title={display.title}
              timeLabel={display.timeLabel}
              priority={severityToPriority(item.severity_hint)}
              onPress={() => rootNav.navigate("AlertAnalysis", { signalId: item.id })}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                {data.length === 0 ?
                  "No alerts in feed. Enable live API in Settings or use demo data."
                : searchActive ?
                  `No results for "${searchQuery.trim()}". Try another keyword or category.`
                : categoryFilter === "all" ?
                  "No alerts match this view."
                : `No ${categoryFilter} alerts right now. Try another category.`}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
    </>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: tc.canvas },
    list: {},
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 12,
      marginBottom: 10,
      minHeight: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      paddingVertical: 10,
    },
    chipRow: { gap: 8, paddingBottom: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipTxt: { fontSize: 11, fontWeight: "800", color: tc.ink },
    filterHint: { fontSize: 11, fontWeight: "600", marginBottom: 10 },
    emptyBox: { paddingVertical: 32 },
    empty: { fontSize: 14, color: tc.inkSoft, textAlign: "center", lineHeight: 21 },
  });
}

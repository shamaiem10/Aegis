import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { listSignals } from "../api/client";
import {
  pkMockCategoryFromSignal,
  signalMatchesPkCategoryFilter,
  signalMatchesSearchQuery,
  type PkAlertCategoryFilter,
} from "../api/pkMockFeed";
import type { SignalApi } from "../api/types";
import { type AlertPriority } from "../components/aegis/AppShell";
import {
  AlertsFeedLayout,
  type AlertCategoryChip,
  type AlertsFeedRow,
} from "../components/aegis/AlertsFeedLayout";
import { useRootStackNavigation } from "../navigation/useRootStackNavigation";
import { useAegisUi } from "../hooks/useAegisUi";
import { signalListKey } from "../utils/signalListKey";
import { alertIconForSignal } from "../utils/alertIcons";
import { formatAlertDisplayCompact } from "../utils/formatAlertDisplay";

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

function severityToPriority(sev: number): AlertPriority {
  if (sev >= 8) return "HIGH";
  if (sev >= 5) return "MED";
  return "LOW";
}

const CHIP_LABELS: Record<PkAlertCategoryFilter, string> = {
  all: "All",
  accidents: "Accidents",
  earthquakes: "Quake",
  floods: "Floods",
  disease: "Disease",
};

export function AlertsScreen() {
  const { r } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";
  const rootNav = useRootStackNavigation();
  const isFocused = useIsFocused();
  const [data, setData] = useState<SignalApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PkAlertCategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { region } = useForegroundRegion();

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

  const chips: AlertCategoryChip[] = useMemo(
    () =>
      (["all", "accidents", "earthquakes", "floods", "disease"] as const).map((key) => ({
        key,
        label: CHIP_LABELS[key],
        count: categoryCounts[key],
      })),
    [categoryCounts],
  );

  const categoryFiltered = useMemo(
    () => data.filter((s) => signalMatchesPkCategoryFilter(s, categoryFilter)),
    [data, categoryFilter],
  );

  const filtered = useMemo(
    () => categoryFiltered.filter((s) => signalMatchesSearchQuery(s, searchQuery)),
    [categoryFiltered, searchQuery],
  );

  const searchActive = searchQuery.trim().length > 0;
  const criticalCount = filtered.filter((s) => s.severity_hint >= 8).length;

  const rows: AlertsFeedRow[] = useMemo(
    () =>
      filtered.map((item, i) => {
        const display = formatAlertDisplayCompact(item);
        let distStr = "";
        if (region) {
          const d = haversineDistance(region.latitude, region.longitude, item.lat, item.lon);
          distStr = d < 10 ? d.toFixed(1) + "km" : Math.round(d) + "km";
        }
        return {
          key: signalListKey(item, i),
          signalId: item.id,
          iconName: alertIconForSignal(item.kind, item.text),
          title: display.title,
          meta: distStr ? `${display.meta} · ${distStr}` : display.meta,
          priority: severityToPriority(item.severity_hint),
        };
      }),
    [filtered, region],
  );

  const misinfo = data.some((s) => {
    const flags = s.payload?.flags as string[] | undefined;
    return flags?.includes("contradiction") || flags?.includes("suspicious");
  });

  const emptyMessage = useMemo(() => {
    if (loading) return null;
    if (data.length === 0) return "No alerts. Check Settings → backend URL or pull to refresh.";
    if (searchActive) return `No results for “${searchQuery.trim()}”.`;
    if (categoryFilter !== "all") return `No ${CHIP_LABELS[categoryFilter].toLowerCase()} alerts.`;
    return "No alerts in this view.";
  }, [loading, data.length, searchActive, searchQuery, categoryFilter]);

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
      <AlertsFeedLayout
        rows={rows}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        contentPadding={{
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: r.tabBarClearance,
        }}
        criticalCount={criticalCount}
        totalCount={data.length}
        filteredCount={filtered.length}
        categoryFilteredCount={categoryFiltered.length}
        searchActive={searchActive}
        searchQuery={searchQuery}
        onSearchQuery={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryFilter={setCategoryFilter}
        chips={chips}
        misinfoWarning={misinfo}
        emptyMessage={emptyMessage}
        onOpenAlert={(signalId) => rootNav.navigate("AlertAnalysis", { signalId })}
      />
    </>
  );
}

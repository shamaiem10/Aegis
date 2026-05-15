import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View, RefreshControl, useColorScheme } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { listSignals } from "../api/client";
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

  const critical = data.filter((s) => s.severity_hint >= 8).length;

  const misinfo = data.some((s) => {
    const flags = s.payload?.flags as string[] | undefined;
    return flags?.includes("contradiction") || flags?.includes("suspicious");
  });

  return (
    <>
      {isFocused ? <StatusBar style={schemeDark ? "light" : "dark"} /> : null}
    <View style={styles.wrap}>
      <FlatList
        data={data}
        keyExtractor={(s, i) => signalListKey(s, i)}
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
              sub="Only geo-located rows inside the Pakistan AOI are shown (client filter). Prioritized by severity and recency."
              right={<Pill tone={critical > 0 ? "alert" : "mint"}>{loading ? "…" : `${critical} critical`}</Pill>}
            />
          </>
        }
        renderItem={({ item }) => (
          <AlertPreviewRow
            iconName={alertIconForSignal(item.kind, item.text)}
            title={item.text}
            timeLabel={`${item.source} · ${new Date(item.recorded_at).toLocaleString()}`}
            priority={severityToPriority(item.severity_hint)}
            onPress={() => rootNav.navigate("AlertAnalysis", { signalId: item.id })}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>No alerts in feed. Enable live API in Settings or use demo data.</Text>
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
    emptyBox: { paddingVertical: 32 },
    empty: { fontSize: 14, color: tc.inkSoft, textAlign: "center", lineHeight: 21 },
  });
}

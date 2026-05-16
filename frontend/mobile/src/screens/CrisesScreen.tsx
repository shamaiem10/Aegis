import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Platform,
  ScrollView,
  useColorScheme,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useCrisisStream } from "../../lib/firestore/hooks";
import type { CrisisDossierApi } from "../api/types";
import type { RootStackParamList } from "../navigation/types";
import { getCrisisTypeConfig, crisisThemeHex } from "../constants/crisisTypes";
import { getAQIColor } from "../utils/aqi";
import { useAegisUi } from "../hooks/useAegisUi";

type Nav = NativeStackNavigationProp<RootStackParamList, "Crises">;

export function CrisesScreen({ navigation }: { navigation: Nav }) {
  const { tc, r, contentWrap } = useAegisUi();
  const schemeDark = useColorScheme() === "dark";
  const { data: unsortedRows, loading, usingFallback: demo } = useCrisisStream();
  const rows = useMemo(() => [...unsortedRows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), [unsortedRows]);
  const err = null;

  const maxAqi = useMemo(() => {
    let m = 0;
    for (const c of rows) {
      const a = typeof c.meta?.aqi === "number" ? (c.meta.aqi as number) : 0;
      if (a > m) m = a;
    }
    return m;
  }, [rows]);

  const activeForBanner = useMemo(
    () =>
      rows.filter((c) => c.status === "active" || c.status === "monitoring" || c.status === "false_alarm"),
    [rows],
  );

  const allCount = activeForBanner.length;

  return (
    <View style={[styles.outer, { backgroundColor: tc.background }]}>
      <View style={[contentWrap, styles.column, { paddingHorizontal: r.horizontalPad, paddingTop: r.insets.top + 10 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <View style={[styles.chip, { borderColor: tc.border, backgroundColor: tc.card }]}>
          <Text style={[styles.chipTxt, { color: tc.ink }]}>All {allCount}</Text>
        </View>
        <View style={[styles.chip, { borderColor: tc.border, backgroundColor: tc.card }]}>
          <Text style={[styles.chipTxt, { color: tc.ink }]}>Air Quality</Text>
        </View>
        <View style={[styles.chip, { borderColor: tc.border, backgroundColor: tc.card }]}>
          <Text style={[styles.chipTxt, { color: tc.ink }]}>Environmental</Text>
        </View>
      </ScrollView>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <Pressable
          onPress={() => navigation.navigate("FalseAlarm")}
          style={[styles.quickLink, { borderColor: tc.border, backgroundColor: tc.card }]}
        >
          <Text style={[styles.quickLinkTxt, { color: tc.tealDeep }]}>False alarm queue</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Predictions")}
          style={[styles.quickLink, { borderColor: tc.border, backgroundColor: tc.card }]}
        >
          <Text style={[styles.quickLinkTxt, { color: tc.tealDeep }]}>Prediction engine</Text>
        </Pressable>
        {rows.some(
          (x) =>
            x.crisis_id === "crisis-f7-003" ||
            (x.meta?.crisis_type as string | undefined) === "Air Quality Emergency",
        ) ? (
          <Pressable
            onPress={() => navigation.navigate("MainTabs", { screen: "Reports" })}
            style={[styles.quickLink, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft }]}
          >
            <Text style={[styles.quickLinkTxt, { color: tc.tealDeep }]}>Issue health advisory</Text>
          </Pressable>
        ) : null}
      </View>

      {maxAqi > 200 ? (
        <Pressable
          onPress={() => {
            const f7 = rows.find((r) => r.crisis_id === "crisis-f7-003");
            if (f7) navigation.navigate("CrisisDetail", { id: f7.crisis_id });
          }}
          style={[
            styles.aqiBanner,
            {
              backgroundColor: schemeDark ? "#3b0764" : "#ede9fe",
              borderColor: getAQIColor(maxAqi, schemeDark),
            },
          ]}
        >
          <Ionicons name="leaf-outline" size={18} color={getAQIColor(maxAqi, schemeDark)} />
          <Text style={[styles.aqiBannerTxt, { color: tc.ink }]}>
            Air quality hazardous — F-7 AQI {maxAqi}. Outdoor activity advisory in effect. Tap to view.
          </Text>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.conflictCard,
          { backgroundColor: tc.warnSurface, borderColor: tc.border },
        ]}
      >
        <Ionicons name="git-merge-outline" size={18} color={tc.amberDeep} />
        <Text style={[styles.conflictTxt, { color: tc.ink }]}>
          Resource conflict: G-10 Flooding, I-8 Heatwave, and F-7 Air Quality are competing for ambulances and medical
          outreach. 1 unit unassigned. Tap to resolve.
        </Text>
      </View>

      <Text style={[styles.h1, { color: tc.ink }]}>Active crises</Text>
      <Text style={[styles.hint, { color: tc.inkSoft }]}>
        {demo ? "Islamabad v2 scenario — environmental + water + dust (bundled)." : "GET /api/v1/crises"}
      </Text>

      {loading && !rows.length ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={tc.primary} />
      ) : err ? (
        <Text style={[styles.err, { color: tc.alertDeep }]}>{err}</Text>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(item) => item.crisis_id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => {}} tintColor={tc.primary} />
        }
        renderItem={({ item }) => {
          const ct = (item.meta?.crisis_type as string) ?? item.classification.category;
          const cfg = getCrisisTypeConfig(ct);
          const border = crisisThemeHex(cfg.color, schemeDark);
          const name = (item.meta?.display_name as string) ?? item.crisis_id;
          const badge =
            item.status === "false_alarm"
              ? "False alarm"
              : item.status === "monitoring"
                ? "Monitoring"
                : String(item.meta?.ui_severity_label ?? `Sev ${item.severity.score}`);
          const aqi = item.meta?.aqi as number | undefined;
          return (
            <Pressable
              style={[
                styles.row,
                {
                  backgroundColor: tc.card,
                  borderColor: tc.border,
                  borderLeftColor: border,
                },
              ]}
              onPress={() => navigation.navigate("CrisisDetail", { id: item.crisis_id })}
            >
              <View style={[styles.badge, { backgroundColor: border }]}>
                <Ionicons name={cfg.icon} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, { color: tc.ink }]} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={[styles.sub, { color: tc.inkSoft }]} numberOfLines={2}>
                  {ct} · {badge}
                  {typeof aqi === "number" ? ` · AQI ${aqi}` : ""}
                </Text>
              </View>
              <Text style={[styles.chev, { color: tc.inkSoft }]}>›</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: tc.inkSoft }]}>
              No dossiers yet. Enable offline demo in Settings or run the pipeline.
            </Text>
          ) : null
        }
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  column: { flex: 1, width: "100%" },
  filterRow: { gap: 8, paddingBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipTxt: { fontSize: 12, fontWeight: "800" },
  aqiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  aqiBannerTxt: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  conflictCard: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  conflictTxt: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  h1: { fontSize: 22, fontWeight: "800" },
  hint: { fontSize: 12, marginBottom: 10 },
  err: { marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  chev: { fontSize: 22, fontWeight: "300" },
  empty: {
    marginTop: 48,
    textAlign: "center",
    paddingHorizontal: 24,
    fontSize: 14,
  },
  quickLink: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickLinkTxt: { fontSize: 12, fontWeight: "900" },
});

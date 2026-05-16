import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { fetchLatestDossier, summarizeBackendError } from "../../api/client";
import type { CrisisDossierApi, SimulatedActionApi } from "../../api/types";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { useThemeCiro } from "../../theme/useThemeCiro";
import { totalResourceCost, totalTimeSavedMin } from "../../utils/simulationUi";

import { Card, PageHeader } from "./AppShell";
import { SimulationActionCard } from "./SimulationActionCard";

export function SimulationDesk() {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const rootNav = useRootStackNavigation();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [dossier, setDossier] = useState<CrisisDossierApi | null>(null);
  const [actions, setActions] = useState<SimulatedActionApi[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const d = await fetchLatestDossier();
      setDossier(d);
      const sim = d.meta?.action_simulation;
      const rows = Array.isArray(sim) ? (sim as SimulatedActionApi[]) : [];
      setActions(rows);
      setSelectedId(rows[0]?.action_id ?? null);
    } catch (e) {
      setDossier(null);
      setActions([]);
      setErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const crisisLabel =
    (dossier?.meta?.display_name as string) ||
    dossier?.classification?.category ||
    "Latest crisis";

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: r.insets.top + 8,
          paddingBottom: r.tabBarClearance,
        },
      ]}
    >
      <PageHeader
        eyebrow="What-if lab"
        title="Response simulation"
        sub="See what happens if you reroute traffic, pre-position EMS, or send public alerts — before spending real resources."
      />

      <View style={[styles.howTo, { backgroundColor: tc.card, borderColor: tc.border }]}>
        <Ionicons name="information-circle-outline" size={20} color={tc.primary} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.howTitle, { color: tc.ink }]}>What you’re looking at</Text>
          <Text style={[styles.howBody, { color: tc.inkSoft }]}>
            After the Operations pipeline runs, AEGIS models each response action: the situation before, what you
            would do, and the expected outcome — including time saved and risks.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={tc.primary} size="large" />
          <Text style={[styles.hint, { color: tc.inkMuted }]}>Loading simulation…</Text>
        </View>
      ) : err ? (
        <Card style={{ borderColor: tc.alertDeep, backgroundColor: tc.warnSurface }}>
          <Text style={[styles.emptyTitle, { color: tc.alertDeep }]}>No simulation data yet</Text>
          <Text style={[styles.hint, { color: tc.ink }]}>{err}</Text>
          <Pressable
            onPress={() => rootNav.navigate("Operations")}
            style={[styles.primaryBtn, { backgroundColor: tc.primaryDark }]}
          >
            <Text style={styles.primaryBtnTxt}>Run Operations pipeline first</Text>
          </Pressable>
        </Card>
      ) : actions.length === 0 ? (
        <Card style={{ borderColor: tc.border, backgroundColor: tc.card }}>
          <Ionicons name="flask-outline" size={40} color={tc.inkMuted} style={{ alignSelf: "center" }} />
          <Text style={[styles.emptyTitle, { color: tc.ink }]}>Nothing to simulate yet</Text>
          <Text style={[styles.hint, { color: tc.inkSoft }]}>
            Run the pipeline on Operations (fast mode is fine). Simulation blocks are saved on the crisis dossier.
          </Text>
          <Pressable
            onPress={() => rootNav.navigate("Operations")}
            style={[styles.primaryBtn, { backgroundColor: tc.primaryDark }]}
          >
            <Text style={styles.primaryBtnTxt}>Go to Operations</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: tc.tealSoft, borderColor: tc.border }]}>
              <Text style={[styles.summaryVal, { color: tc.tealDeep }]}>{actions.length}</Text>
              <Text style={[styles.summaryLbl, { color: tc.ink }]}>Actions modeled</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <Text style={[styles.summaryVal, { color: tc.ink }]}>{totalTimeSavedMin(actions)}</Text>
              <Text style={[styles.summaryLbl, { color: tc.inkMuted }]}>Min. time saved (est.)</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: tc.card, borderColor: tc.border }]}>
              <Text style={[styles.summaryVal, { color: tc.ink }]}>
                {totalResourceCost(actions).toFixed(1)}
              </Text>
              <Text style={[styles.summaryLbl, { color: tc.inkMuted }]}>Resource units</Text>
            </View>
          </View>

          <Text style={[styles.crisisLbl, { color: tc.inkMuted }]} numberOfLines={2}>
            Scenario: {crisisLabel}
            {dossier?.crisis_id ? ` · ${dossier.crisis_id}` : ""}
          </Text>

          <Text style={[styles.section, { color: tc.inkMuted }]}>Tap an action to compare</Text>

          {actions.map((a) => (
            <SimulationActionCard
              key={a.action_id}
              action={a}
              selected={selectedId === a.action_id}
              expanded={expanded && selectedId === a.action_id}
              onPress={() => {
                if (selectedId === a.action_id) {
                  setExpanded((e) => !e);
                } else {
                  setSelectedId(a.action_id);
                  setExpanded(true);
                }
              }}
              onToggleExpand={() => setExpanded((e) => !e)}
            />
          ))}

          <Pressable
            onPress={() =>
              rootNav.navigate("SimulationLive", {
                initialActionId: selectedId ?? undefined,
              })
            }
            style={[styles.primaryBtn, { backgroundColor: tc.accentGreen, marginTop: 8 }]}
          >
            <Text style={styles.primaryBtnTxt}>Open side-by-side comparison</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    howTo: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      marginBottom: 18,
    },
    howTitle: { fontSize: 14, fontWeight: "800" },
    howBody: { marginTop: 6, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    centered: { alignItems: "center", paddingVertical: 40, gap: 12 },
    hint: { fontSize: 14, lineHeight: 21, textAlign: "center", fontWeight: "600" },
    emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "800", textAlign: "center" },
    summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    summaryCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    summaryVal: { fontSize: 22, fontWeight: "900" },
    summaryLbl: { marginTop: 4, fontSize: 10, fontWeight: "700", textAlign: "center" },
    crisisLbl: { fontSize: 12, fontWeight: "600", marginBottom: 14 },
    section: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    primaryBtn: {
      paddingVertical: 15,
      borderRadius: 999,
      alignItems: "center",
      marginTop: 12,
    },
    primaryBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
}

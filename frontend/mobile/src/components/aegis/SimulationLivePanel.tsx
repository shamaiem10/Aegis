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
import type { SimulatedActionApi } from "../../api/types";
import { useAegisUi } from "../../hooks/useAegisUi";
import { useRootStackNavigation } from "../../navigation/useRootStackNavigation";
import { useThemeCiro } from "../../theme/useThemeCiro";
import { actionIcon, formatActionTitle } from "../../utils/simulationUi";

import { Card, PageHeader } from "./AppShell";
import { SimulationActionCard } from "./SimulationActionCard";

type Props = {
  initialActionId?: string;
};

export function SimulationLivePanel({ initialActionId }: Props) {
  const { tc, r, contentWrap } = useAegisUi();
  const styles = useMemo(() => createStyles(tc), [tc]);
  const rootNav = useRootStackNavigation();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [crisisId, setCrisisId] = useState("");
  const [actions, setActions] = useState<SimulatedActionApi[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialActionId ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const d = await fetchLatestDossier();
      setCrisisId(d.crisis_id);
      const sim = d.meta?.action_simulation;
      const rows = Array.isArray(sim) ? (sim as SimulatedActionApi[]) : [];
      setActions(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((a) => a.action_id === prev)) return prev;
        if (initialActionId && rows.some((a) => a.action_id === initialActionId)) {
          return initialActionId;
        }
        return rows[0]?.action_id ?? null;
      });
    } catch (e) {
      setErr(summarizeBackendError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [initialActionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const selected = actions.find((a) => a.action_id === selectedId) ?? null;

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: tc.canvas }]}
      contentContainerStyle={[
        contentWrap,
        {
          paddingHorizontal: r.horizontalPad,
          paddingTop: 12,
          paddingBottom: r.insets.bottom + 24,
        },
      ]}
    >
      <PageHeader
        eyebrow="Compare"
        title="Before vs after"
        sub="Pick one response action. Left is the current situation; right is what we expect if you execute it."
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={tc.primary} />
      ) : err ? (
        <Card>
          <Text style={{ color: tc.alertDeep, fontWeight: "700" }}>{err}</Text>
          <Pressable
            onPress={() => rootNav.navigate("Operations")}
            style={[styles.linkBtn, { borderColor: tc.tealDeep }]}
          >
            <Text style={{ color: tc.tealDeep, fontWeight: "800" }}>Run pipeline on Operations</Text>
          </Pressable>
        </Card>
      ) : !selected ? (
        <Text style={[styles.hint, { color: tc.inkMuted }]}>No actions in dossier.</Text>
      ) : (
        <>
          {crisisId ? (
            <Text style={[styles.subId, { color: tc.inkMuted }]}>Crisis {crisisId}</Text>
          ) : null}

          <View style={[styles.compareRow, r.isCompact && styles.compareColStack]}>
            <View style={[styles.compareCol, { borderColor: "#f97316", backgroundColor: tc.warnSurface }]}>
              <View style={styles.compareHead}>
                <Ionicons name="alert-circle-outline" size={18} color="#c2410c" />
                <Text style={[styles.compareLbl, { color: "#c2410c" }]}>Before</Text>
              </View>
              <Text style={[styles.compareBody, { color: tc.ink }]}>{selected.before_state}</Text>
            </View>
            <View style={styles.arrowCol}>
              <Ionicons
                name={r.isCompact ? "arrow-down" : "arrow-forward"}
                size={22}
                color={tc.tealDeep}
              />
            </View>
            <View style={[styles.compareCol, { borderColor: tc.tealDeep, backgroundColor: tc.tealSoft }]}>
              <View style={styles.compareHead}>
                <Ionicons name="checkmark-circle-outline" size={18} color={tc.tealDeep} />
                <Text style={[styles.compareLbl, { color: tc.tealDeep }]}>After</Text>
              </View>
              <Text style={[styles.compareBody, { color: tc.ink }]}>{selected.expected_after_state}</Text>
            </View>
          </View>

          <Card style={{ marginTop: 16, borderColor: tc.border, backgroundColor: tc.card }}>
            <View style={styles.planHead}>
              <Ionicons name={actionIcon(selected.action_id)} size={24} color={tc.tealDeep} />
              <Text style={[styles.planTitle, { color: tc.ink }]}>
                {formatActionTitle(selected.action_id)}
              </Text>
            </View>
            <Text style={[styles.planLbl, { color: tc.inkMuted }]}>Planned response</Text>
            <Text style={[styles.planBody, { color: tc.ink }]}>{selected.response_action}</Text>
            {selected.congestion_impact ? (
              <>
                <Text style={[styles.planLbl, { color: tc.inkMuted, marginTop: 12 }]}>Traffic</Text>
                <Text style={[styles.planBody, { color: tc.ink }]}>{selected.congestion_impact}</Text>
              </>
            ) : null}
          </Card>

          <Text style={[styles.section, { color: tc.inkMuted, marginTop: 20 }]}>Switch action</Text>
          {actions.map((a) => (
            <Pressable
              key={a.action_id}
              onPress={() => setSelectedId(a.action_id)}
              style={[
                styles.switchRow,
                {
                  borderColor: selectedId === a.action_id ? tc.tealDeep : tc.border,
                  backgroundColor: selectedId === a.action_id ? tc.tealSoft : tc.card,
                },
              ]}
            >
              <Ionicons name={actionIcon(a.action_id)} size={18} color={tc.tealDeep} />
              <Text style={[styles.switchTxt, { color: tc.ink }]} numberOfLines={1}>
                {formatActionTitle(a.action_id)}
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function createStyles(tc: ReturnType<typeof useThemeCiro>) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    hint: { textAlign: "center", marginTop: 20, fontSize: 14 },
    subId: { fontSize: 11, fontWeight: "600", marginBottom: 12 },
    compareRow: { flexDirection: "row", alignItems: "stretch", gap: 6 },
    compareColStack: { flexDirection: "column" },
    compareCol: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 2,
      padding: 12,
      minHeight: 140,
    },
    compareHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    compareLbl: { fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    compareBody: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
    arrowCol: { justifyContent: "center", paddingHorizontal: 2 },
    planHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    planTitle: { fontSize: 17, fontWeight: "800", flex: 1 },
    planLbl: {
      marginTop: 14,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    planBody: { marginTop: 6, fontSize: 14, lineHeight: 21, fontWeight: "600" },
    section: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    switchTxt: { flex: 1, fontSize: 14, fontWeight: "700" },
    linkBtn: {
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
    },
  });
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { enrichAlertWithAgents } from "../api/agents";
import type { AgentArtifactBundle } from "../api/agentTypes";
import { listSignals } from "../api/client";
import type { SignalApi } from "../api/types";
import { ActionFooter } from "../components/aegis/AppShell";
import { AlertAnalysisLayout } from "../components/aegis/AlertAnalysisLayout";
import { useAegisUi } from "../hooks/useAegisUi";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeCiro } from "../theme/useThemeCiro";
import { buildAlertAnalysisViewModel } from "../utils/alertAnalysisViewModel";
import { AgentServiceError } from "../utils/agentErrors";

type Props = NativeStackScreenProps<RootStackParamList, "AlertAnalysis">;

export function AlertAnalysisScreen({ navigation, route }: Props) {
  const { signalId } = route.params ?? {};
  const [signal, setSignal] = useState<SignalApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentArtifacts, setAgentArtifacts] = useState<AgentArtifactBundle | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsErrorHint, setAgentsErrorHint] = useState<string | null>(null);
  const { r, tc } = useAegisUi();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(), []);

  const load = useCallback(async () => {
    if (!signalId) {
      setSignal(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await listSignals();
      setSignal(all.find((s) => s.id === signalId) ?? null);
    } catch {
      setSignal(null);
    } finally {
      setLoading(false);
    }
  }, [signalId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!signal) {
      setAgentArtifacts(null);
      return;
    }
    let cancelled = false;
    setAgentsLoading(true);
    setAgentsError(null);
    setAgentsErrorHint(null);
    void enrichAlertWithAgents(signal)
      .then((bundle) => {
        if (!cancelled) {
          setAgentArtifacts(bundle);
          setAgentsLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setAgentArtifacts(null);
          setAgentsLoading(false);
          if (e instanceof AgentServiceError) {
            setAgentsError(e.message);
            setAgentsErrorHint(e.hint);
          } else {
            setAgentsError((e as Error).message ?? "Agents failed");
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [signal]);

  const vm = signal ? buildAlertAnalysisViewModel(signal) : null;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tc.canvas, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={tc.primary} />
        <Text style={[styles.loadingTxt, { color: tc.inkSoft, fontSize: r.bodySize(15) }]}>
          Loading alert…
        </Text>
      </View>
    );
  }

  if (!vm || !signal) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: tc.canvas,
            paddingTop: insets.top,
            paddingHorizontal: r.horizontalPad,
          },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: tc.ink, fontSize: r.titleSize(20) }]}>
          Alert not found
        </Text>
        <Text style={[styles.emptySub, { color: tc.inkSoft, fontSize: r.bodySize(14) }]}>
          Signal {signalId ?? "—"} is not in the current feed. Go back and pull to refresh on Alerts.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: tc.border, backgroundColor: tc.card }]}
        >
          <Text style={{ fontWeight: "800", color: tc.tealDeep, fontSize: r.bodySize(15) }}>
            Back to alerts
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <AlertAnalysisLayout
      vm={vm}
      signal={signal}
      agentArtifacts={agentArtifacts}
      agentsLoading={agentsLoading}
      agentsError={agentsError}
      agentsErrorHint={agentsErrorHint}
      onOpenCrisis={() => navigation.navigate("CrisisDetail", { id: `pk-${vm.signalId}` })}
      onOpenActionPlan={() =>
        navigation.navigate("ActionPlan", { signalId: vm.signalId, crisisId: `pk-${vm.signalId}` })
      }
      footer={
        <ActionFooter
          secondaryLabel="Back"
          secondaryIconName="arrow-back-outline"
          onSecondary={() => navigation.goBack()}
          primaryLabel="Simulate"
          primaryIconName="flash-outline"
          onPrimary={() => navigation.navigate("SimulationLive")}
        />
      }
    />
  );
}

function createStyles() {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
    },
    loadingTxt: { marginTop: 16, fontWeight: "600", textAlign: "center" },
    emptyTitle: { fontWeight: "900", textAlign: "center" },
    emptySub: { marginTop: 12, textAlign: "center", lineHeight: 22, maxWidth: 320 },
    backBtn: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
  });
}

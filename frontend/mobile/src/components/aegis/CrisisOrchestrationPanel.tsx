import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CrisisDossierApi } from "../../api/types";
import type {
  AntigravityTraceStepApi,
  AuditLogEntryApi,
  SimulatedActionApi,
} from "../../api/metaTypes";
import { useAegisUi } from "../../hooks/useAegisUi";

type Props = {
  dossier: CrisisDossierApi;
};

export function CrisisOrchestrationPanel({ dossier }: Props) {
  const { tc } = useAegisUi();
  const meta = dossier.meta ?? {};
  const traces = (meta.antigravity_trace as AntigravityTraceStepApi[] | undefined) ?? [];
  const sim = (meta.action_simulation as SimulatedActionApi[] | undefined) ?? [];
  const audit = (meta.audit_log as AuditLogEntryApi[] | undefined) ?? [];
  const tradeoffs = meta.resource_tradeoffs;
  const degraded = meta.pipeline_degraded as string[] | undefined;
  const multiTotal = meta.multi_crisis_total as number | undefined;

  const styles = useMemo(() => createStyles(tc), [tc]);

  if (!traces.length && !sim.length && !audit.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Antigravity orchestration</Text>
      {multiTotal != null && multiTotal > 1 ? (
        <Text style={styles.hint}>
          {multiTotal} simultaneous crises ranked — showing dossier for {dossier.crisis_id}.
        </Text>
      ) : null}
      {degraded?.length ? (
        <Text style={styles.warn}>
          Degraded agents (rule fallback): {degraded.join(", ")}
        </Text>
      ) : null}

      {traces.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Agent trace ({traces.length} steps)</Text>
          {traces.slice(0, 8).map((t, i) => (
            <View key={`${t.agent}-${i}`} style={styles.row}>
              <Text style={styles.agent}>
                {t.agent} · {t.phase}
              </Text>
              <Text style={styles.detail}>{t.detail}</Text>
              {t.confidence != null ? (
                <Text style={styles.sub}>Confidence {(t.confidence * 100).toFixed(0)}%</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {tradeoffs != null ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Allocation trade-offs</Text>
          <Text style={styles.detail}>
            {typeof tradeoffs === "string"
              ? tradeoffs
              : JSON.stringify(tradeoffs).slice(0, 280)}
          </Text>
        </View>
      ) : null}

      {sim.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Action simulation</Text>
          {sim.slice(0, 4).map((a) => (
            <View key={a.action_id} style={styles.row}>
              <Text style={styles.agent}>{a.action_id.replace(/_/g, " ")}</Text>
              <Text style={styles.detail}>{a.response_action}</Text>
              {a.response_time_improvement_min != null ? (
                <Text style={styles.sub}>
                  ETA improvement ~{a.response_time_improvement_min} min · cost{" "}
                  {a.resource_cost_units ?? "—"} units
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {audit.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Audit tail</Text>
          {audit.slice(-5).map((a, i) => (
            <Text key={i} style={styles.sub}>
              {a.ts} · {a.event}
              {typeof a.note === "string" ? ` — ${a.note}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(tc: ReturnType<typeof useAegisUi>["tc"]) {
  return StyleSheet.create({
    wrap: { marginTop: 20 },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: tc.inkMuted,
      marginBottom: 8,
    },
    hint: { fontSize: 12, color: tc.inkSoft, marginBottom: 8 },
    warn: { fontSize: 12, color: tc.amberDeep, marginBottom: 10, fontWeight: "700" },
    block: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tc.border,
      backgroundColor: tc.card,
    },
    blockTitle: { fontSize: 13, fontWeight: "800", color: tc.ink, marginBottom: 8 },
    row: { marginBottom: 10 },
    agent: { fontSize: 12, fontWeight: "800", color: tc.tealDeep },
    detail: { fontSize: 13, color: tc.ink, marginTop: 4, fontWeight: "600" },
    sub: { fontSize: 11, color: tc.inkSoft, marginTop: 4 },
  });
}

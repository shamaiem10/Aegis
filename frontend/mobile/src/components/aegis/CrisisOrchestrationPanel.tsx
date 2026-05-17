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

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function CrisisOrchestrationPanel({ dossier }: Props) {
  const { tc, sectionGap } = useAegisUi();
  const meta = dossier.meta ?? {};
  const traces = (meta.antigravity_trace as AntigravityTraceStepApi[] | undefined) ?? [];
  const sim = (meta.action_simulation as SimulatedActionApi[] | undefined) ?? [];
  const audit = (meta.audit_log as AuditLogEntryApi[] | undefined) ?? [];
  const degraded = meta.pipeline_degraded as string[] | undefined;

  const styles = useMemo(() => createStyles(tc), [tc]);

  if (!traces.length && !sim.length && !audit.length) return null;

  return (
    <View style={[styles.wrap, { marginTop: sectionGap }]}>
      <Text style={[styles.eyebrow, { color: tc.inkMuted }]}>ORCHESTRATION</Text>
      {degraded?.length ? (
        <Text style={[styles.warn, { color: tc.amberDeep }]} numberOfLines={1}>
          Fallback: {degraded.length} agent(s)
        </Text>
      ) : null}

      {traces.slice(0, 3).map((t, i) => (
        <View key={`${t.agent}-${i}`} style={[styles.row, { borderColor: tc.borderSoft, backgroundColor: tc.card }]}>
          <Text style={[styles.agent, { color: tc.tealDeep }]} numberOfLines={1}>
            {t.agent?.replace(/Agent$/, "") ?? "Agent"}
          </Text>
          <Text style={[styles.detail, { color: tc.ink }]} numberOfLines={2}>
            {clip(t.detail, 100)}
          </Text>
        </View>
      ))}

      {sim.length > 0 ? (
        <Text style={[styles.hint, { color: tc.inkMuted }]}>
          {sim.length} simulated action{sim.length === 1 ? "" : "s"}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(tc: ReturnType<typeof useAegisUi>["tc"]) {
  return StyleSheet.create({
    wrap: { marginBottom: 8 },
    eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 8 },
    warn: { fontSize: 11, fontWeight: "700", marginBottom: 8 },
    row: { padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
    agent: { fontSize: 11, fontWeight: "900" },
    detail: { marginTop: 4, fontSize: 12, fontWeight: "600", lineHeight: 17 },
    hint: { fontSize: 11, fontWeight: "600", marginTop: 4 },
  });
}

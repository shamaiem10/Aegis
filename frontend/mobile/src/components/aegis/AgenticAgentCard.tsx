/**
 * Agentic AI presentation — distinct agent cards with status, trace, and pipeline connectors.
 */

import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeCiro } from "../../theme/useThemeCiro";
import type { IonName } from "../../utils/alertIcons";
import { Pill } from "./AppShell";

export type AgentRole = "analysis" | "planning";

export type AgentStatus = "idle" | "running" | "done" | "error";

const ROLE_META: Record<
  AgentRole,
  { defaultName: string; subtitle: string; icon: IonName; accent: string; soft: string }
> = {
  analysis: {
    defaultName: "Crisis Analysis Agent",
    subtitle: "Impact · triage · cross-alert effects",
    icon: "analytics-outline",
    accent: "#7c3aed",
    soft: "#ede9fe",
  },
  planning: {
    defaultName: "Action Planning Agent",
    subtitle: "Resources · scenarios · coordinated tasks",
    icon: "git-network-outline",
    accent: "#2563eb",
    soft: "#dbeafe",
  },
};

function statusLabel(status: AgentStatus): string {
  if (status === "running") return "Thinking…";
  if (status === "done") return "Complete";
  if (status === "error") return "Degraded";
  return "Ready";
}

function statusTone(status: AgentStatus): "mint" | "amber" | "sky" | "ink" {
  if (status === "running") return "sky";
  if (status === "done") return "mint";
  if (status === "error") return "amber";
  return "ink";
}

export function AgenticAgentCard({
  role,
  status,
  agentName,
  subtitle,
  step,
  showConnector = true,
  isLast = false,
  liveGroq = true,
  children,
}: {
  role: AgentRole;
  status: AgentStatus;
  agentName?: string;
  subtitle?: string;
  step?: number;
  showConnector?: boolean;
  isLast?: boolean;
  liveGroq?: boolean;
  children: ReactNode;
}) {
  const tc = useThemeCiro();
  const meta = ROLE_META[role];
  const name = agentName ?? meta.defaultName;
  const sub = subtitle ?? meta.subtitle;
  const night = useColorScheme() === "dark";

  return (
    <View style={pipe.row}>
      <View style={pipe.rail}>
        <View
          style={[
            pipe.dot,
            {
              backgroundColor: status === "running" ? meta.accent : night ? tc.card : meta.soft,
              borderColor: meta.accent,
            },
          ]}
        >
          {status === "running" ? (
            <ActivityIndicator size="small" color={meta.accent} />
          ) : (
            <Ionicons name={meta.icon} size={16} color={meta.accent} />
          )}
        </View>
        {showConnector && !isLast ? (
          <View style={[pipe.line, { backgroundColor: meta.accent, opacity: 0.35 }]} />
        ) : null}
      </View>

      <View style={[pipe.card, { backgroundColor: tc.card, borderColor: tc.border, flex: 1 }]}>
        <View style={[pipe.head, { borderBottomColor: tc.borderSoft }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {step != null ? (
              <Text style={[pipe.step, { color: meta.accent }]}>AGENT {step}</Text>
            ) : null}
            <Text style={[pipe.name, { color: tc.ink }]} numberOfLines={2}>
              {name}
            </Text>
            <Text style={[pipe.sub, { color: tc.inkMuted }]} numberOfLines={2}>
              {sub}
            </Text>
          </View>
          <View style={pipe.badges}>
            <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
            {liveGroq && status !== "error" ? <Pill tone="sky">Groq</Pill> : null}
          </View>
        </View>
        <View style={pipe.body}>{children}</View>
      </View>
    </View>
  );
}

/** Compact orchestrator strip when multiple agents run in sequence. */
export function AgenticOrchestratorStrip({
  agents,
  running,
}: {
  agents: { name: string; role: AgentRole }[];
  running?: boolean;
}) {
  const tc = useThemeCiro();
  return (
    <View style={[orch.wrap, { backgroundColor: tc.muted, borderColor: tc.border }]}>
      <Ionicons name="hardware-chip-outline" size={18} color={tc.tealDeep} />
      <View style={{ flex: 1 }}>
        <Text style={[orch.title, { color: tc.ink }]}>Antigravity orchestrator</Text>
        <Text style={[orch.sub, { color: tc.inkMuted }]} numberOfLines={2}>
          {running
            ? `Running ${agents.map((a) => a.name).join(" → ")}…`
            : agents.map((a) => a.name).join(" · ")}
        </Text>
      </View>
      {running ? <ActivityIndicator size="small" color={tc.primary} /> : null}
    </View>
  );
}

const pipe = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 4 },
  rail: { width: 40, alignItems: "center" },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { width: 2, flex: 1, minHeight: 24, marginVertical: 4, borderRadius: 1 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  head: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
  },
  step: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  sub: { marginTop: 3, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  badges: { alignItems: "flex-end", gap: 6 },
  body: { padding: 14 },
});

const orch = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  title: { fontSize: 12, fontWeight: "900" },
  sub: { marginTop: 2, fontSize: 11, fontWeight: "600" },
});

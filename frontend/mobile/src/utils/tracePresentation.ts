import type { AgentPriority } from "../api/agentTypes";
import type { AntigravityTraceRow } from "../../lib/firestore/hooks";
import type { IonName } from "./alertIcons";

export type TraceBadge = {
  label: string;
  tone: "alert" | "amber" | "mint" | "sky";
};

export type TraceDisplay = {
  id: string;
  agentId: string;
  agentLabel: string;
  icon: IonName;
  title: string;
  subtitle: string;
  badges: TraceBadge[];
  timestamp: string;
  timeAgo: string;
  crisisId?: string;
  signalId?: string;
  confidencePct: number | null;
};

const AGENT_META: Record<string, { label: string; icon: IonName }> = {
  AlertQueueAnalysisAgent: { label: "Queue analysis", icon: "list-outline" },
  AlertTriageAgent: { label: "Alert triage", icon: "flag-outline" },
  CrisisAnalysisAgent: { label: "Crisis analysis", icon: "analytics-outline" },
  ActionPlanAgent: { label: "Action plan", icon: "clipboard-outline" },
  ContextualResourcePlanAgent: { label: "Resource plan", icon: "construct-outline" },
  ContextualAlertOrchestrator: { label: "Full pipeline", icon: "flash-outline" },
  CombinedTriageAnalysisAgent: { label: "Triage + analysis", icon: "git-merge-outline" },
  CombinedEnrichmentAgent: { label: "Enrichment", icon: "layers-outline" },
  SeverityIndexAgent: { label: "Severity index", icon: "thermometer-outline" },
  FalseAlarmAgent: { label: "False alarm", icon: "shield-checkmark-outline" },
  StakeholderAlertAgent: { label: "Stakeholder drafts", icon: "megaphone-outline" },
  CrisisSimulationAgent: { label: "Simulation", icon: "pulse-outline" },
  CrisisSimulationAnalysisAgent: { label: "Sim analysis", icon: "stats-chart-outline" },
  ResourceScenarioPlanningAgent: { label: "Scenario plan", icon: "map-outline" },
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function priorityTone(p: string): TraceBadge["tone"] {
  const v = p.toUpperCase();
  if (v === "CRITICAL") return "alert";
  if (v === "HIGH") return "amber";
  if (v === "MEDIUM") return "sky";
  return "mint";
}

export function relativeTimeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export function agentMeta(agentId: string): { label: string; icon: IonName } {
  return (
    AGENT_META[agentId] ?? {
      label: agentId.replace(/Agent$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"),
      icon: "hardware-chip-outline",
    }
  );
}

export function normalizeTraceDisplay(row: AntigravityTraceRow): TraceDisplay {
  const out = row.outputs ?? {};
  const inp = row.inputs ?? {};
  const meta = agentMeta(row.agentId);
  const badges: TraceBadge[] = [];

  const signal = inp.signal as Record<string, unknown> | undefined;
  const triage = out.triage as
    | {
        headline?: string;
        rationale?: string;
        priority?: AgentPriority;
        disposition?: string;
        signalId?: string;
        confidencePct?: number;
      }
    | undefined;
  const analysis = out.analysis as
    | { executiveSummary?: string; keyRisks?: string[]; crisisId?: string; signalId?: string }
    | undefined;
  const contextual = out.contextual as
    | { focusRank?: number; competingAlertsNote?: string; focusSignalId?: string; crisisId?: string }
    | undefined;
  const tasks = out.tasks as { title?: string }[] | undefined;

  let title = "";
  let subtitle = "";

  if (triage?.headline) {
    title = triage.headline;
    subtitle = triage.rationale ?? "";
    if (triage.priority) badges.push({ label: triage.priority, tone: priorityTone(triage.priority) });
    if (triage.disposition) {
      const d =
        triage.disposition === "escalate"
          ? "Escalate"
          : triage.disposition === "monitor"
            ? "Monitor"
            : "Review";
      badges.push({ label: d, tone: triage.disposition === "escalate" ? "alert" : "sky" });
    }
  } else if (analysis?.executiveSummary) {
    title = clip(analysis.executiveSummary, 140);
    subtitle = analysis.keyRisks?.[0] ? clip(analysis.keyRisks[0], 120) : "";
  } else if (contextual?.competingAlertsNote) {
    title = `Focus rank #${contextual.focusRank ?? "—"}`;
    subtitle = clip(contextual.competingAlertsNote, 140);
  } else if (typeof out.summary === "string" && out.summary.trim()) {
    title = clip(out.summary, 140);
    subtitle = pickString(out, ["rationale", "coordinationNotes"]);
  } else if (Array.isArray(tasks) && tasks.length > 0) {
    title = `Plan · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
    subtitle = clip(String(tasks[0]?.title ?? ""), 120);
  } else {
    title = pickString(out, ["headline", "executiveSummary", "message", "countrySummary"]);
  }

  if (!title && typeof signal?.text === "string") {
    title = clip(signal.text, 120);
  }
  if (!title) {
    title = `${meta.label} finished`;
  }

  if (!subtitle) {
    subtitle =
      pickString(out, ["rationale", "detail", "coordinationNotes"]) ||
      pickString(inp, ["incidentSummary", "detail"]) ||
      "";
  }
  subtitle = clip(subtitle, 160);

  if (row.latencyMs && row.latencyMs > 0) {
    badges.push({
      label: row.latencyMs >= 1000 ? `${(row.latencyMs / 1000).toFixed(1)}s` : `${row.latencyMs}ms`,
      tone: "mint",
    });
  }

  if (out.degradedMode === true) {
    badges.push({ label: "Fallback", tone: "amber" });
  }

  const conf =
    triage?.confidencePct ??
    (row.confidence > 0 && row.confidence <= 1 ? Math.round(row.confidence * 100) : null);

  const signalId =
    triage?.signalId ??
    (typeof out.signalId === "string" ? out.signalId : undefined) ??
    analysis?.signalId ??
    contextual?.focusSignalId ??
    (typeof signal?.id === "string" ? signal.id : undefined);

  const crisisId =
    row.crisisId ??
    (typeof out.crisisId === "string" ? out.crisisId : undefined) ??
    analysis?.crisisId ??
    contextual?.crisisId;

  return {
    id: row.id,
    agentId: row.agentId,
    agentLabel: meta.label,
    icon: meta.icon,
    title,
    subtitle,
    badges,
    timestamp: row.timestamp,
    timeAgo: relativeTimeShort(row.timestamp),
    crisisId: crisisId || undefined,
    signalId: signalId || undefined,
    confidencePct: typeof conf === "number" && conf > 0 ? conf : null,
  };
}

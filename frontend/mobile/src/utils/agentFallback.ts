import type {
  ActionPlanResult,
  ActionPlanTask,
  AgentArtifactBundle,
  AgentPriority,
  AlertTriageResult,
  CrisisAnalysisResult,
} from "../api/agentTypes";
import type { SignalApi } from "../api/types";
import { pkMockCategoryFromSignal } from "../api/pkMockFeed";

function priorityFromSeverity(sev: number): AgentPriority {
  if (sev >= 8) return "CRITICAL";
  if (sev >= 6) return "HIGH";
  if (sev >= 4) return "MEDIUM";
  return "LOW";
}

function categoryFromSignal(s: SignalApi): string {
  const cat = pkMockCategoryFromSignal(s);
  if (cat && cat !== "other") return cat;
  const kind = (s.kind || "").toLowerCase();
  if (/flood|hydro/.test(kind)) return "floods";
  if (/quake|seismic/.test(kind)) return "earthquakes";
  if (/health|disease/.test(kind)) return "disease";
  if (/traffic|accident/.test(kind)) return "accidents";
  return "general";
}

export function buildLocalAgentArtifacts(signal: SignalApi): AgentArtifactBundle {
  const sev = Number(signal.severity_hint) || 5;
  const pri = priorityFromSeverity(sev);
  const region = signal.region || "Pakistan";
  const crisisId = `pk-${signal.id}`;
  const cat = categoryFromSignal(signal);

  const triage: AlertTriageResult = {
    signalId: signal.id,
    disposition: sev >= 7 ? "escalate" : sev >= 4 ? "monitor" : "dismiss_candidate",
    priority: pri,
    confidencePct: Math.min(95, 55 + sev * 4),
    headline: signal.text.length > 72 ? `${signal.text.slice(0, 69)}…` : signal.text,
    rationale: `Offline agent fallback — severity ${sev}/10 in ${region}.`,
    recommendedNextSteps: [
      "Confirm with field teams.",
      "Generate coordinated action plan.",
      sev >= 8 ? "Escalate to district EOC within 15 min." : "Re-check feed in 30 min.",
    ],
    assignTo: sev >= 8 ? ["District EOC", "EMS", "Comms"] : ["Monitoring desk"],
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: "AlertTriageAgent",
  };

  const analysis: CrisisAnalysisResult = {
    crisisId,
    signalId: signal.id,
    executiveSummary: `${cat} incident in ${region} at severity ${sev}/10. Coordinate verification, staging, and tiered messaging.`,
    keyRisks: ["Secondary incidents", "Misinformation", sev >= 8 ? "Hospital surge" : "Delayed response"],
    affectedDomains: [cat, "transport", "public safety"],
    coordinationNotes: ["Single EOC commander", "Stagger public advisories"],
    stakeholderAlerts: [
      {
        audience: "District EOC",
        message: `Active ${cat} — severity ${sev}.`,
        urgency: pri,
      },
    ],
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: "CrisisAnalysisAgent",
  };

  const tasks: ActionPlanTask[] = [
    {
      taskId: "verify",
      title: `Verify incident in ${region}`,
      priority: pri,
      etaMinutes: 15,
      etaLabel: "15 min",
      impactScore: 70,
      owner: "District EOC",
      category: "verification",
      rationale: "Confirm before mass alert.",
      iconHint: "radio-outline",
    },
    {
      taskId: "ems",
      title: "Dispatch EMS staging",
      priority: "HIGH",
      etaMinutes: 12,
      etaLabel: "12 min",
      impactScore: 65,
      owner: "Rescue 1122",
      category: "medical",
      rationale: "Earlier triage reduces casualties.",
      iconHint: "medkit-outline",
    },
    {
      taskId: "traffic",
      title: "Traffic cordon + alternates",
      priority: cat === "accidents" ? "CRITICAL" : "HIGH",
      etaMinutes: 10,
      etaLabel: "10 min",
      impactScore: cat === "accidents" ? 78 : 50,
      owner: "NHMP",
      category: "traffic",
      rationale: "Protect responders and public.",
      iconHint: "swap-horizontal-outline",
    },
    {
      taskId: "comms",
      title: "Tiered public advisory",
      priority: "MEDIUM",
      etaMinutes: null,
      etaLabel: "After verify",
      impactScore: 52,
      owner: "NDMA liaison",
      category: "comms",
      rationale: "Avoid panic-driven secondary events.",
      iconHint: "megaphone-outline",
    },
  ];

  const actionPlan: ActionPlanResult = {
    crisisId,
    signalId: signal.id,
    summary: `Offline plan for ${cat} in ${region}.`,
    totalEtaMinutes: 37,
    tasks,
    degradedMode: true,
    generatedAt: new Date().toISOString(),
    agentName: "ActionPlanAgent",
  };

  return {
    signalId: signal.id,
    crisisId,
    triage,
    analysis,
    actionPlan,
    updatedAt: new Date().toISOString(),
    degradedAgents: ["local_fallback"],
  };
}

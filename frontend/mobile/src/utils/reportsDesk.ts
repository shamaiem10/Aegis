import type { CrisisDossierApi, SignalApi } from "../api/types";
import type { PendingAlertRow, StakeholderDraftWrite } from "../../lib/firestore/hooks";
import { audienceLabel } from "../../lib/firestore/hooks";
import { DEMO_ORCHESTRATION_META } from "../data/demoOrchestrationMeta";

function crisisIdForSignal(signalId: string): string {
  return signalId.startsWith("pk-") ? signalId : `pk-${signalId}`;
}

function severityLabel(sev: number): string {
  if (sev >= 8.5) return "Critical";
  if (sev >= 7) return "High";
  if (sev >= 4.5) return "Medium";
  return "Low";
}

/** Offline/template drafts when cloud-run is not reachable from the phone. */
export function buildRuleBasedStakeholderDrafts(signal: SignalApi): StakeholderDraftWrite[] {
  const crisisId = crisisIdForSignal(signal.id);
  const sev = Number(signal.severity_hint) || 5;
  const sevStr = severityLabel(sev);
  const region = signal.region || "Islamabad/Rawalpindi";
  const headline = String(signal.text ?? signal.kind ?? "Incident").slice(0, 120);

  const audiences: {
    audienceType: string;
    title: string;
    body: string;
    urduText?: string;
    order: number;
  }[] = [
    {
      audienceType: "PUBLIC",
      title: `Advisory — ${region}`,
      body: `AEGIS: ${headline} Limit non-essential outdoor activity until official all-clear.`,
      urduText: `${region}: خبردار — سرکاری تصدیق تک احتیاط برتیں۔`,
      order: 1,
    },
    {
      audienceType: "EMERGENCY_SERVICES",
      title: "EMS / Rescue 1122 staging",
      body: `Pre-stage ambulances toward ${region}. ${headline}. Severity ${sevStr}.`,
      order: 2,
    },
    {
      audienceType: "HOSPITALS",
      title: "Hospital surge readiness",
      body: `PIMS / district hospitals: prepare for presentations linked to ${headline}.`,
      order: 3,
    },
    {
      audienceType: "UTILITY_COMPANIES",
      title: "Utility ops bridge",
      body: `IESCO / WASA: monitor ${region} feeds; await EOC order before curtailment.`,
      order: 4,
    },
    {
      audienceType: "TRANSPORT_AUTHORITY",
      title: "Traffic & corridor control",
      body: `NHMP / CDA: stage alternates near ${region}. ${headline}.`,
      order: 5,
    },
    {
      audienceType: "MEDIA_COMMAND",
      title: "Press cell — verified lines",
      body: `Use official sensor data only. Talking point: ${headline}`,
      order: 6,
    },
  ];

  return audiences.map((a) => ({
    crisisId,
    signalId: signal.id,
    audienceType: a.audienceType,
    title: a.title,
    body: a.body,
    urduText: a.urduText,
    stagingOrderIndex: a.order,
    severity: sevStr,
  }));
}

const AUDIENCE_MAP: Record<string, string> = {
  "Public (Urdu)": "PUBLIC",
  "Public (English)": "PUBLIC",
  "EMS / Rescue 1122": "EMERGENCY_SERVICES",
  "Hospitals (PIMS / polyclinics)": "HOSPITALS",
  "Utilities (IESCO / SNGPL)": "UTILITY_COMPANIES",
  "Transport (CDA / M-2)": "TRANSPORT_AUTHORITY",
  "Media desk": "MEDIA_COMMAND",
};

/** Demo stakeholder messages when API/Firestore empty. */
export function draftsFromDemoMeta(): PendingAlertRow[] {
  const raw = (DEMO_ORCHESTRATION_META.stakeholder_messages ?? []) as {
    audience: string;
    channel?: string;
    title: string;
    body: string;
  }[];
  return raw.map((m, i) => {
    const audienceType = AUDIENCE_MAP[m.audience] ?? "GENERAL";
    const isUrdu = m.audience.toLowerCase().includes("urdu");
    return {
      id: `demo-stakeholder-${i}`,
      crisisId: "demo-f7-aqi",
      title: m.title,
      message: m.body,
      severity: 75,
      status: "preview",
      audienceType,
      channel: m.channel,
      urduText: isUrdu ? m.body : undefined,
      stagingOrderIndex: i + 1,
      issuedAt: new Date().toISOString(),
    };
  });
}

/** When Firestore has no rows, surface dossier notifications as read-only drafts. */
export function draftsFromDossierNotifications(dossier: CrisisDossierApi): PendingAlertRow[] {
  const list = dossier.notifications ?? [];
  return list.map((n, i) => {
    const audienceType = String(n.channel ?? "GENERAL");
    return {
      id: `dossier-${dossier.crisis_id}-${i}`,
      crisisId: dossier.crisis_id,
      title: n.title || audienceLabel(audienceType),
      message: n.body || "",
      severity: Math.round((dossier.severity?.score ?? 5) * 10),
      status: "preview",
      audienceType,
      channel: n.channel,
    };
  });
}

export function formatReportTime(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export interface OutcomeSummary {
  actionCount: number;
  totalEtaMin: number;
  topInsight: string;
  crisisLabel: string;
}

export function outcomeFromDossier(d: CrisisDossierApi | null): OutcomeSummary | null {
  if (!d) return null;
  const sim = d.meta?.action_simulation;
  const actions = Array.isArray(sim) ? sim : [];
  const totalEta = actions.reduce(
    (sum, a) => sum + (Number((a as { response_time_improvement_min?: number }).response_time_improvement_min) || 0),
    0,
  );
  const first = actions[0] as { expected_after_state?: string } | undefined;
  const label =
    (d.meta?.display_name as string) ||
    `${d.classification?.category ?? "Crisis"} · ${d.crisis_id}`;
  return {
    actionCount: actions.length,
    totalEtaMin: totalEta,
    topInsight:
      first?.expected_after_state ||
      "Run the Operations pipeline to generate simulation blocks and stakeholder drafts.",
    crisisLabel: label,
  };
}

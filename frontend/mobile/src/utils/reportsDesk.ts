import type { CrisisDossierApi } from "../api/types";
import type { PendingAlertRow } from "../../lib/firestore/hooks";
import { audienceLabel } from "../../lib/firestore/hooks";

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

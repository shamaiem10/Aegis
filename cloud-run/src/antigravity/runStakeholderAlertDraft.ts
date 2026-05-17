import { db } from '../firebase-admin';
import { sanitizeForFirestore } from '../utils/sanitizeFirestore';
import { runStakeholderAlertDraftAgent } from './agents/stakeholderAlertAgent';
import type { StakeholderDraftResult } from './agents/stakeholderAlertTypes';
import type { FlatSignalInput } from './agents/types';

async function persistDrafts(result: StakeholderDraftResult): Promise<string[]> {
  const ids: string[] = [];
  for (const draft of result.drafts) {
    const docId = `${draft.crisisId}-${draft.audienceType}`;
    ids.push(docId);
    try {
      await db.collection('alerts').doc(docId).set(
        sanitizeForFirestore({
          ...draft,
          crisisId: draft.crisisId,
          audienceType: draft.audienceType,
          title: draft.title,
          body: draft.body,
          messageText: draft.messageText,
          englishText: draft.englishText ?? draft.body,
          urduText: draft.urduText,
          severity: draft.severity,
          stagingOrderIndex: draft.stagingOrderIndex,
          language: draft.language,
          smsRecipients: draft.smsRecipients ?? [],
          emailRecipients: draft.emailRecipients ?? [],
          status: 'pending_approval',
          generatedAt: result.generatedAt,
          issuedAt: result.generatedAt,
          agentName: result.agentName,
        }),
        { merge: true },
      );
    } catch (e) {
      console.warn(`[stakeholder] persist ${docId} skipped:`, (e as Error).message);
    }
  }
  return ids;
}

export async function draftStakeholderAlertsForSignal(
  signal: FlatSignalInput,
  context?: {
    incidentSummary?: string;
    triagePriority?: string;
    skipIfFalseAlarm?: boolean;
  },
): Promise<{ success: boolean; data: StakeholderDraftResult; error: string | null }> {
  try {
    const data = await runStakeholderAlertDraftAgent({
      focusSignal: signal,
      incidentSummary: context?.incidentSummary,
      triagePriority: context?.triagePriority,
      skipIfFalseAlarm: context?.skipIfFalseAlarm,
    });
    const alertIds = await persistDrafts(data);
    return { success: true, data: { ...data, alertIds }, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, data: null as never, error: message };
  }
}

export async function listPendingStakeholderAlerts(): Promise<{
  success: boolean;
  data: Record<string, unknown>[];
  error: string | null;
}> {
  try {
    const snap = await db.collection('alerts').where('status', '==', 'pending_approval').limit(40).get();
    const rows: Record<string, unknown>[] = [];
    snap.forEach((doc) => {
      rows.push({ id: doc.id, ...doc.data() });
    });
    rows.sort((a, b) => {
      const sa = Number(a.stagingOrderIndex ?? 99);
      const sb = Number(b.stagingOrderIndex ?? 99);
      return sa - sb;
    });
    return { success: true, data: rows, error: null };
  } catch (e) {
    return {
      success: false,
      data: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function rejectStakeholderAlert(alertId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    await db.collection('alerts').doc(alertId).set(
      {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

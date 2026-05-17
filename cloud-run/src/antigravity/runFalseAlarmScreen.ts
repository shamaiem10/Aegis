import { db } from '../firebase-admin';
import { sanitizeForFirestore } from '../utils/sanitizeFirestore';
import { runFalseAlarmScreenAgent } from './agents/falseAlarmAgent';
import type { FalseAlarmScreenResult } from './agents/falseAlarmTypes';
import type { FlatSignalInput } from './agents/types';

const QUEUE_DOC = 'falseAlarmQueue/latest';

export async function loadFalseAlarmQueue(): Promise<FalseAlarmScreenResult | null> {
  try {
    const snap = await db.doc(QUEUE_DOC).get();
    if (!snap.exists) return null;
    return snap.data() as FalseAlarmScreenResult;
  } catch (e) {
    console.warn('[falseAlarm] load skipped:', (e as Error).message);
    return null;
  }
}

async function persistQueue(result: FalseAlarmScreenResult): Promise<void> {
  try {
    await db.doc(QUEUE_DOC).set(sanitizeForFirestore(result), { merge: true });
  } catch (e) {
    console.warn('[falseAlarm] persist skipped:', (e as Error).message);
  }
}

export async function screenSignalsForFalseAlarms(
  signals: FlatSignalInput[],
): Promise<{ success: boolean; data: FalseAlarmScreenResult; error: string | null }> {
  try {
    const slice = signals.filter((s) => s?.id).slice(0, 30);
    const data = await runFalseAlarmScreenAgent(slice);
    await persistQueue(data);
    return { success: true, data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, data: null as never, error: message };
  }
}

export async function resolveFalseAlarmItem(
  signalId: string,
  operatorStatus: 'confirmed_false_alarm' | 'cleared',
): Promise<{ success: boolean; data: FalseAlarmScreenResult | null; error: string | null }> {
  try {
    const current = (await loadFalseAlarmQueue()) ?? {
      checks: [],
      queue: [],
      screenedCount: 0,
      falseAlarmCount: 0,
      verifyCount: 0,
      degradedMode: true,
      degradedAgents: [],
      generatedAt: new Date().toISOString(),
      agentName: 'FalseAlarmAgent',
    };

    const checks = current.checks.map((c) =>
      c.signalId === signalId ? { ...c, operatorStatus } : c,
    );
    const queue = checks.filter(
      (c) =>
        c.operatorStatus === 'pending' &&
        (c.recommendedAction === 'RETRACT' || c.recommendedAction === 'VERIFY_FIRST'),
    );

    const updated: FalseAlarmScreenResult = {
      ...current,
      checks,
      queue,
      generatedAt: new Date().toISOString(),
    };

    if (operatorStatus === 'confirmed_false_alarm') {
      const item = checks.find((c) => c.signalId === signalId);
      const crisisId = item?.crisisId ?? (signalId.startsWith('pk-') ? signalId : `pk-${signalId}`);
      try {
        await db.collection('crises').doc(crisisId).set(
          {
            status: 'false_alarm',
            false_alarm_reason: item?.reason ?? 'Operator confirmed false alarm',
            updated_at: new Date().toISOString(),
          },
          { merge: true },
        );
      } catch (e) {
        console.warn('[falseAlarm] crisis update skipped:', (e as Error).message);
      }
    }

    await persistQueue(updated);
    return { success: true, data: updated, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, data: null, error: message };
  }
}

export async function getFalseAlarmQueue(): Promise<{
  success: boolean;
  data: FalseAlarmScreenResult | null;
  error: string | null;
}> {
  const data = await loadFalseAlarmQueue();
  return { success: true, data, error: null };
}

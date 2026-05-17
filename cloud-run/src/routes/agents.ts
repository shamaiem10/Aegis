import { Router } from 'express';

import {
  enrichCrisisById,
  enrichSignalWithAgents,
  getActionPlanForArtifact,
  loadAgentArtifacts,
} from '../antigravity/runCrisisAgents';
import { enrichAlertWithContextualAgents } from '../antigravity/runContextualAlertEnrich';
import { runSeverityIndexAgent } from '../antigravity/agents/severityIndexAgent';
import { runCrisisSimulationAgent } from '../antigravity/agents/crisisSimulationAgent';
import {
  getFalseAlarmQueue,
  resolveFalseAlarmItem,
  screenSignalsForFalseAlarms,
} from '../antigravity/runFalseAlarmScreen';
import {
  draftStakeholderAlertsForSignal,
  listPendingStakeholderAlerts,
  rejectStakeholderAlert,
} from '../antigravity/runStakeholderAlertDraft';
import type { FlatSignalInput } from '../antigravity/agents/types';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    const { generateGeminiJson } = await import('../antigravity/geminiGenerate');
    await generateGeminiJson({
      instruction: 'Reply JSON only: {"status":"ok"}',
      input: { ping: true },
    });
    res.json({ success: true, data: { gemini: 'ok' }, error: null });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

function asSignal(body: unknown): FlatSignalInput | null {
  if (!body || typeof body !== 'object') return null;
  const s = body as FlatSignalInput;
  if (!s.id || typeof s.id !== 'string') return null;
  return s;
}

/** Groq contextual pass: all alerts + resource inventory → triage, analysis, plan, priority queue. */
router.post('/alerts/:signalId/contextual-enrich', async (req, res) => {
  try {
    const signal =
      asSignal(req.body?.signal) ??
      ({
        id: req.params.signalId,
        ...(req.body ?? {}),
      } as FlatSignalInput);

    if (!signal.id) {
      res.status(400).json({ success: false, data: null, error: 'missing_signal_id' });
      return;
    }

    const allSignals = Array.isArray(req.body?.allSignals)
      ? (req.body.allSignals as FlatSignalInput[]).filter((s) => s?.id)
      : undefined;

    const t0 = Date.now();
    const result = await enrichAlertWithContextualAgents(signal, allSignals, {
      skipCache: req.query.refresh === 'true',
    });
    console.log(
      `[agents] contextual-enrich ${signal.id} alerts=${allSignals?.length ?? 1} ${Date.now() - t0}ms success=${result.success}`,
    );
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/** Full agent pass: triage + dossier analysis + action plan (Firestore cache). */
router.post('/alerts/:signalId/enrich', async (req, res) => {
  try {
    const signal =
      asSignal(req.body?.signal) ??
      ({
        id: req.params.signalId,
        ...(req.body ?? {}),
      } as FlatSignalInput);

    if (!signal.id) {
      res.status(400).json({ success: false, data: null, error: 'missing_signal_id' });
      return;
    }

    const stepsParam = String(req.query.steps ?? 'triage,analysis');
    const steps = stepsParam
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is 'triage' | 'analysis' | 'actionPlan' =>
        s === 'triage' || s === 'analysis' || s === 'actionPlan',
      );

    const t0 = Date.now();
    const result = await enrichSignalWithAgents(signal, {
      skipCache: req.query.refresh === 'true',
      steps: steps.length ? steps : ['triage', 'analysis'],
    });
    console.log(
      `[agents] enrich ${signal.id} steps=${steps.join(',')} ${Date.now() - t0}ms success=${result.success}`,
    );
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/alerts/:signalId/triage', async (req, res) => {
  try {
    const signal =
      asSignal(req.body?.signal) ??
      ({ id: req.params.signalId, ...(req.body ?? {}) } as FlatSignalInput);
    const result = await enrichSignalWithAgents(signal, { steps: ['triage'], skipCache: true });
    res.json({
      success: result.success,
      data: result.data?.triage ?? null,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/crises/:crisisId/enrich', async (req, res) => {
  try {
    const signal = asSignal(req.body?.signal) ?? undefined;
    const result = await enrichCrisisById(req.params.crisisId, signal);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/artifacts/:artifactId', async (req, res) => {
  try {
    const data = await loadAgentArtifacts(req.params.artifactId);
    if (!data) {
      res.status(404).json({ success: false, data: null, error: 'not_found' });
      return;
    }
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/crises/:crisisId/action-plan', async (req, res) => {
  try {
    const crisisId = req.params.crisisId;
    const artifactId = crisisId.startsWith('pk-') ? crisisId.slice(3) : crisisId;
    let result = await getActionPlanForArtifact(artifactId);
    if (!result.data?.actionPlan) {
      const signal = asSignal(req.query);
      if (signal) {
        result = await enrichSignalWithAgents(signal, { steps: ['actionPlan'] });
      }
    }
    res.json({
      success: !!result.data?.actionPlan,
      data: result.data?.actionPlan ?? null,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/crises/:crisisId/action-plan', async (req, res) => {
  try {
    const crisisId = req.params.crisisId;
    const signal =
      asSignal(req.body?.signal) ??
      ({
        id: crisisId.replace(/^pk-/, ''),
        ...(req.body ?? {}),
      } as FlatSignalInput);
    const result = await enrichSignalWithAgents(signal, {
      steps: ['actionPlan'],
      skipCache: req.query.refresh === 'true',
    });
    res.json({
      success: result.success,
      data: result.data?.actionPlan ?? null,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/** AI severity index + recommendations (env + alerts + crises + resources). */
router.post('/severity-index', async (req, res) => {
  try {
    const signals = Array.isArray(req.body?.signals) ? (req.body.signals as FlatSignalInput[]) : [];
    const crises = Array.isArray(req.body?.crises) ? req.body.crises : [];
    const envIndex = (req.body?.envIndex ?? {}) as Record<string, unknown>;
    const selectedCity = String(req.body?.selectedCity ?? 'all');
    const data = await runSeverityIndexAgent({ envIndex, signals, crises, selectedCity });
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/** What-if: change resources → impact on focus alert + other HIGH alerts. */
router.post('/crisis-simulation', async (req, res) => {
  try {
    const adjustments = Array.isArray(req.body?.adjustments) ? req.body.adjustments : [];
    const signals = Array.isArray(req.body?.signals) ? (req.body.signals as FlatSignalInput[]) : [];
    const crises = Array.isArray(req.body?.crises) ? req.body.crises : [];
    const focusSignal =
      asSignal(req.body?.focusSignal) ??
      signals.find((s) => s.id === req.body?.focusSignalId) ??
      signals[0];
    if (!focusSignal?.id) {
      res.status(400).json({ success: false, data: null, error: 'missing_focus_signal' });
      return;
    }
    const data = await runCrisisSimulationAgent({
      focusSignal,
      adjustments,
      signals,
      crises,
    });
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/** Draft stakeholder messages (6 audiences) for one focus alert → Firestore alerts/. */
router.post('/stakeholder-alerts/draft', async (req, res) => {
  try {
    const signal =
      asSignal(req.body?.signal) ??
      asSignal(req.body?.focusSignal) ??
      null;
    if (!signal?.id) {
      res.status(400).json({ success: false, data: null, error: 'missing_signal' });
      return;
    }
    const result = await draftStakeholderAlertsForSignal(signal, {
      incidentSummary: typeof req.body?.incidentSummary === 'string' ? req.body.incidentSummary : undefined,
      triagePriority: typeof req.body?.triagePriority === 'string' ? req.body.triagePriority : undefined,
      skipIfFalseAlarm: req.body?.skipIfFalseAlarm === true,
    });
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/stakeholder-alerts/pending', async (_req, res) => {
  try {
    const result = await listPendingStakeholderAlerts();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/stakeholder-alerts/:alertId/reject', async (req, res) => {
  try {
    const result = await rejectStakeholderAlert(req.params.alertId);
    res.status(result.success ? 200 : 500).json({ success: result.success, data: null, error: result.error });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/** Screen live signals for false alarms before public alert. */
router.post('/false-alarm/screen', async (req, res) => {
  try {
    const signals = Array.isArray(req.body?.signals) ? (req.body.signals as FlatSignalInput[]) : [];
    const result = await screenSignalsForFalseAlarms(signals);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/false-alarm/queue', async (_req, res) => {
  try {
    const result = await getFalseAlarmQueue();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/false-alarm/:signalId/resolve', async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== 'confirmed_false_alarm' && status !== 'cleared') {
      res.status(400).json({ success: false, data: null, error: 'invalid_status' });
      return;
    }
    const result = await resolveFalseAlarmItem(req.params.signalId, status);
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/** Batch enrich recent signals (max 10) for operations desk. */
router.post('/batch/enrich-alerts', async (req, res) => {
  try {
    const signals = Array.isArray(req.body?.signals) ? (req.body.signals as FlatSignalInput[]) : [];
    const slice = signals.filter((s) => s?.id).slice(0, 10);
    const results = [];
    for (const signal of slice) {
      results.push(await enrichSignalWithAgents(signal));
    }
    res.json({ success: true, data: { enriched: results.length, results }, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

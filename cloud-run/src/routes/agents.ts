import { Router } from 'express';

import {
  enrichCrisisById,
  enrichSignalWithAgents,
  getActionPlanForArtifact,
  loadAgentArtifacts,
} from '../antigravity/runCrisisAgents';
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

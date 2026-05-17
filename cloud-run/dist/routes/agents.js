"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const runCrisisAgents_1 = require("../antigravity/runCrisisAgents");
const runContextualAlertEnrich_1 = require("../antigravity/runContextualAlertEnrich");
const severityIndexAgent_1 = require("../antigravity/agents/severityIndexAgent");
const crisisSimulationAgent_1 = require("../antigravity/agents/crisisSimulationAgent");
const runFalseAlarmScreen_1 = require("../antigravity/runFalseAlarmScreen");
const runStakeholderAlertDraft_1 = require("../antigravity/runStakeholderAlertDraft");
const router = (0, express_1.Router)();
router.get('/health', async (_req, res) => {
    try {
        const { generateGeminiJson } = await Promise.resolve().then(() => __importStar(require('../antigravity/geminiGenerate')));
        await generateGeminiJson({
            instruction: 'Reply JSON only: {"status":"ok"}',
            input: { ping: true },
        });
        res.json({ success: true, data: { gemini: 'ok' }, error: null });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
function asSignal(body) {
    if (!body || typeof body !== 'object')
        return null;
    const s = body;
    if (!s.id || typeof s.id !== 'string')
        return null;
    return s;
}
/** Groq contextual pass: all alerts + resource inventory → triage, analysis, plan, priority queue. */
router.post('/alerts/:signalId/contextual-enrich', async (req, res) => {
    try {
        const signal = asSignal(req.body?.signal) ??
            {
                id: req.params.signalId,
                ...(req.body ?? {}),
            };
        if (!signal.id) {
            res.status(400).json({ success: false, data: null, error: 'missing_signal_id' });
            return;
        }
        const allSignals = Array.isArray(req.body?.allSignals)
            ? req.body.allSignals.filter((s) => s?.id)
            : undefined;
        const t0 = Date.now();
        const result = await (0, runContextualAlertEnrich_1.enrichAlertWithContextualAgents)(signal, allSignals, {
            skipCache: req.query.refresh === 'true',
        });
        console.log(`[agents] contextual-enrich ${signal.id} alerts=${allSignals?.length ?? 1} ${Date.now() - t0}ms success=${result.success}`);
        res.status(result.success ? 200 : 500).json(result);
    }
    catch (error) {
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
        const signal = asSignal(req.body?.signal) ??
            {
                id: req.params.signalId,
                ...(req.body ?? {}),
            };
        if (!signal.id) {
            res.status(400).json({ success: false, data: null, error: 'missing_signal_id' });
            return;
        }
        const stepsParam = String(req.query.steps ?? 'triage,analysis');
        const steps = stepsParam
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s === 'triage' || s === 'analysis' || s === 'actionPlan');
        const t0 = Date.now();
        const result = await (0, runCrisisAgents_1.enrichSignalWithAgents)(signal, {
            skipCache: req.query.refresh === 'true',
            steps: steps.length ? steps : ['triage', 'analysis'],
        });
        console.log(`[agents] enrich ${signal.id} steps=${steps.join(',')} ${Date.now() - t0}ms success=${result.success}`);
        res.status(result.success ? 200 : 500).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/alerts/:signalId/triage', async (req, res) => {
    try {
        const signal = asSignal(req.body?.signal) ??
            { id: req.params.signalId, ...(req.body ?? {}) };
        const result = await (0, runCrisisAgents_1.enrichSignalWithAgents)(signal, { steps: ['triage'], skipCache: true });
        res.json({
            success: result.success,
            data: result.data?.triage ?? null,
            error: result.error,
        });
    }
    catch (error) {
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
        const result = await (0, runCrisisAgents_1.enrichCrisisById)(req.params.crisisId, signal);
        res.status(result.success ? 200 : 500).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/artifacts/:artifactId', async (req, res) => {
    try {
        const data = await (0, runCrisisAgents_1.loadAgentArtifacts)(req.params.artifactId);
        if (!data) {
            res.status(404).json({ success: false, data: null, error: 'not_found' });
            return;
        }
        res.json({ success: true, data, error: null });
    }
    catch (error) {
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
        let result = await (0, runCrisisAgents_1.getActionPlanForArtifact)(artifactId);
        if (!result.data?.actionPlan) {
            const signal = asSignal(req.query);
            if (signal) {
                result = await (0, runCrisisAgents_1.enrichSignalWithAgents)(signal, { steps: ['actionPlan'] });
            }
        }
        res.json({
            success: !!result.data?.actionPlan,
            data: result.data?.actionPlan ?? null,
            error: result.error,
        });
    }
    catch (error) {
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
        const signal = asSignal(req.body?.signal) ??
            {
                id: crisisId.replace(/^pk-/, ''),
                ...(req.body ?? {}),
            };
        const result = await (0, runCrisisAgents_1.enrichSignalWithAgents)(signal, {
            steps: ['actionPlan'],
            skipCache: req.query.refresh === 'true',
        });
        res.json({
            success: result.success,
            data: result.data?.actionPlan ?? null,
            error: result.error,
        });
    }
    catch (error) {
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
        const signals = Array.isArray(req.body?.signals) ? req.body.signals : [];
        const crises = Array.isArray(req.body?.crises) ? req.body.crises : [];
        const envIndex = (req.body?.envIndex ?? {});
        const selectedCity = String(req.body?.selectedCity ?? 'all');
        const data = await (0, severityIndexAgent_1.runSeverityIndexAgent)({ envIndex, signals, crises, selectedCity });
        res.json({ success: true, data, error: null });
    }
    catch (error) {
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
        const signals = Array.isArray(req.body?.signals) ? req.body.signals : [];
        const crises = Array.isArray(req.body?.crises) ? req.body.crises : [];
        const focusSignal = asSignal(req.body?.focusSignal) ??
            signals.find((s) => s.id === req.body?.focusSignalId) ??
            signals[0];
        if (!focusSignal?.id) {
            res.status(400).json({ success: false, data: null, error: 'missing_focus_signal' });
            return;
        }
        const data = await (0, crisisSimulationAgent_1.runCrisisSimulationAgent)({
            focusSignal,
            adjustments,
            signals,
            crises,
        });
        res.json({ success: true, data, error: null });
    }
    catch (error) {
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
        const signal = asSignal(req.body?.signal) ??
            asSignal(req.body?.focusSignal) ??
            null;
        if (!signal?.id) {
            res.status(400).json({ success: false, data: null, error: 'missing_signal' });
            return;
        }
        const result = await (0, runStakeholderAlertDraft_1.draftStakeholderAlertsForSignal)(signal, {
            incidentSummary: typeof req.body?.incidentSummary === 'string' ? req.body.incidentSummary : undefined,
            triagePriority: typeof req.body?.triagePriority === 'string' ? req.body.triagePriority : undefined,
            skipIfFalseAlarm: req.body?.skipIfFalseAlarm === true,
        });
        res.status(result.success ? 200 : 500).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/stakeholder-alerts/pending', async (_req, res) => {
    try {
        const result = await (0, runStakeholderAlertDraft_1.listPendingStakeholderAlerts)();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: [],
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/stakeholder-alerts/:alertId/reject', async (req, res) => {
    try {
        const result = await (0, runStakeholderAlertDraft_1.rejectStakeholderAlert)(req.params.alertId);
        res.status(result.success ? 200 : 500).json({ success: result.success, data: null, error: result.error });
    }
    catch (error) {
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
        const signals = Array.isArray(req.body?.signals) ? req.body.signals : [];
        const result = await (0, runFalseAlarmScreen_1.screenSignalsForFalseAlarms)(signals);
        res.status(result.success ? 200 : 500).json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/false-alarm/queue', async (_req, res) => {
    try {
        const result = await (0, runFalseAlarmScreen_1.getFalseAlarmQueue)();
        res.json(result);
    }
    catch (error) {
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
        const result = await (0, runFalseAlarmScreen_1.resolveFalseAlarmItem)(req.params.signalId, status);
        res.status(result.success ? 200 : 500).json(result);
    }
    catch (error) {
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
        const signals = Array.isArray(req.body?.signals) ? req.body.signals : [];
        const slice = signals.filter((s) => s?.id).slice(0, 10);
        const results = [];
        for (const signal of slice) {
            results.push(await (0, runCrisisAgents_1.enrichSignalWithAgents)(signal));
        }
        res.json({ success: true, data: { enriched: results.length, results }, error: null });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
exports.default = router;

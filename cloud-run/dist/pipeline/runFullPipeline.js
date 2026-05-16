"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pipelineFastModeEnabled = pipelineFastModeEnabled;
exports.runFullPipeline = runFullPipeline;
const orchestrator_1 = require("../antigravity/orchestrator");
const scenarioPack_1 = require("./scenarioPack");
const pipelineCache_1 = require("./pipelineCache");
const safeFirestore_1 = require("../utils/safeFirestore");
const buildDossiers_1 = require("./buildDossiers");
function pipelineFastModeEnabled(requestFast) {
    if (requestFast === true)
        return true;
    if (requestFast === false)
        return false;
    return process.env.PIPELINE_FAST_MODE === "1" || process.env.PIPELINE_FAST_MODE === "true";
}
async function runFullPipeline(options) {
    const start = Date.now();
    const scenarioId = options?.scenarioId?.trim();
    const fast = pipelineFastModeEnabled(options?.fast);
    const supplemental = scenarioId && options?.mergeLiveSignals !== false
        ? (0, scenarioPack_1.getScenarioSupplementalSignals)(scenarioId)
        : [];
    if (!options?.skipCache) {
        const hit = (0, pipelineCache_1.getCachedPipeline)(scenarioId, fast);
        if (hit?.dossiers[0]) {
            return {
                success: true,
                data: hit.dossiers[0],
                error: null,
                meta: {
                    all_dossiers: hit.dossiers,
                    degraded_agents: hit.degraded,
                    duration_sec: 0,
                },
            };
        }
    }
    try {
        const ingestion = await (0, orchestrator_1.runSignalIngestion)({
            supplementalSignals: supplemental,
            scenarioId,
            fastMode: fast,
        });
        if (!ingestion.success || !ingestion.data) {
            return {
                success: false,
                data: {},
                error: "ingestion_failed",
            };
        }
        const payload = ingestion.data;
        const degraded = "degradedAgents" in ingestion && Array.isArray(ingestion.degradedAgents)
            ? ingestion.degradedAgents
            : [];
        const dossiers = (0, buildDossiers_1.buildDossiersFromPipeline)(payload, {
            scenarioId,
            degradedAgents: degraded,
            durationSec: Math.round((Date.now() - start) / 1000),
        });
        const saved = await (0, safeFirestore_1.safeFirestoreWrite)("persistDossiers", () => (0, buildDossiers_1.persistDossiers)(dossiers));
        (0, pipelineCache_1.setCachedPipeline)(scenarioId, fast, dossiers, degraded);
        const primary = dossiers[0];
        if (!primary) {
            return { success: false, data: {}, error: "no_dossiers_built" };
        }
        if (!primary.meta)
            primary.meta = {};
        if (!saved) {
            primary.meta.firestore_skipped = true;
        }
        return {
            success: true,
            data: primary,
            error: null,
            meta: {
                all_dossiers: dossiers,
                degraded_agents: degraded,
                duration_sec: Math.round((Date.now() - start) / 1000),
                fast_mode: fast,
                firestore_saved: saved,
            },
        };
    }
    catch (e) {
        return {
            success: false,
            data: {},
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

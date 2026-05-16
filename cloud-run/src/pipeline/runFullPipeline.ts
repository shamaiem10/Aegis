import { runSignalIngestion } from "../antigravity/orchestrator";
import { getScenarioSupplementalSignals } from "./scenarioPack";
import { getCachedPipeline, setCachedPipeline } from "./pipelineCache";
import { safeFirestoreWrite } from "../utils/safeFirestore";
import {
  buildDossiersFromPipeline,
  persistDossiers,
  type CrisisDossierOut,
  type PipelinePayload,
} from "./buildDossiers";

export function pipelineFastModeEnabled(requestFast?: boolean): boolean {
  if (requestFast === true) return true;
  if (requestFast === false) return false;
  return process.env.PIPELINE_FAST_MODE === "1" || process.env.PIPELINE_FAST_MODE === "true";
}

export interface RunPipelineOptions {
  scenarioId?: string;
  mergeLiveSignals?: boolean;
  /** 2 Gemini calls instead of 5–7 (~30–60s vs 2–3 min) */
  fast?: boolean;
  skipCache?: boolean;
}

export interface PipelineRunResult {
  success: boolean;
  data: CrisisDossierOut;
  error: string | null;
  meta?: {
    all_dossiers: CrisisDossierOut[];
    degraded_agents?: string[];
    duration_sec?: number;
    fast_mode?: boolean;
    firestore_saved?: boolean;
  };
}

export async function runFullPipeline(
  options?: RunPipelineOptions,
): Promise<PipelineRunResult> {
  const start = Date.now();
  const scenarioId = options?.scenarioId?.trim();
  const fast = pipelineFastModeEnabled(options?.fast);
  const supplemental =
    scenarioId && options?.mergeLiveSignals !== false
      ? getScenarioSupplementalSignals(scenarioId)
      : [];

  if (!options?.skipCache) {
    const hit = getCachedPipeline(scenarioId, fast);
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
    const ingestion = await runSignalIngestion({
      supplementalSignals: supplemental,
      scenarioId,
      fastMode: fast,
    });

    if (!ingestion.success || !ingestion.data) {
      return {
        success: false,
        data: {} as CrisisDossierOut,
        error: "ingestion_failed",
      };
    }

    const payload = ingestion.data as PipelinePayload;
    const degraded =
      "degradedAgents" in ingestion && Array.isArray(ingestion.degradedAgents)
        ? ingestion.degradedAgents
        : [];

    const dossiers = buildDossiersFromPipeline(payload, {
      scenarioId,
      degradedAgents: degraded,
      durationSec: Math.round((Date.now() - start) / 1000),
    });

    const saved = await safeFirestoreWrite("persistDossiers", () => persistDossiers(dossiers));

    setCachedPipeline(scenarioId, fast, dossiers, degraded);

    const primary = dossiers[0];
    if (!primary) {
      return { success: false, data: {} as CrisisDossierOut, error: "no_dossiers_built" };
    }

    if (!primary.meta) primary.meta = {};
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
  } catch (e) {
    return {
      success: false,
      data: {} as CrisisDossierOut,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

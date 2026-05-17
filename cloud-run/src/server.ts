import "dotenv/config";

import express from "express";
import cors from "cors";
import { db } from "./firebase-admin";
import { runFullPipeline } from "./pipeline/runFullPipeline";
import tracesRouter from "./routes/traces";
import { scrapePMDAlerts } from "./scrapers/pmd";
import { scrapeNDMAAlerts } from "./scrapers/ndma";
import {
  getMockSignalsForCategoryParam,
  getMockSignalsMergedSorted,
} from "./signals/mockCategorySignals";
import { checkAllAPIHealth } from "./apis/healthCheck";
import { getAirQualityWithFallback } from "./apis/airQuality";
import { getHereTrafficIncidents } from "./apis/traffic";
import { dispatchAlert } from "./alerts/dispatch";
import agentsRouter from "./routes/agents";
import resourcesRouter from "./routes/resources";
import crisesRouter from "./routes/crises";
import downloadRouter from "./routes/download";
import { patchCrisisStatusWithRelease } from "./services/crisisResourceAllocation";
import { materializePkMockCrisisIfMissing } from "./services/crisisMaterialize";
import { resolveFirebaseProjectId } from "./firebase-admin";
import {
  groqModelName,
  hasGeminiCredentials,
  hasGroqCredentials,
  hasOpenRouterCredentials,
  resolveProviderOrder,
} from "./antigravity/llmGenerate";

import "./firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 8080;

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    firebaseProject: resolveFirebaseProjectId(),
    gcloudProjectEnv: process.env.GCLOUD_PROJECT ?? null,
    llm: {
      providers: resolveProviderOrder(),
      primary: process.env.LLM_PRIMARY?.trim() || (hasGroqCredentials() ? "groq" : "gemini"),
      groq: hasGroqCredentials(),
      groqModel: hasGroqCredentials() ? groqModelName() : null,
      gemini: hasGeminiCredentials(),
      openrouter: hasOpenRouterCredentials(),
    },
  });
});

app.post("/api/v1/pipeline/run", async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { fast?: boolean; skip_cache?: boolean };
    const result = await runFullPipeline({
      fast: body.fast,
      skipCache: body.skip_cache === true,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/pipeline/run/scenario", async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as {
      scenario_id?: string;
      merge_live_signals?: boolean;
      fast?: boolean;
      skip_cache?: boolean;
    };
    const result = await runFullPipeline({
      scenarioId: body.scenario_id ?? "g10_flood_heat",
      mergeLiveSignals: body.merge_live_signals !== false,
      fast: body.fast,
      skipCache: body.skip_cache === true,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

function sendPkMockCategoryEnvelope(
  res: express.Response,
  segment: Parameters<typeof getMockSignalsForCategoryParam>[0],
) {
  try {
    const rows = getMockSignalsForCategoryParam(segment);
    if (!rows.length) {
      res.status(404).json({
        success: false,
        data: null,
        error: "unknown_mock_category_expected_accidents_earthquakes_floods_disease",
      });
      return;
    }
    res.json({ success: true, data: rows, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const PK_MOCK_FIXED_SLUGS = ["accidents", "earthquakes", "floods", "disease"] as const;
for (const slug of PK_MOCK_FIXED_SLUGS) {
  app.get(`/api/v1/signals/mock/${slug}`, (_req, res) => sendPkMockCategoryEnvelope(res, slug));
}

app.get("/api/v1/signals/mock/category/:category", (req, res) =>
  sendPkMockCategoryEnvelope(res, req.params.category ?? ""),
);

app.get("/api/v1/signals/live/parsed", (_req, res) => {
  res.json(getMockSignalsMergedSorted());
});

function unwrapDossier(data: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!data) return null;
  if (data.dossier && typeof data.dossier === "object") {
    return data.dossier as Record<string, unknown>;
  }
  if (typeof data.crisis_id === "string" && data.classification) {
    return data as Record<string, unknown>;
  }
  return null;
}

app.get("/api/v1/crises", async (_req, res, next) => {
  try {
    const snap = await db.collection("crises").orderBy("created_at", "desc").limit(50).get();
    const rows = snap.docs
      .map((d) => unwrapDossier(d.data()))
      .filter((r): r is Record<string, unknown> => r != null);
    res.json({ success: true, data: rows, error: null });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/crises/:id", async (req, res, next) => {
  try {
    const crisisId = req.params.id;
    let doc = await db.collection("crises").doc(crisisId).get();
    if (!doc.exists) {
      const materialized = await materializePkMockCrisisIfMissing(crisisId);
      if (!materialized) {
        res.status(404).json({ success: false, data: null, error: "not_found" });
        return;
      }
      res.json({ success: true, data: materialized.dossier, error: null });
      return;
    }
    const dossier = unwrapDossier(doc.data());
    if (!dossier) {
      res.status(404).json({ success: false, data: null, error: "unrecognized_crisis_shape" });
      return;
    }
    res.json({ success: true, data: dossier, error: null });
  } catch (error) {
    next(error);
  }
});

const CRISIS_STATUSES = new Set(["active", "monitoring", "resolved", "false_alarm"]);

app.patch("/api/v1/crises/:id/status", async (req, res, next) => {
  try {
    const status = String((req.body as { status?: string })?.status ?? "").trim();
    if (!CRISIS_STATUSES.has(status)) {
      res.status(400).json({ success: false, data: null, error: "invalid_status" });
      return;
    }
    const updated = await patchCrisisStatusWithRelease(req.params.id, status);
    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "crisis_not_found" || msg === "unrecognized_crisis_shape") {
      res.status(404).json({ success: false, data: null, error: msg });
      return;
    }
    next(error);
  }
});

app.use("/api/v1/crises", crisesRouter);

app.get("/api/v1/pipeline/latest", async (_req, res, next) => {
  try {
    const latest = await db.doc("pipeline/latest").get();
    const primaryId = latest.exists ? (latest.data()?.primaryCrisisId as string) : null;
    if (primaryId) {
      const doc = await db.collection("crises").doc(primaryId).get();
      const dossier = unwrapDossier(doc.data());
      if (dossier) {
        res.json({ success: true, data: dossier, error: null });
        return;
      }
    }
    const snap = await db.collection("crises").orderBy("created_at", "desc").limit(1).get();
    if (snap.empty) {
      res.json({ success: false, data: null, error: "no_dossiers" });
      return;
    }
    const dossier = unwrapDossier(snap.docs[0].data());
    res.json({ success: true, data: dossier, error: null });
  } catch (error) {
    next(error);
  }
});

app.use("/api/v1/traces", tracesRouter);

app.post("/scrape/pmd", async (_req, res, next) => {
  try {
    const alerts = await scrapePMDAlerts();
    await db.doc('apiHealth/pmd-scraper').set({
      status: 'live',
      count: alerts.length,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    next(error);
  }
});

app.post("/scrape/ndma", async (_req, res, next) => {
  try {
    const alerts = await scrapeNDMAAlerts();
    await db.doc('apiHealth/ndma-scraper').set({
      status: 'live',
      count: alerts.length,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    next(error);
  }
});

app.post("/health/check-apis", async (_req, res, next) => {
  try {
    const result = await checkAllAPIHealth();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.get("/api/air-quality", async (req, res, next) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng || !radius) {
      throw new Error("Missing lat, lng, or radius query params");
    }
    const result = await getAirQualityWithFallback({ lat: +lat, lng: +lng }, +radius);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.get("/api/traffic", async (req, res, next) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng || !radius) {
      throw new Error("Missing lat, lng, or radius query params");
    }
    const result = await getHereTrafficIncidents(+lat, +lng, +radius);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.post("/api/alerts/approve", async (req, res, next) => {
  try {
    const { alertId } = req.body;
    if (!alertId) {
      res.status(400).json({ success: false, data: null, error: "missing_alertId" });
      return;
    }
    await db.collection("alerts").doc(alertId).set(
      {
        status: "approved",
        approvedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ success: true, data: { alertId, status: "approved" }, error: null });
  } catch (error) {
    next(error);
  }
});

app.post("/api/alerts/reject", async (req, res, next) => {
  try {
    const { alertId } = req.body;
    if (!alertId) {
      res.status(400).json({ success: false, data: null, error: "missing_alertId" });
      return;
    }
    await db.collection("alerts").doc(alertId).set(
      {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ success: true, data: { alertId, status: "rejected" }, error: null });
  } catch (error) {
    next(error);
  }
});

app.post("/api/alerts/send", async (req, res, next) => {
  try {
    const { alertId } = req.body;
    if (!alertId) {
      throw new Error("Missing alertId in request body");
    }
    const result = await dispatchAlert(alertId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use("/api/v1/agents", agentsRouter);
app.use("/api/v1/resources", resourcesRouter);
app.use("/download", downloadRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { 
  console.error(err); 
  res.status(500).json({ success: false, error: err.message, degradedMode: true }); 
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`aegis-cloud-run listening on 0.0.0.0:${PORT}`);
});

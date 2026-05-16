"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const firebase_admin_1 = require("./firebase-admin");
const runFullPipeline_1 = require("./pipeline/runFullPipeline");
const traces_1 = __importDefault(require("./routes/traces"));
const pmd_1 = require("./scrapers/pmd");
const ndma_1 = require("./scrapers/ndma");
const mockCategorySignals_1 = require("./signals/mockCategorySignals");
const healthCheck_1 = require("./apis/healthCheck");
const airQuality_1 = require("./apis/airQuality");
const traffic_1 = require("./apis/traffic");
const dispatch_1 = require("./alerts/dispatch");
const agents_1 = __importDefault(require("./routes/agents"));
const resources_1 = __importDefault(require("./routes/resources"));
const firebase_admin_2 = require("./firebase-admin");
const llmGenerate_1 = require("./antigravity/llmGenerate");
require("./firebase-admin");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = Number(process.env.PORT) || 8080;
app.get("/health", (_req, res) => {
    res.json({
        success: true,
        status: "ok",
        firebaseProject: (0, firebase_admin_2.resolveFirebaseProjectId)(),
        gcloudProjectEnv: process.env.GCLOUD_PROJECT ?? null,
        llm: {
            providers: (0, llmGenerate_1.resolveProviderOrder)(),
            gemini: (0, llmGenerate_1.hasGeminiCredentials)(),
            openrouter: (0, llmGenerate_1.hasOpenRouterCredentials)(),
        },
    });
});
app.post("/api/v1/pipeline/run", async (req, res, next) => {
    try {
        const body = (req.body ?? {});
        const result = await (0, runFullPipeline_1.runFullPipeline)({
            fast: body.fast,
            skipCache: body.skip_cache === true,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
app.post("/api/v1/pipeline/run/scenario", async (req, res, next) => {
    try {
        const body = (req.body ?? {});
        const result = await (0, runFullPipeline_1.runFullPipeline)({
            scenarioId: body.scenario_id ?? "g10_flood_heat",
            mergeLiveSignals: body.merge_live_signals !== false,
            fast: body.fast,
            skipCache: body.skip_cache === true,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
function sendPkMockCategoryEnvelope(res, segment) {
    try {
        const rows = (0, mockCategorySignals_1.getMockSignalsForCategoryParam)(segment);
        if (!rows.length) {
            res.status(404).json({
                success: false,
                data: null,
                error: "unknown_mock_category_expected_accidents_earthquakes_floods_disease",
            });
            return;
        }
        res.json({ success: true, data: rows, error: null });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
const PK_MOCK_FIXED_SLUGS = ["accidents", "earthquakes", "floods", "disease"];
for (const slug of PK_MOCK_FIXED_SLUGS) {
    app.get(`/api/v1/signals/mock/${slug}`, (_req, res) => sendPkMockCategoryEnvelope(res, slug));
}
app.get("/api/v1/signals/mock/category/:category", (req, res) => sendPkMockCategoryEnvelope(res, req.params.category ?? ""));
app.get("/api/v1/signals/live/parsed", (_req, res) => {
    res.json((0, mockCategorySignals_1.getMockSignalsMergedSorted)());
});
function unwrapDossier(data) {
    if (!data)
        return null;
    if (data.dossier && typeof data.dossier === "object") {
        return data.dossier;
    }
    if (typeof data.crisis_id === "string" && data.classification) {
        return data;
    }
    return null;
}
app.get("/api/v1/crises", async (_req, res, next) => {
    try {
        const snap = await firebase_admin_1.db.collection("crises").orderBy("created_at", "desc").limit(50).get();
        const rows = snap.docs
            .map((d) => unwrapDossier(d.data()))
            .filter((r) => r != null);
        res.json({ success: true, data: rows, error: null });
    }
    catch (error) {
        next(error);
    }
});
app.get("/api/v1/crises/:id", async (req, res, next) => {
    try {
        const doc = await firebase_admin_1.db.collection("crises").doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ success: false, data: null, error: "not_found" });
            return;
        }
        const dossier = unwrapDossier(doc.data());
        if (!dossier) {
            res.status(404).json({ success: false, data: null, error: "unrecognized_crisis_shape" });
            return;
        }
        res.json({ success: true, data: dossier, error: null });
    }
    catch (error) {
        next(error);
    }
});
app.get("/api/v1/pipeline/latest", async (_req, res, next) => {
    try {
        const latest = await firebase_admin_1.db.doc("pipeline/latest").get();
        const primaryId = latest.exists ? latest.data()?.primaryCrisisId : null;
        if (primaryId) {
            const doc = await firebase_admin_1.db.collection("crises").doc(primaryId).get();
            const dossier = unwrapDossier(doc.data());
            if (dossier) {
                res.json({ success: true, data: dossier, error: null });
                return;
            }
        }
        const snap = await firebase_admin_1.db.collection("crises").orderBy("created_at", "desc").limit(1).get();
        if (snap.empty) {
            res.json({ success: false, data: null, error: "no_dossiers" });
            return;
        }
        const dossier = unwrapDossier(snap.docs[0].data());
        res.json({ success: true, data: dossier, error: null });
    }
    catch (error) {
        next(error);
    }
});
app.use("/api/v1/traces", traces_1.default);
app.post("/scrape/pmd", async (_req, res, next) => {
    try {
        const alerts = await (0, pmd_1.scrapePMDAlerts)();
        await firebase_admin_1.db.doc('apiHealth/pmd-scraper').set({
            status: 'live',
            count: alerts.length,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.json({ success: true, count: alerts.length, data: alerts });
    }
    catch (error) {
        next(error);
    }
});
app.post("/scrape/ndma", async (_req, res, next) => {
    try {
        const alerts = await (0, ndma_1.scrapeNDMAAlerts)();
        await firebase_admin_1.db.doc('apiHealth/ndma-scraper').set({
            status: 'live',
            count: alerts.length,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        res.json({ success: true, count: alerts.length, data: alerts });
    }
    catch (error) {
        next(error);
    }
});
app.post("/health/check-apis", async (_req, res, next) => {
    try {
        const result = await (0, healthCheck_1.checkAllAPIHealth)();
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
app.get("/api/air-quality", async (req, res, next) => {
    try {
        const { lat, lng, radius } = req.query;
        if (!lat || !lng || !radius) {
            throw new Error("Missing lat, lng, or radius query params");
        }
        const result = await (0, airQuality_1.getAirQualityWithFallback)({ lat: +lat, lng: +lng }, +radius);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
app.get("/api/traffic", async (req, res, next) => {
    try {
        const { lat, lng, radius } = req.query;
        if (!lat || !lng || !radius) {
            throw new Error("Missing lat, lng, or radius query params");
        }
        const result = await (0, traffic_1.getHereTrafficIncidents)(+lat, +lng, +radius);
        res.json({ success: true, data: result });
    }
    catch (error) {
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
        await firebase_admin_1.db.collection("alerts").doc(alertId).set({
            status: "approved",
            approvedAt: new Date().toISOString(),
        }, { merge: true });
        res.json({ success: true, data: { alertId, status: "approved" }, error: null });
    }
    catch (error) {
        next(error);
    }
});
app.post("/api/alerts/send", async (req, res, next) => {
    try {
        const { alertId } = req.body;
        if (!alertId) {
            throw new Error("Missing alertId in request body");
        }
        const result = await (0, dispatch_1.dispatchAlert)(alertId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
app.use("/api/v1/agents", agents_1.default);
app.use("/api/v1/resources", resources_1.default);
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ success: false, error: err.message, degradedMode: true });
});
app.listen(PORT, "0.0.0.0", () => {
    console.log(`aegis-cloud-run listening on 0.0.0.0:${PORT}`);
});

import "dotenv/config";
import "./firebase-admin";

import express from "express";
import cors from "cors";
import { db } from "./firebase-admin";
import { runSignalIngestion } from "./antigravity/orchestrator";
import { scrapePMDAlerts } from "./scrapers/pmd";
import { scrapeNDMAAlerts } from "./scrapers/ndma";
import { checkAllAPIHealth } from "./apis/healthCheck";
import { getAirQualityWithFallback } from "./apis/airQuality";
import { getHereTrafficIncidents } from "./apis/traffic";
import { dispatchAlert } from "./alerts/dispatch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 8080;

app.get("/health", (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.post("/api/v1/pipeline/run", async (_req, res, next) => {
  try {
    const result = await runSignalIngestion();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/pipeline/run/scenario", async (_req, res, next) => {
  try {
    const result = await runSignalIngestion();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/signals/live/parsed", async (_req, res, next) => {
  try {
    const snap = await db.collection("signals").orderBy("recorded_at", "desc").limit(50).get();
    res.json(snap.docs.map(d => d.data()));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/crises", async (_req, res, next) => {
  try {
    const snap = await db.collection("crises").orderBy("created_at", "desc").limit(50).get();
    res.json(snap.docs.map(d => d.data()));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/crises/:id", async (req, res, next) => {
  try {
    const doc = await db.collection("crises").doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Not found" });
    } else {
      res.json(doc.data());
    }
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/pipeline/latest", async (_req, res, next) => {
  try {
    const snap = await db.collection("crises").orderBy("created_at", "desc").limit(1).get();
    if (snap.empty) {
      res.json({});
    } else {
      res.json(snap.docs[0].data());
    }
  } catch (error) {
    next(error);
  }
});

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

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { 
  console.error(err); 
  res.status(500).json({ success: false, error: err.message, degradedMode: true }); 
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`aegis-cloud-run listening on 0.0.0.0:${PORT}`);
});

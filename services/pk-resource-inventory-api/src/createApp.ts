import cors from "cors";
import express, { type Express } from "express";

import { buildInventory } from "./buildInventory";

export function createApp(): Express {
  const app = express();
  app.use(cors());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "pk-resource-inventory-api",
      region: "islamabad_rawalpindi",
    });
  });

  app.get("/api/v1/resources/inventory", async (req, res) => {
    try {
      const enrich = req.query.enrich !== "0" && req.query.enrich !== "false";
      const refresh = req.query.refresh === "1" || req.query.refresh === "true";
      const data = await buildInventory({ enrichOsm: enrich, forceOsmRefresh: refresh });
      res.status(200).json({ success: true, data, error: null });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/v1/resources/inventory/islamabad", async (req, res) => {
    try {
      const refresh = req.query.refresh === "1";
      const data = await buildInventory({ enrichOsm: true, forceOsmRefresh: refresh });
      res.status(200).json({ success: true, data, error: null });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
}

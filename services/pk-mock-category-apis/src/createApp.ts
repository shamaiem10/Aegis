import cors from "cors";
import express, { type Express } from "express";

import {
  type MockCategorySlug,
  getMockSignalsForCategoryParam,
  getMockSignalsMergedSorted,
} from "./signals-data";

function sendCategoryEnvelope(res: express.Response, segment: MockCategorySlug) {
  try {
    const rows = getMockSignalsForCategoryParam(segment);
    res.status(200).json({ success: true, data: rows, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const FIXED_CATEGORY_SLUGS: MockCategorySlug[] = ["accidents", "earthquakes", "floods", "disease"];

function activeCategorySlugs(): MockCategorySlug[] {
  const only = process.env.MOCK_CATEGORY_ONLY?.trim().toLowerCase();
  if (!only) return FIXED_CATEGORY_SLUGS;
  const hit = FIXED_CATEGORY_SLUGS.find((s) => s === only);
  return hit ? [hit] : FIXED_CATEGORY_SLUGS;
}

export function createApp(): Express {
  const app = express();
  app.use(cors());
  const slugs = activeCategorySlugs();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "pk-mock-category-apis",
      categories: slugs,
    });
  });

  for (const slug of slugs) {
    app.get(`/api/v1/signals/mock/${slug}`, (_req, res) => sendCategoryEnvelope(res, slug));
  }

  app.get("/api/v1/signals/mock/category/:category", (req, res) => {
    try {
      const rows = getMockSignalsForCategoryParam(req.params.category ?? "");
      if (!rows.length) {
        res.status(404).json({
          success: false,
          data: null,
          error: "unknown_mock_category_expected_accidents_earthquakes_floods_disease",
        });
        return;
      }
      res.status(200).json({ success: true, data: rows, error: null });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/v1/signals/live/parsed", (_req, res) => {
    if (slugs.length === 1) {
      res.status(200).json(getMockSignalsForCategoryParam(slugs[0]!));
      return;
    }
    res.status(200).json(getMockSignalsMergedSorted());
  });

  return app;
}

import { Router } from "express";

import {
  fetchRemoteResourceInventory,
  syncResourceInventoryToFirestore,
} from "../apis/resourceInventoryClient";

const router = Router();

router.get("/inventory", async (req, res) => {
  try {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const data = await fetchRemoteResourceInventory(refresh);
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/inventory/sync", async (req, res) => {
  try {
    const refresh = req.body?.refresh === true || req.query.refresh === "1";
    const data = await syncResourceInventoryToFirestore(refresh);
    res.json({ success: true, data, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

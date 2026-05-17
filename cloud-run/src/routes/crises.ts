import { Router } from "express";

import {
  applyCrisisResourceAllocations,
  type ResourceAssignment,
} from "../services/crisisResourceAllocation";

const router = Router();

router.post("/:id/allocate", async (req, res, next) => {
  try {
    const assignments = Array.isArray(req.body?.assignments)
      ? (req.body.assignments as ResourceAssignment[])
      : [];
    const { dossier } = await applyCrisisResourceAllocations(req.params.id, assignments);
    res.json({ success: true, data: dossier, error: null });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith("insufficient:")) {
      res.status(409).json({ success: false, data: null, error: msg });
      return;
    }
    if (msg === "crisis_not_found" || msg === "unrecognized_crisis_shape") {
      res.status(404).json({ success: false, data: null, error: msg });
      return;
    }
    next(error);
  }
});

export default router;

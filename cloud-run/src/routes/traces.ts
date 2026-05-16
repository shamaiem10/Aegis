import { Router } from "express";
import { db } from "../firebase-admin";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 120);
    const snap = await db.collection("traces").orderBy("timestamp", "desc").limit(limit).get();
    const rows = snap.docs.map((d) => {
      const r = d.data();
      return {
        id: d.id,
        agentId: String(r.agentName ?? r.agent_id ?? "unknown"),
        action: String(r.phase ?? r.agentName ?? "run"),
        inputs: (r.input as Record<string, unknown>) ?? {},
        outputs: (r.output as Record<string, unknown>) ?? {},
        confidence: Number(r.confidence ?? 0.8),
        timestamp: String(r.timestamp ?? new Date().toISOString()),
        crisisId: typeof r.crisisId === "string" ? r.crisisId : undefined,
      };
    });
    res.json({ success: true, data: rows, error: null });
  } catch (error) {
    next(error);
  }
});

export default router;

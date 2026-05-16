"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_admin_1 = require("../firebase-admin");
const router = (0, express_1.Router)();
router.get("/", async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 40, 120);
        const snap = await firebase_admin_1.db.collection("traces").orderBy("timestamp", "desc").limit(limit).get();
        const rows = snap.docs.map((d) => {
            const r = d.data();
            return {
                id: d.id,
                agentId: String(r.agentName ?? r.agent_id ?? "unknown"),
                action: String(r.phase ?? r.agentName ?? "run"),
                inputs: r.input ?? {},
                outputs: r.output ?? {},
                confidence: Number(r.confidence ?? 0.8),
                timestamp: String(r.timestamp ?? new Date().toISOString()),
                crisisId: typeof r.crisisId === "string" ? r.crisisId : undefined,
            };
        });
        res.json({ success: true, data: rows, error: null });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

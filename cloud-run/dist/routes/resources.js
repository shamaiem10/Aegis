"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const resourceInventoryClient_1 = require("../apis/resourceInventoryClient");
const router = (0, express_1.Router)();
router.get("/inventory", async (req, res) => {
    try {
        const refresh = req.query.refresh === "1" || req.query.refresh === "true";
        const data = await (0, resourceInventoryClient_1.fetchRemoteResourceInventory)(refresh);
        res.json({ success: true, data, error: null });
    }
    catch (error) {
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
        const data = await (0, resourceInventoryClient_1.syncResourceInventoryToFirestore)(refresh);
        res.json({ success: true, data, error: null });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
exports.default = router;

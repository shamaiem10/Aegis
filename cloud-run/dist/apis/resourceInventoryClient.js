"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRemoteResourceInventory = fetchRemoteResourceInventory;
exports.syncResourceInventoryToFirestore = syncResourceInventoryToFirestore;
exports.compactUnitsForAgent = compactUnitsForAgent;
const node_fetch_1 = __importDefault(require("node-fetch"));
const safeFirestore_1 = require("../utils/safeFirestore");
const firebase_admin_1 = require("../firebase-admin");
const sanitizeFirestore_1 = require("../utils/sanitizeFirestore");
const FALLBACK_UNITS = [
    {
        resource_id: "isb_rescue_1122_alpha",
        name: "Rescue 1122 — Islamabad",
        kind: "rescue_water",
        agency: "Rescue 1122",
        quantity_available: 12,
        quantity_total: 16,
        lat: 33.6844,
        lon: 73.0479,
        tags: ["all", "flood"],
        source: "fallback",
    },
    {
        resource_id: "isb_ems_central",
        name: "PIMS EMS staging",
        kind: "medical",
        agency: "PIMS",
        quantity_available: 18,
        quantity_total: 22,
        lat: 33.7069,
        lon: 73.0557,
        tags: ["all"],
        source: "fallback",
    },
    {
        resource_id: "isb_traffic_cell",
        name: "ICT Police traffic cell",
        kind: "security",
        agency: "ICT Police",
        quantity_available: 40,
        quantity_total: 48,
        lat: 33.6935,
        lon: 73.0652,
        tags: ["all"],
        source: "fallback",
    },
];
function inventoryBaseUrl() {
    const u = process.env.PK_RESOURCES_INVENTORY_URL?.trim() ||
        process.env.EXPO_PUBLIC_PK_RESOURCES_URL?.trim();
    return u ? u.replace(/\/$/, "") : null;
}
async function fetchRemoteResourceInventory(refresh = false) {
    const base = inventoryBaseUrl();
    if (!base) {
        return {
            region: "fallback",
            updatedAt: new Date().toISOString(),
            units: FALLBACK_UNITS,
            items: [],
        };
    }
    const q = refresh ? "?refresh=1" : "";
    const url = `${base}/api/v1/resources/inventory/islamabad${q}`;
    try {
        const res = await (0, node_fetch_1.default)(url, { signal: AbortSignal.timeout(45000) });
        const body = (await res.json());
        if (!res.ok || !body.success || !body.data?.units?.length) {
            throw new Error(body.error ?? `inventory HTTP ${res.status}`);
        }
        return body.data;
    }
    catch (e) {
        console.warn("[resources] Remote inventory failed, using fallback:", e instanceof Error ? e.message : e);
        return {
            region: "fallback",
            updatedAt: new Date().toISOString(),
            units: FALLBACK_UNITS,
            items: [],
        };
    }
}
/** Load inventory into Firestore for agents + mobile snapshot listener. */
async function syncResourceInventoryToFirestore(refresh = false) {
    const bundle = await fetchRemoteResourceInventory(refresh);
    const payload = (0, sanitizeFirestore_1.sanitizeForFirestore)({
        region: bundle.region,
        units: bundle.units,
        items: bundle.items,
        sources: bundle.sources,
        updatedAt: bundle.updatedAt,
    });
    await (0, safeFirestore_1.safeFirestoreWrite)("resources/inventory", () => firebase_admin_1.db.doc("resources/inventory").set(payload, { merge: true }));
    return bundle;
}
function compactUnitsForAgent(units, limit = 24) {
    return units.slice(0, limit).map((u) => ({
        resource_id: u.resource_id,
        name: String(u.name).slice(0, 80),
        kind: u.kind,
        agency: u.agency,
        quantity_available: u.quantity_available,
        lat: u.lat,
        lon: u.lon,
    }));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedPipeline = getCachedPipeline;
exports.setCachedPipeline = setCachedPipeline;
const TTL_MS = 3 * 60 * 1000;
const store = new Map();
function key(scenarioId, fast) {
    return `${fast ? "fast" : "full"}:${scenarioId ?? "live"}`;
}
function getCachedPipeline(scenarioId, fast) {
    const e = store.get(key(scenarioId, fast));
    if (!e)
        return null;
    if (Date.now() - e.at > TTL_MS) {
        store.delete(key(scenarioId, fast));
        return null;
    }
    return e;
}
function setCachedPipeline(scenarioId, fast, dossiers, degraded) {
    store.set(key(scenarioId, fast), { at: Date.now(), dossiers, degraded });
}

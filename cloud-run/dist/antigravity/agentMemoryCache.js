"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryGet = memoryGet;
exports.memorySet = memorySet;
const mem = new Map();
const TTL_MS = 20 * 60 * 1000;
function memoryGet(artifactId) {
    const row = mem.get(artifactId);
    if (!row)
        return null;
    if (Date.now() - row.at > TTL_MS) {
        mem.delete(artifactId);
        return null;
    }
    return row.bundle;
}
function memorySet(artifactId, bundle) {
    mem.set(artifactId, { bundle, at: Date.now() });
}

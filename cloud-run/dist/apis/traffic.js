"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHereTrafficIncidents = getHereTrafficIncidents;
require("../firebase-admin");
const persist_1 = require("./persist");
const API_HEALTH_ID = "here-maps";
function pick(obj, ...keys) {
    for (const k of keys) {
        if (obj[k] != null)
            return obj[k];
    }
    return undefined;
}
async function getHereTrafficIncidents(lat, lng, radiusM) {
    const empty = [];
    const key = process.env.HERE_API_KEY?.trim();
    const t0 = Date.now();
    if (!key) {
        await (0, persist_1.mergeApiHealthDoc)(API_HEALTH_ID, {
            id: API_HEALTH_ID,
            label: "HERE Traffic",
            status: "degraded",
            lastSuccess: false,
            error: "missing_HERE_API_KEY",
            latencyMs: Date.now() - t0,
        });
        return empty;
    }
    const la = Number.isFinite(lat) ? lat : 33.6844;
    const ln = Number.isFinite(lng) ? lng : 73.0479;
    const r = Math.max(1, radiusM);
    const url = `https://data.traffic.hereapi.com/v7/incidents` +
        `?locationReferencing=shape` +
        `&in=circle:${la},${ln};r=${r}` +
        `&apikey=${encodeURIComponent(key)}`;
    try {
        const res = await (0, persist_1.fetchWithTimeout)(url);
        if (!res.ok) {
            throw new Error(`here ${res.status}`);
        }
        const body = (await res.json());
        const items = Array.isArray(body.results)
            ? body.results
            : Array.isArray(body.incidents)
                ? body.incidents
                : [];
        const incidents = [];
        const now = new Date().toISOString();
        for (const row of items) {
            const id = String(pick(row, "incidentId", "id", "incident_id") ?? "");
            if (!id)
                continue;
            const incident = {
                id,
                source: "here",
                sourceType: "traffic",
                credibility: 91,
                type: pick(row, "type", "incidentType", "_criticality"),
                severity: pick(row, "severity", "criticality", "magnitude"),
                description: pick(row, "description", "message", "summary"),
                location: pick(row, "location", "geometry", "geo", "shape"),
                startTime: pick(row, "startTime", "start_time", "creationTime"),
                timestamp: now,
            };
            incidents.push(incident);
            await (0, persist_1.mergeSignalDoc)(id, {
                kind: "traffic_incident",
                source: "here",
                sourceId: API_HEALTH_ID,
                credibility: 91,
                payload: incident,
                recordedAt: now,
            });
        }
        await (0, persist_1.mergeApiHealthDoc)(API_HEALTH_ID, {
            id: API_HEALTH_ID,
            label: "HERE Traffic",
            status: "live",
            lastSuccess: true,
            error: null,
            latencyMs: Date.now() - t0,
        });
        return incidents;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await (0, persist_1.mergeApiHealthDoc)(API_HEALTH_ID, {
            id: API_HEALTH_ID,
            label: "HERE Traffic",
            status: "degraded",
            lastSuccess: false,
            error: msg,
            latencyMs: Date.now() - t0,
        });
        return empty;
    }
}

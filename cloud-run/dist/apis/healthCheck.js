"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAllAPIHealth = checkAllAPIHealth;
require("../firebase-admin");
const google_auth_library_1 = require("google-auth-library");
const persist_1 = require("./persist");
function projectId() {
    return (process.env.GCP_PROJECT_ID?.trim() ||
        process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
        "aegis-496207");
}
function region() {
    return process.env.GCP_REGION?.trim() || process.env.GOOGLE_CLOUD_REGION?.trim() || "asia-south1";
}
function geminiModel() {
    return process.env.GEMINI_VERTEX_MODEL?.trim() || "gemini-2.0-flash";
}
async function pingOpenMeteo() {
    const t0 = Date.now();
    try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=33.6844&longitude=73.0479&current=temperature_2m";
        const res = await (0, persist_1.fetchWithTimeout)(url);
        const ms = Date.now() - t0;
        if (!res.ok)
            return { ok: false, err: `status ${res.status}`, ms };
        return { ok: true, ms };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
}
async function pingOpenaq() {
    const t0 = Date.now();
    const key = process.env.OPENAQ_API_KEY?.trim();
    try {
        if (!key)
            return { ok: false, err: "no_OPENAQ_API_KEY", ms: Date.now() - t0 };
        const url = "https://api.openaq.org/v3/locations?country=PK&limit=1";
        const res = await (0, persist_1.fetchWithTimeout)(url, { headers: { "X-API-Key": key } });
        const ms = Date.now() - t0;
        if (!res.ok)
            return { ok: false, err: `status ${res.status}`, ms };
        return { ok: true, ms };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
}
async function pingIqair() {
    const t0 = Date.now();
    const key = process.env.IQAIR_API_KEY?.trim();
    try {
        if (!key)
            return { ok: false, err: "no_IQAIR_API_KEY", ms: Date.now() - t0 };
        const url = `https://api.airvisual.com/v2/countries?key=${encodeURIComponent(key)}`;
        const res = await (0, persist_1.fetchWithTimeout)(url);
        const ms = Date.now() - t0;
        if (!res.ok)
            return { ok: false, err: `status ${res.status}`, ms };
        return { ok: true, ms };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
}
async function pingHere() {
    const t0 = Date.now();
    const key = process.env.HERE_API_KEY?.trim();
    try {
        if (!key)
            return { ok: false, err: "no_HERE_API_KEY", ms: Date.now() - t0 };
        const url = "https://data.traffic.hereapi.com/v7/incidents?in=circle:33.68,73.04;r=1000&apikey=" +
            encodeURIComponent(key);
        const res = await (0, persist_1.fetchWithTimeout)(url);
        const ms = Date.now() - t0;
        if (!res.ok)
            return { ok: false, err: `status ${res.status}`, ms };
        return { ok: true, ms };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
}
async function pingTwitter() {
    const t0 = Date.now();
    const token = process.env.TWITTER_BEARER_TOKEN?.trim();
    try {
        if (!token)
            return { ok: false, err: "no_TWITTER_BEARER_TOKEN", ms: Date.now() - t0 };
        const url = "https://api.twitter.com/2/tweets/search/recent?query=" +
            encodeURIComponent("Islamabad") +
            "&max_results=10";
        const res = await (0, persist_1.fetchWithTimeout)(url, { headers: { Authorization: `Bearer ${token}` } });
        const ms = Date.now() - t0;
        if (!res.ok)
            return { ok: false, err: `status ${res.status}`, ms };
        return { ok: true, ms };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
}
async function pingAntigravity() {
    const t0 = Date.now();
    try {
        const auth = new google_auth_library_1.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
        const client = await auth.getClient();
        const at = await client.getAccessToken();
        const token = typeof at === "string" ? at : at?.token;
        if (!token)
            return { ok: false, err: "no_access_token", ms: Date.now() - t0 };
        const proj = projectId();
        const loc = region();
        const model = geminiModel();
        const endpoint = `https://${loc}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${loc}/publishers/google/models/${model}:generateContent`;
        const res = await (0, persist_1.fetchWithTimeout)(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "ping" }] }],
            }),
        });
        const ms = Date.now() - t0;
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            return { ok: false, err: `vertex ${res.status} ${txt.slice(0, 200)}`, ms };
        }
        return { ok: true, ms };
    }
    catch (e) {
        return { ok: false, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
    }
}
async function recordHealth(id, label, r) {
    const entry = {
        id,
        label,
        status: r.ok ? "live" : "degraded",
        latencyMs: r.ms,
        lastSuccess: r.ok,
        error: r.ok ? null : (r.err ?? "error"),
    };
    await (0, persist_1.mergeApiHealthDoc)(id, { ...entry });
    return entry;
}
async function checkAllAPIHealth() {
    const results = {};
    try {
        const [om, oq, iq, here, tw, ag,] = await Promise.all([
            pingOpenMeteo(),
            pingOpenaq(),
            pingIqair(),
            pingHere(),
            pingTwitter(),
            pingAntigravity(),
        ]);
        results["open-meteo"] = await recordHealth("open-meteo", "Open-Meteo", om);
        results.openaq = await recordHealth("openaq", "OpenAQ", oq);
        results.iqair = await recordHealth("iqair", "IQAir", iq);
        results["here-maps"] = await recordHealth("here-maps", "HERE Maps", here);
        results.twitter = await recordHealth("twitter", "Twitter / X", tw);
        results.antigravity = await recordHealth("antigravity", "Vertex AI (Gemini)", ag);
        return results;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const fallback = await recordHealth("health-check", "Parallel health run", {
            ok: false,
            err: msg,
            ms: 0,
        });
        results["health-check"] = fallback;
        return results;
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCrisisSignals = searchCrisisSignals;
exports.getRedditCrisisSignals = getRedditCrisisSignals;
require("../firebase-admin");
const persist_1 = require("./persist");
const CRISIS_QUERY = [
    "(flood OR flooding OR سیلاب OR heatwave OR smog OR آلودگی OR \"dust storm\" OR آندھی OR \"air quality\" OR بارش OR waterlogging OR AQI OR \"water main\")",
    "(Islamabad OR Rawalpindi OR \"G-10\" OR \"I-8\" OR \"F-7\" OR \"G-9\" OR \"E-11\")",
    "-is:retweet",
].join(" ");
function clampCred(n) {
    return Math.min(99, Math.max(5, Math.round(n)));
}
function scoreTweet(text, metrics, hasGeo, verified) {
    let base = 50;
    if (verified)
        base += 25;
    if (hasGeo)
        base += 15;
    const rt = metrics?.retweet_count ?? 0;
    const likes = metrics?.like_count ?? 0;
    if (rt > 100)
        base += 10;
    if (/[A-Z]{5,}|!!!/.test(text))
        base -= 10;
    if (/hiding|fake data|government lies|سازش/i.test(text))
        base -= 25;
    if (rt < 3 && likes < 5)
        base -= 15;
    return clampCred(base);
}
async function searchCrisisSignals() {
    const out = [];
    const token = process.env.TWITTER_BEARER_TOKEN?.trim();
    const t0 = Date.now();
    if (!token) {
        await (0, persist_1.mergeApiHealthDoc)("twitter", {
            id: "twitter",
            label: "Twitter / X",
            status: "degraded",
            lastSuccess: false,
            error: "missing_TWITTER_BEARER_TOKEN",
            latencyMs: Date.now() - t0,
        });
        return out;
    }
    const params = new URLSearchParams({
        query: CRISIS_QUERY,
        max_results: "20",
        "tweet.fields": "created_at,author_id,geo,public_metrics,lang",
        expansions: "geo.place_id,author_id",
        "user.fields": "verified",
    });
    const url = `https://api.twitter.com/2/tweets/search/recent?${params.toString()}`;
    try {
        const res = await (0, persist_1.fetchWithTimeout)(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            throw new Error(`twitter ${res.status}`);
        }
        const body = (await res.json());
        const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u]));
        for (const t of body.data ?? []) {
            if (!t?.id || !t.text)
                continue;
            const u = t.author_id ? users.get(t.author_id) : undefined;
            const verified = Boolean(u?.verified);
            const hasGeo = Boolean(t.geo);
            const cred = scoreTweet(t.text, t.public_metrics, hasGeo, verified);
            const rec = {
                id: t.id,
                source: "twitter",
                credibility: cred,
                text: t.text,
                createdAt: t.created_at,
                lang: t.lang,
                raw: t,
            };
            out.push(rec);
            await (0, persist_1.mergeSignalDoc)(t.id, {
                kind: "social_tweet",
                source: "twitter",
                sourceId: "twitter",
                credibility: cred,
                payload: rec,
                recordedAt: new Date().toISOString(),
            });
        }
        await (0, persist_1.mergeApiHealthDoc)("twitter", {
            id: "twitter",
            label: "Twitter / X",
            status: "live",
            lastSuccess: true,
            error: null,
            latencyMs: Date.now() - t0,
        });
        return out;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await (0, persist_1.mergeApiHealthDoc)("twitter", {
            id: "twitter",
            label: "Twitter / X",
            status: "degraded",
            lastSuccess: false,
            error: msg,
            latencyMs: Date.now() - t0,
        });
        return out;
    }
}
const REDDIT_FILTER = /flood|flooding|water|rain|smog|haze|dust|heat|emergency|crisis|AQI|آلودگی|سیلاب/i;
async function getRedditCrisisSignals() {
    const out = [];
    const subs = ["islamabad", "pakistan", "rawalpindi"];
    const ua = "aegis-cloud-run/1.0 (crisis-signals)";
    const t0 = Date.now();
    try {
        for (const sub of subs) {
            const url = `https://www.reddit.com/r/${sub}/new.json?limit=25`;
            try {
                const res = await (0, persist_1.fetchWithTimeout)(url, { headers: { "User-Agent": ua } });
                if (!res.ok)
                    continue;
                const body = (await res.json());
                for (const child of body.data?.children ?? []) {
                    const d = child.data;
                    if (!d?.id)
                        continue;
                    const text = `${d.title ?? ""} ${d.selftext ?? ""}`.trim();
                    if (!text || !REDDIT_FILTER.test(text))
                        continue;
                    const rec = {
                        id: `reddit-${sub}-${d.id}`,
                        source: "reddit",
                        credibility: 40,
                        text,
                        createdAt: d.created_utc != null ? new Date(d.created_utc * 1000).toISOString() : undefined,
                        raw: d,
                    };
                    out.push(rec);
                    await (0, persist_1.mergeSignalDoc)(rec.id, {
                        kind: "social_reddit",
                        source: "reddit",
                        sourceId: "reddit",
                        credibility: 40,
                        payload: rec,
                        recordedAt: new Date().toISOString(),
                    });
                }
            }
            catch {
                /* sub failed — continue */
            }
        }
        await (0, persist_1.mergeApiHealthDoc)("reddit", {
            id: "reddit",
            label: "Reddit",
            status: out.length ? "live" : "degraded",
            lastSuccess: out.length > 0,
            error: out.length ? null : "no_matching_posts",
            latencyMs: Date.now() - t0,
        });
        return out;
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await (0, persist_1.mergeApiHealthDoc)("reddit", {
            id: "reddit",
            label: "Reddit",
            status: "degraded",
            lastSuccess: false,
            error: msg,
            latencyMs: Date.now() - t0,
        });
        return out;
    }
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyAlertType = classifyAlertType;
exports.extractSeverity = extractSeverity;
exports.extractRegions = extractRegions;
exports.getCachedPMDAlerts = getCachedPMDAlerts;
exports.scrapePMDAlerts = scrapePMDAlerts;
/**
 * Pakistan Meteorological Department scraper — official government alerts.
 */
require("../firebase-admin");
const cheerio = __importStar(require("cheerio"));
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const persist_1 = require("../apis/persist");
const firebase_admin_1 = require("../firebase-admin");
const CACHE_DOC = "pmd";
const CACHE_TTL_MS = 9 * 60 * 1000;
const SOURCE_LABEL = "Pakistan Met Department";
const KEYWORD_RE = /rain|flood|heat|dust|storm|warning|advisory|alert|thunder|hail|fog/i;
const REGION_DEFS = [
    { name: "Islamabad", re: /islamabad/i },
    { name: "Rawalpindi", re: /rawalpindi/i },
    { name: "Punjab", re: /punjab/i },
    { name: "KPK", re: /\b(kpk|khyber\s*pakhtunkhwa|k\.p\.k\.)\b/i },
    { name: "Sindh", re: /sindh/i },
    { name: "Balochistan", re: /balo?chistan/i },
    { name: "Lahore", re: /lahore/i },
    { name: "Peshawar", re: /peshawar/i },
];
const PMD_URLS = [
    "https://www.pmd.gov.pk/en/weather-alerts/",
    "https://www.pmd.gov.pk/en/current-weather/",
];
function scrapeAtMs(scrapedAt) {
    if (!scrapedAt)
        return null;
    if (scrapedAt instanceof admin.firestore.Timestamp)
        return scrapedAt.toMillis();
    if (typeof scrapedAt === "object" && scrapedAt !== null && "toMillis" in scrapedAt) {
        const fn = scrapedAt.toMillis;
        if (typeof fn === "function")
            return fn.call(scrapedAt);
    }
    if (typeof scrapedAt === "string") {
        const t = Date.parse(scrapedAt);
        return Number.isNaN(t) ? null : t;
    }
    return null;
}
function isCacheFresh(scrapedAt, ttlMs) {
    const ms = scrapeAtMs(scrapedAt);
    if (ms == null)
        return false;
    return Date.now() - ms < ttlMs;
}
function classifyAlertType(text) {
    const t = text.toLowerCase();
    if (/\b(dust|sandstorm|haboob|dust\s*storm)\b/i.test(t))
        return "DUST_STORM";
    if (/\b(heat\s*wave|heatwave|extreme\s*heat|scorching)\b/i.test(t))
        return "HEATWAVE";
    if (/\b(flood|flash\s*flood|monsoon|heavy\s*rain|cloudburst|rainfall)\b/i.test(t))
        return "FLOOD_RAIN";
    if (/\b(thunder|lightning|thunderstorm)\b/i.test(t))
        return "THUNDERSTORM";
    if (/\b(fog|mist|low\s*visibility|smog|haze)\b/i.test(t))
        return "LOW_VISIBILITY";
    return "GENERAL";
}
function extractSeverity(text) {
    const t = text.toLowerCase();
    if (/\b(critical|catastrophic|red\s*alert|severe\s*emergency)\b/i.test(t))
        return "Critical";
    if (/\b(high|orange|severe|danger)\b/i.test(t))
        return "High";
    if (/\b(medium|moderate|yellow|amber)\b/i.test(t))
        return "Medium";
    if (/\b(low|minor|green|info)\b/i.test(t))
        return "Low";
    if (/\b(alert|warning|advisory)\b/i.test(t))
        return "Medium";
    return "Low";
}
function extractRegions(text) {
    const found = new Set();
    for (const { name, re } of REGION_DEFS) {
        if (re.test(text))
            found.add(name);
    }
    return [...found];
}
function stableAlertId(title, url, snippet) {
    return (0, crypto_1.createHash)("sha256")
        .update(`${title}|${url}|${snippet.slice(0, 120)}`)
        .digest("hex")
        .slice(0, 16);
}
function normalizeUrl(href, base) {
    if (!href?.trim())
        return base;
    try {
        return new URL(href, base).href;
    }
    catch {
        return base;
    }
}
function passesFilters(text) {
    const t = text.trim();
    if (t.length < 12)
        return false;
    if (!KEYWORD_RE.test(t))
        return false;
    const regs = extractRegions(t);
    return regs.length > 0;
}
function parsePage(html, pageUrl, seen) {
    const out = [];
    const $ = cheerio.load(html);
    const sel = "article, .alert-item, .news-item, .warning-box, table tr";
    $(sel).each((_, el) => {
        try {
            const $el = $(el);
            const text = $el.text().replace(/\s+/g, " ").trim();
            if (!passesFilters(text))
                return;
            const link = $el.find("a[href]").first();
            const href = link.attr("href") ?? pageUrl;
            const url = normalizeUrl(href, pageUrl);
            const heading = $el.find("h1, h2, h3, h4, .title, .heading").first().text().trim();
            const title = heading.length > 3 ? heading.slice(0, 200) : text.slice(0, 120) + (text.length > 120 ? "…" : "");
            const body = text.slice(0, 500);
            const id = stableAlertId(title, url, text);
            if (seen.has(id))
                return;
            seen.add(id);
            const regions = extractRegions(text);
            const alert = {
                id,
                source: SOURCE_LABEL,
                sourceType: "official",
                credibility: 99,
                title: title || "PMD notice",
                body,
                severity: extractSeverity(text),
                type: classifyAlertType(text),
                regions,
                issuedAt: new Date().toISOString(),
                url,
            };
            out.push(alert);
        }
        catch {
            /* skip block */
        }
    });
    return out;
}
async function mergeScraperCache(alerts) {
    try {
        await firebase_admin_1.db
            .collection("scraperCache")
            .doc(CACHE_DOC)
            .set({
            alerts,
            scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
            count: alerts.length,
        }, { merge: true });
    }
    catch (e) {
        console.warn("[pmd] scraperCache write failed", e);
    }
}
async function writeAlertSignals(alerts) {
    for (const a of alerts) {
        await (0, persist_1.mergeSignalDoc)(`pmd-${a.id}`, {
            kind: "scraper_pmd",
            source: SOURCE_LABEL,
            sourceType: "official",
            credibility: 99,
            payload: a,
            recordedAt: new Date().toISOString(),
        });
    }
}
/** Read alerts from Firestore cache only (no TTL). */
async function getCachedPMDAlerts() {
    try {
        const snap = await firebase_admin_1.db.collection("scraperCache").doc(CACHE_DOC).get();
        if (!snap.exists)
            return null;
        const alerts = snap.data()?.alerts;
        if (!Array.isArray(alerts))
            return null;
        return alerts;
    }
    catch {
        return null;
    }
}
/** Return cached data if fresh (<9 min); otherwise scrape, persist, return. Never throws. */
async function scrapePMDAlerts() {
    try {
        const snap = await firebase_admin_1.db.collection("scraperCache").doc(CACHE_DOC).get();
        if (snap.exists && isCacheFresh(snap.data()?.scrapedAt, CACHE_TTL_MS)) {
            const alerts = snap.data()?.alerts;
            if (Array.isArray(alerts) && alerts.length)
                return alerts;
        }
        const seen = new Set();
        const collected = [];
        const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
        for (const pageUrl of PMD_URLS) {
            try {
                const res = await (0, persist_1.fetchWithTimeout)(pageUrl, {
                    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
                });
                if (!res.ok)
                    continue;
                const html = await res.text();
                collected.push(...parsePage(html, pageUrl, seen));
            }
            catch (e) {
                console.warn("[pmd] fetch failed", pageUrl, e);
            }
        }
        await mergeScraperCache(collected);
        await writeAlertSignals(collected);
        return collected;
    }
    catch (e) {
        console.warn("[pmd] scrapePMDAlerts", e);
        const fallback = await getCachedPMDAlerts();
        return fallback ?? [];
    }
}

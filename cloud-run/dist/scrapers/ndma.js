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
exports.getCachedNDMAAlerts = getCachedNDMAAlerts;
exports.scrapeNDMAAlerts = scrapeNDMAAlerts;
/**
 * National Disaster Management Authority scraper — official alerts & situation reports.
 */
require("../firebase-admin");
const cheerio = __importStar(require("cheerio"));
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const persist_1 = require("../apis/persist");
const firebase_admin_1 = require("../firebase-admin");
const pmd_1 = require("./pmd");
const CACHE_DOC = "ndma";
const CACHE_TTL_MS = 14 * 60 * 1000;
const SOURCE_LABEL = "National Disaster Management Authority";
const KEYWORD_RE = /rain|flood|heat|dust|storm|warning|advisory|alert|thunder|hail|fog|disaster|emergency|relief|cyclone|earthquake|landslide|drought|snow|avalanche/i;
const NDMA_URLS = [
    "https://ndma.gov.pk/alerts-warnings",
    "https://ndma.gov.pk/situation-reports",
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
function stableId(parts) {
    return (0, crypto_1.createHash)("sha256").update(parts).digest("hex").slice(0, 16);
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
    return (0, pmd_1.extractRegions)(t).length > 0;
}
function toNDMAAlert(title, text, url, pdfUrl) {
    const body = text.slice(0, 500);
    const id = stableId(`${title}|${url}|${pdfUrl ?? ""}|${body.slice(0, 80)}`);
    const regions = (0, pmd_1.extractRegions)(text + " " + title);
    return {
        id,
        source: SOURCE_LABEL,
        sourceType: "official",
        credibility: 99,
        title: title.slice(0, 200) || "NDMA notice",
        body,
        severity: (0, pmd_1.extractSeverity)(text),
        type: (0, pmd_1.classifyAlertType)(text),
        regions,
        issuedAt: new Date().toISOString(),
        url,
        ...(pdfUrl ? { pdfUrl } : {}),
    };
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
            const a = toNDMAAlert(title, text, url);
            if (seen.has(a.id))
                return;
            seen.add(a.id);
            out.push(a);
        }
        catch {
            /* skip */
        }
    });
    $("a[href$='.pdf'], a[href$='.PDF']").each((_, el) => {
        try {
            const $a = $(el);
            const rawHref = $a.attr("href");
            if (!rawHref)
                return;
            const pdfUrl = normalizeUrl(rawHref, pageUrl);
            if (!/\.pdf$/i.test(pdfUrl))
                return;
            const linkText = $a.text().replace(/\s+/g, " ").trim();
            let fileTitle = linkText;
            try {
                const path = new URL(pdfUrl).pathname;
                const seg = path.split("/").pop() ?? "document.pdf";
                if (!fileTitle || fileTitle.length < 3)
                    fileTitle = decodeURIComponent(seg).replace(/\.pdf$/i, "");
            }
            catch {
                fileTitle = fileTitle || "NDMA PDF";
            }
            const parentText = $a.parent().parent().text().replace(/\s+/g, " ").trim();
            const blob = `${fileTitle} ${parentText} Pakistan situation report NDMA`;
            const hasKeyword = KEYWORD_RE.test(blob) || /situation|report|alert|warning|ndma|pdf|disaster/i.test(blob);
            if (!hasKeyword)
                return;
            const alert = toNDMAAlert(fileTitle, blob.slice(0, 800), pageUrl, pdfUrl);
            if (!alert.regions.length)
                alert.regions = ["Pakistan"];
            if (seen.has(alert.id))
                return;
            seen.add(alert.id);
            out.push(alert);
        }
        catch {
            /* skip pdf */
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
        console.warn("[ndma] scraperCache write failed", e);
    }
}
async function writeAlertSignals(alerts) {
    for (const a of alerts) {
        await (0, persist_1.mergeSignalDoc)(`ndma-${a.id}`, {
            kind: "scraper_ndma",
            source: SOURCE_LABEL,
            sourceType: "official",
            credibility: 99,
            payload: a,
            recordedAt: new Date().toISOString(),
        });
    }
}
async function getCachedNDMAAlerts() {
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
async function scrapeNDMAAlerts() {
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
        for (const pageUrl of NDMA_URLS) {
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
                console.warn("[ndma] fetch failed", pageUrl, e);
            }
        }
        await mergeScraperCache(collected);
        await writeAlertSignals(collected);
        return collected;
    }
    catch (e) {
        console.warn("[ndma] scrapeNDMAAlerts", e);
        const fallback = await getCachedNDMAAlerts();
        return fallback ?? [];
    }
}

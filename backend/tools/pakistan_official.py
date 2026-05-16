"""
Scrape Pakistan Met Department (PMD) and NDMA gov.pk listings into RawSignalRecord rows.

URLs and heuristics align with cloud-run/src/scrapers/{pmd,ndma}.ts (Pakistan AOI only).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from models.schemas import RawSignalRecord
from tools.signal_cache import cache_get, cache_put

logger = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

PMD_SOURCE = "Pakistan Met Department"
NDMA_SOURCE = "National Disaster Management Authority"

PMD_URLS = [
    "https://www.pmd.gov.pk/en/weather-alerts/",
    "https://www.pmd.gov.pk/en/current-weather/",
]
NDMA_URLS = [
    "https://ndma.gov.pk/alerts-warnings",
    "https://ndma.gov.pk/situation-reports",
]

KEYWORD_PMD = re.compile(
    r"rain|flood|heat|dust|storm|warning|advisory|alert|thunder|hail|fog",
    re.I,
)
KEYWORD_NDMA = re.compile(
    r"rain|flood|heat|dust|storm|warning|advisory|alert|thunder|hail|fog|"
    r"disaster|emergency|relief|cyclone|earthquake|landslide|drought|snow|avalanche",
    re.I,
)

REGION_DEFS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("Islamabad", re.compile(r"islamabad", re.I)),
    ("Rawalpindi", re.compile(r"rawalpindi", re.I)),
    ("Punjab", re.compile(r"punjab", re.I)),
    ("KPK", re.compile(r"\b(kpk|khyber\s*pakhtunkhwa|k\.p\.k\.)\b", re.I)),
    ("Sindh", re.compile(r"sindh", re.I)),
    ("Balochistan", re.compile(r"balo?chistan", re.I)),
    ("Lahore", re.compile(r"lahore", re.I)),
    ("Peshawar", re.compile(r"peshawar", re.I)),
)

REGION_CENTROIDS: dict[str, tuple[float, float]] = {
    "Islamabad": (33.6844, 73.0479),
    "Rawalpindi": (33.5651, 73.0169),
    "Punjab": (31.1471, 72.3412),
    "KPK": (34.7492, 72.7853),
    "Sindh": (26.8945, 68.8677),
    "Balochistan": (28.8943, 65.0681),
    "Lahore": (31.5204, 74.3587),
    "Peshawar": (34.0151, 71.5249),
    "Pakistan": (30.3753, 69.3451),
}

PAK_BB = dict(min_lat=23.65, max_lat=37.05, min_lon=60.88, max_lon=76.95)


def _stable_id(parts: str) -> str:
    return hashlib.sha256(parts.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _normalize_url(href: str | None, base: str) -> str:
    if not (href or "").strip():
        return base
    try:
        return urljoin(base, href.strip())
    except Exception:
        return base


def extract_regions(blob: str) -> list[str]:
    found: set[str] = set()
    if re.search(r"\bpakistan\b", blob, re.I):
        found.add("Pakistan")
    for name, rg in REGION_DEFS:
        if rg.search(blob):
            found.add(name)
    return sorted(found)


def classify_alert_type(text: str) -> str:
    if re.search(r"\b(dust|sandstorm|haboob|dust\s*storm)\b", text, re.I):
        return "DUST_STORM"
    if re.search(r"\b(heat\s*wave|heatwave|extreme\s*heat|scorching)\b", text, re.I):
        return "HEATWAVE"
    if re.search(r"\b(flood|flash\s*flood|monsoon|heavy\s*rain|cloudburst|rainfall)\b", text, re.I):
        return "FLOOD_RAIN"
    if re.search(r"\b(thunder|lightning|thunderstorm)\b", text, re.I):
        return "THUNDERSTORM"
    if re.search(r"\b(fog|mist|low\s*visibility|smog|haze)\b", text, re.I):
        return "LOW_VISIBILITY"
    return "GENERAL"


def extract_severity(text: str) -> str:
    t = text.lower()
    if re.search(r"\b(critical|catastrophic|red\s*alert|severe\s*emergency)\b", t):
        return "Critical"
    if re.search(r"\b(high|orange|severe|danger)\b", t):
        return "High"
    if re.search(r"\b(medium|moderate|yellow|amber)\b", t):
        return "Medium"
    if re.search(r"\b(low|minor|green|info)\b", t):
        return "Low"
    if re.search(r"\b(alert|warning|advisory)\b", t):
        return "Medium"
    return "Low"


def severity_to_hint(severity: str) -> int:
    return {
        "Critical": 9,
        "High": 8,
        "Medium": 6,
        "Low": 4,
    }.get(severity, 5)


def regions_to_ll(regions: list[str]) -> tuple[float, float]:
    pts = [REGION_CENTROIDS[r] for r in regions if r in REGION_CENTROIDS]
    if not pts:
        return REGION_CENTROIDS["Pakistan"]
    lat = sum(p[0] for p in pts) / len(pts)
    lon = sum(p[1] for p in pts) / len(pts)
    return (
        min(PAK_BB["max_lat"], max(PAK_BB["min_lat"], lat)),
        min(PAK_BB["max_lon"], max(PAK_BB["min_lon"], lon)),
    )


def _passes_pmd(text: str) -> bool:
    t = text.strip()
    return len(t) >= 12 and bool(KEYWORD_PMD.search(t)) and len(extract_regions(t)) > 0


def _passes_ndma(text: str) -> bool:
    t = text.strip()
    return len(t) >= 12 and bool(KEYWORD_NDMA.search(t)) and len(extract_regions(t)) > 0


def parse_pmd_blocks(html: str, page_url: str, seen: set[str]) -> list[RawSignalRecord]:
    out: list[RawSignalRecord] = []
    soup = BeautifulSoup(html, "html.parser")
    for el in soup.select("article, .alert-item, .news-item, .warning-box, table tr"):
        try:
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
            if not _passes_pmd(text):
                continue
            link = el.find("a", href=True)
            href = str(link["href"]) if link else None
            url = _normalize_url(href, page_url)
            ht = el.find(["h1", "h2", "h3", "h4"])
            title_txt = ht.get_text(" ", strip=True) if ht else ""
            ht2 = el.find(class_=re.compile(r"title|heading", re.I))
            if not title_txt and ht2:
                title_txt = ht2.get_text(" ", strip=True)
            heading = title_txt.strip()
            title = (
                heading[:200]
                if len(heading) > 3
                else text[:120] + ("…" if len(text) > 120 else "")
            ).strip()
            body = text[:500]
            aid = _stable_id(f"{title}|{url}|{text[:120]}")
            if aid in seen:
                continue
            seen.add(aid)

            regs = extract_regions(text)
            sev_label = extract_severity(text)
            lat, lon = regions_to_ll(regs)
            now = datetime.now(timezone.utc)
            out.append(
                RawSignalRecord(
                    id=f"pmd-{aid}",
                    source=PMD_SOURCE,
                    kind="official",
                    text=f"PMD advisory — {title}. {body[:280]}".strip(),
                    lat=lat,
                    lon=lon,
                    region=", ".join(regs) if regs else "Pakistan",
                    severity_hint=severity_to_hint(sev_label),
                    recorded_at=now,
                    payload={
                        "category": "pmd",
                        "title": title,
                        "severity_label": sev_label,
                        "alert_type": classify_alert_type(text),
                        "regions": regs,
                        "page_url": page_url,
                        "detail_url": url,
                        "credibility_pct": 99,
                    },
                )
            )
        except Exception:
            continue
    return out


def parse_ndma_blocks(html: str, page_url: str, seen: set[str]) -> list[RawSignalRecord]:
    out: list[RawSignalRecord] = []
    soup = BeautifulSoup(html, "html.parser")

    for el in soup.select("article, .alert-item, .news-item, .warning-box, table tr"):
        try:
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
            if not _passes_ndma(text):
                continue
            link = el.find("a", href=True)
            href = str(link["href"]) if link else None
            url = _normalize_url(href, page_url)
            ht = el.find(["h1", "h2", "h3", "h4"])
            title_txt = ht.get_text(" ", strip=True) if ht else ""
            ht2 = el.find(class_=re.compile(r"title|heading", re.I))
            if not title_txt and ht2:
                title_txt = ht2.get_text(" ", strip=True)
            heading = title_txt.strip()
            title = (
                heading[:200]
                if len(heading) > 3
                else text[:120] + ("…" if len(text) > 120 else "")
            ).strip()
            body_snip = text[:500]
            aid = _stable_id(f"{title}|{url}|{body_snip[:80]}")
            if aid in seen:
                continue
            seen.add(aid)

            regs = extract_regions(text + " " + title)
            sev_label = extract_severity(text)
            lat, lon = regions_to_ll(regs)
            now = datetime.now(timezone.utc)
            out.append(
                RawSignalRecord(
                    id=f"ndma-{aid}",
                    source=NDMA_SOURCE,
                    kind="official",
                    text=f"NDMA notice — {title}. {body_snip[:280]}".strip(),
                    lat=lat,
                    lon=lon,
                    region=", ".join(regs) if regs else "Pakistan",
                    severity_hint=severity_to_hint(sev_label),
                    recorded_at=now,
                    payload={
                        "category": "ndma",
                        "title": title,
                        "severity_label": sev_label,
                        "alert_type": classify_alert_type(text),
                        "regions": regs,
                        "page_url": page_url,
                        "detail_url": url,
                        "credibility_pct": 99,
                    },
                )
            )
        except Exception:
            continue

    for a in soup.select("a[href]"):
        try:
            raw_href = a.get("href")
            if not raw_href or not re.search(r"\.pdf$", str(raw_href), re.I):
                continue
            pdf_url = _normalize_url(str(raw_href), page_url)
            link_text = re.sub(r"\s+", " ", a.get_text(" ", strip=True)).strip()
            file_title = link_text
            if not file_title or len(file_title) < 3:
                try:
                    seg = pdf_url.split("/")[-1] or ""
                    seg = re.sub(r"\.pdf$", "", seg, flags=re.I)
                    file_title = seg or "NDMA PDF"
                except Exception:
                    file_title = "NDMA PDF"

            parent = a.parent
            grand = parent.parent if parent else None
            parent_text = ""
            if grand is not None:
                parent_text = re.sub(r"\s+", " ", grand.get_text(" ", strip=True)).strip()
            blob = f"{file_title} {parent_text} Pakistan situation report NDMA"
            has_kw = bool(KEYWORD_NDMA.search(blob)) or bool(
                re.search(r"situation|report|alert|warning|ndma|pdf|disaster", blob, re.I)
            )
            if not has_kw:
                continue
            body_pdf = blob[:800]
            aid = _stable_id(f"{file_title}|{page_url}|{pdf_url}|{body_pdf[:80]}")
            regs = extract_regions(blob)
            if not regs:
                regs = ["Pakistan"]
            if aid in seen:
                continue
            seen.add(aid)
            lat, lon = regions_to_ll(regs)
            now = datetime.now(timezone.utc)
            sev_label = extract_severity(blob)
            out.append(
                RawSignalRecord(
                    id=f"ndma-{aid}",
                    source=NDMA_SOURCE,
                    kind="official",
                    text=f"NDMA report — {file_title}. {body_pdf[:280]}".strip(),
                    lat=lat,
                    lon=lon,
                    region=", ".join(regs),
                    severity_hint=severity_to_hint(sev_label),
                    recorded_at=now,
                    payload={
                        "category": "ndma",
                        "title": file_title[:200],
                        "severity_label": sev_label,
                        "alert_type": classify_alert_type(blob),
                        "regions": regs,
                        "page_url": page_url,
                        "pdf_url": pdf_url,
                        "credibility_pct": 99,
                    },
                )
            )
        except Exception:
            continue

    return out


async def _fetch_pages(urls: list[str]) -> list[tuple[str, str]]:
    headers = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"}
    pages: list[tuple[str, str]] = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for u in urls:
            try:
                r = await client.get(u, headers=headers)
                if r.status_code == 200:
                    pages.append((u, r.text))
            except Exception as e:
                logger.warning("[pk-official] fetch failed %s: %s", u, e)
    return pages


async def scrape_pmd_signals() -> list[RawSignalRecord]:
    seen: set[str] = set()
    rows: list[RawSignalRecord] = []
    for page_url, html in await _fetch_pages(PMD_URLS):
        rows.extend(parse_pmd_blocks(html, page_url, seen))
    return rows


async def scrape_ndma_signals() -> list[RawSignalRecord]:
    seen: set[str] = set()
    rows: list[RawSignalRecord] = []
    for page_url, html in await _fetch_pages(NDMA_URLS):
        rows.extend(parse_ndma_blocks(html, page_url, seen))
    return rows


async def load_pakistan_official_signals(
    *,
    use_signal_cache: bool = True,
    out_meta: dict[str, Any] | None = None,
) -> list[RawSignalRecord]:
    """Parallel PMD + NDMA scrape with per-source disk cache fallback (same pattern as signals_loader)."""
    all_signals: list[RawSignalRecord] = []
    degraded: list[str] = []
    source_counts: dict[str, int] = {}

    async def _pull(label: str, fn: Any) -> None:
        try:
            res: list[RawSignalRecord] = await fn()
            all_signals.extend(res)
            source_counts[label] = len(res)
            if use_signal_cache and res:
                cache_put(label, res)
        except Exception as e:
            logger.warning("%s scrape failed: %s", label, e)
            if use_signal_cache:
                cached = cache_get(label)
                if cached:
                    degraded.append(f"{label}_cache_fallback:{type(e).__name__}")
                    all_signals.extend(cached)
                    source_counts[label] = len(cached)
                    return
            degraded.append(f"{label}_unavailable:{type(e).__name__}")

    await asyncio.gather(
        _pull("pakistan_pmd_html", scrape_pmd_signals),
        _pull("pakistan_ndma_html", scrape_ndma_signals),
    )

    by_id = {r.id: r for r in all_signals}
    merged = sorted(
        by_id.values(),
        key=lambda r: r.recorded_at,
        reverse=True,
    )

    if out_meta is not None:
        out_meta.setdefault("signal_source_counts", {}).update(source_counts)
        if degraded:
            out_meta.setdefault("degraded_mode", []).extend(degraded)

    return merged


__all__ = ["load_pakistan_official_signals"]

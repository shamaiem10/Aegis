from __future__ import annotations

import uuid
from typing import Any

from models.schemas import FusedSignal
from utils.geo import haversine_km


def _tokens(s: str) -> set[str]:
    buf = "".join(c if c.isalnum() else " " for c in s.lower())
    return {w for w in buf.split() if len(w) > 3}


def _similar_summaries(a: str, b: str) -> bool:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return False
    inter = len(ta & tb)
    return inter >= 3 or inter / max(1, min(len(ta), len(tb))) > 0.35


def merge_duplicate_fused_bundles(
    fused: list[FusedSignal],
    *,
    max_km: float = 12.0,
) -> tuple[list[FusedSignal], list[dict[str, Any]]]:
    """Merge near-duplicate fused bundles (same rough incident, repeated ingest)."""
    if len(fused) < 2:
        return fused, []

    merged: list[FusedSignal] = []
    consumed: set[int] = set()
    audit: list[dict[str, Any]] = []

    for i, a in enumerate(fused):
        if i in consumed:
            continue
        group = [a]
        for j in range(i + 1, len(fused)):
            if j in consumed:
                continue
            b = fused[j]
            dist = haversine_km(a.lat, a.lon, b.lat, b.lon)
            if dist <= max_km and _similar_summaries(a.summary, b.summary):
                group.append(b)
                consumed.add(j)

        if len(group) == 1:
            merged.append(a)
            continue

        ids = [g.id for g in group]
        all_sources: list[str] = []
        for g in group:
            all_sources.extend(g.source_ids)
        dedup_sources: list[str] = []
        seen: set[str] = set()
        for x in all_sources:
            if x not in seen:
                seen.add(x)
                dedup_sources.append(x)
        max_hint = max(g.fused_severity_hint for g in group)
        avg_lat = sum(g.lat for g in group) / len(group)
        avg_lon = sum(g.lon for g in group) / len(group)
        min_ws = min(g.window_start for g in group)
        max_we = max(g.window_end for g in group)
        conf = min(1.0, sum(g.confidence for g in group) / len(group) + 0.06)
        kinds = sorted({g.kind for g in group})
        summary = (
            f"Merged {len(group)} duplicate-near bundles → single incident. "
            + group[0].summary[:320]
        )
        merged.append(
            FusedSignal(
                id=f"fus_{uuid.uuid4().hex[:10]}",
                source_ids=dedup_sources,
                kind="multi" if len(kinds) != 1 else kinds[0],
                summary=summary,
                lat=avg_lat,
                lon=avg_lon,
                region=group[0].region,
                confidence=round(conf, 3),
                fused_severity_hint=max_hint,
                window_start=min_ws,
                window_end=max_we,
            )
        )
        audit.append(
            {
                "action": "duplicate_incident_merge",
                "merged_fused_ids": ids,
                "kept_sources": len(dedup_sources),
            }
        )

    merged.sort(key=lambda f: f.fused_severity_hint, reverse=True)
    return merged, audit

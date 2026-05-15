from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import timedelta
from typing import DefaultDict

from models.schemas import FusedSignal, RawSignalRecord

from utils.geo import haversine_km

# Two signals within this distance and time window are fused.
_MAX_KM = 80.0
_MAX_HOURS = 12.0


def _hours_apart(a: RawSignalRecord, b: RawSignalRecord) -> float:
    return abs((a.recorded_at - b.recorded_at).total_seconds()) / 3600.0


def _can_merge(master: RawSignalRecord, cand: RawSignalRecord) -> bool:
    dist = haversine_km(master.lat, master.lon, cand.lat, cand.lon)
    return dist <= _MAX_KM and _hours_apart(master, cand) <= _MAX_HOURS


def _fuse_partition_rows(rows: list[RawSignalRecord]) -> list[FusedSignal]:
    if not rows:
        return []
    seeds = sorted(rows, key=lambda r: r.recorded_at)
    clusters: DefaultDict[int, list[RawSignalRecord]] = defaultdict(list)
    cluster_centers: list[RawSignalRecord] = []
    cid = -1

    for item in seeds:
        placed = False
        for i, anchor in enumerate(cluster_centers):
            if _can_merge(anchor, item):
                clusters[i].append(item)
                placed = True
                break
        if placed:
            continue
        cid += 1
        cluster_centers.append(item)
        clusters[cid].append(item)

    fused: list[FusedSignal] = []
    for group in clusters.values():
        group_sorted = sorted(group, key=lambda r: r.recorded_at)
        start = group_sorted[0].recorded_at
        end = group_sorted[-1].recorded_at
        delta = timedelta(hours=2)
        window_start = min(start - delta, group_sorted[len(group_sorted) // 2].recorded_at - delta)
        window_end = max(end + delta, group_sorted[len(group_sorted) // 2].recorded_at + delta)
        avg_lat = sum(r.lat for r in group_sorted) / len(group_sorted)
        avg_lon = sum(r.lon for r in group_sorted) / len(group_sorted)
        max_hint = max(r.severity_hint for r in group_sorted)
        corr = min(1.0, 0.45 + 0.15 * (len(group_sorted) - 1))
        sources = sorted({s.source for s in group_sorted})
        kinds = sorted({s.kind for s in group_sorted})
        region = group_sorted[0].region or "unknown"
        excerpts = "; ".join(s.text.strip()[:120] for s in group_sorted if s.text.strip())[:400]
        ig = (group_sorted[0].payload or {}).get("incident_group")
        ig_tag = f" group={ig}" if ig else ""
        summary = (
            f"Synthetic fusion ({len(group_sorted)} signals{ig_tag}, "
            f"sources={','.join(sources)} kinds={','.join(kinds)})."
        )
        if excerpts:
            summary += f" Signals: {excerpts}"
        fused.append(
            FusedSignal(
                id=f"fus_{uuid.uuid4().hex[:10]}",
                source_ids=[r.id for r in group_sorted],
                kind="multi" if len(kinds) != 1 else kinds[0],
                summary=summary,
                lat=avg_lat,
                lon=avg_lon,
                region=region,
                confidence=round(min(1.0, corr + 0.05 * len(sources)), 3),
                fused_severity_hint=max_hint,
                window_start=window_start,
                window_end=window_end,
            )
        )
    return fused


def fuse_signals(rows: list[RawSignalRecord]) -> list[FusedSignal]:
    """Cluster raw rows; partition by `payload.incident_group` when present for multi-incident runs."""
    if not rows:
        return []
    partitions: DefaultDict[str, list[RawSignalRecord]] = defaultdict(list)
    for r in rows:
        key = (r.payload or {}).get("incident_group")
        pk = str(key) if key is not None else "_default"
        partitions[pk].append(r)

    fused_all: list[FusedSignal] = []
    for pk in sorted(partitions.keys()):
        fused_all.extend(_fuse_partition_rows(partitions[pk]))

    fused_all.sort(key=lambda f: f.fused_severity_hint, reverse=True)
    return fused_all

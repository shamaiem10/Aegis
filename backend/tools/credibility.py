from __future__ import annotations

import re
from typing import Any

from models.schemas import RawSignalRecord

_URGENCY = re.compile(
    r"\b(emergency|urgent|trapped|blocked|burst|spike|severe|evacuat|1222|1122)\b", re.I
)


def score_raw_signal(record: RawSignalRecord) -> dict[str, Any]:
    """Heuristic credibility + contradiction hints for fusion/orchestrator meta."""
    p = record.payload or {}
    source = (record.source or "").lower()
    kind = (record.kind or "").lower()

    base = 0.55
    if kind in {"weather_alert", "sensor", "emergency_call", "field_report"}:
        base += 0.12
    if kind in {"historical_vulnerability", "public_transport"}:
        base += 0.06
    if "official" in source or p.get("official_weight"):
        base += 0.15
    if kind == "social":
        base -= 0.08
    if p.get("sensor_stale_hours", 0) and float(p["sensor_stale_hours"]) > 1.5:
        base -= 0.12
    if p.get("geolocation_quality") == "cell_tower":
        base -= 0.05
    geo_conf = 0.72
    gq = p.get("geolocation_quality")
    if gq == "gps_fix":
        geo_conf = 0.93
    elif gq == "wifi_fingerprint":
        geo_conf = 0.86
    elif gq == "cell_tower":
        geo_conf = 0.58
    elif gq == "admin_region_only":
        geo_conf = 0.42

    velocity = float(p.get("mention_velocity_per_hr") or p.get("velocity_1h") or 0)
    velocity_factor = min(0.15, velocity / 400.0)

    text = (record.text or "").lower()
    urgency_hits = len(_URGENCY.findall(text))
    urgency_boost = min(0.12, urgency_hits * 0.04)

    cred = max(0.08, min(0.98, base + velocity_factor + urgency_boost))

    flags: list[str] = []
    if kind == "social" and cred < 0.45:
        flags.append("low_trust_social")
    if p.get("contradicts_social_flood"):
        flags.append("contradicts_peer_signals")
    if p.get("hypothesis") == "water_main_burst":
        flags.append("alternate_physical_hypothesis")

    return {
        "signal_id": record.id,
        "credibility": round(cred, 3),
        "base_trust": round(base, 3),
        "geolocation_confidence": geo_conf,
        "urgency_hits": urgency_hits,
        "mention_velocity_per_hr": velocity or None,
        "flags": flags,
    }


def contradiction_level(records: list[RawSignalRecord], *, group_key: str | None = None) -> float:
    """0..1 rough contradiction score within an incident group."""
    rows = records
    if group_key is not None:
        rows = [
            r
            for r in records
            if str((r.payload or {}).get("incident_group", "_default")) == group_key
        ]
    if len(rows) < 2:
        return 0.0
    texts = " ".join(r.text.lower() for r in rows)
    score = 0.0
    floodish = any(k in texts for k in ("flood", "inundat", "standing water", "flash flood"))
    infra = any(k in texts for k in ("water main", "burst", "pipe"))
    if floodish and infra:
        score += 0.55
    low_sensor = [r for r in rows if (r.payload or {}).get("contradicts_social_flood")]
    if low_sensor and floodish:
        score += 0.25
    return min(1.0, score)

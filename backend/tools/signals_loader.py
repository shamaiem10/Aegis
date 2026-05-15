import logging
from typing import Any

import asyncio

from models.schemas import RawSignalRecord
from tools.enrichment_signals import load_enrichment_raw_signals
from tools.gdacs_client import fetch_gdacs_signals
from tools.reliefweb_client import fetch_reliefweb_signals
from tools.signal_cache import cache_get, cache_put
from tools.supplemental_signals import load_supplemental_raw_signals
from tools.usgs_client import fetch_usgs_signals

logger = logging.getLogger(__name__)

__all__ = ["load_live_raw_signals"]


async def load_live_raw_signals(
    *,
    include_supplemental: bool = False,
    supplemental_only: bool = False,
    scenario_id: str | None = None,
    out_meta: dict[str, Any] | None = None,
    use_signal_cache: bool = True,
    include_enrichment_signals: bool = True,
) -> list[RawSignalRecord]:
    """Fetch live hazard feeds; optional cache fallback; supplemental + enrichment merges."""
    all_signals: list[RawSignalRecord] = []
    degraded: list[str] = []
    source_counts: dict[str, int] = {}

    async def _pull(label: str, fn) -> None:
        try:
            res = await fn()
            all_signals.extend(res)
            source_counts[label] = len(res)
            if use_signal_cache:
                cache_put(label, res)
        except Exception as e:
            logger.warning("%s fetch failed: %s", label, e)
            if use_signal_cache:
                cached = cache_get(label)
                if cached:
                    degraded.append(f"{label}_cache_fallback:{type(e).__name__}")
                    all_signals.extend(cached)
                    source_counts[label] = len(cached)
                    return
            degraded.append(f"{label}_unavailable:{type(e).__name__}")

    if supplemental_only:
        sup = load_supplemental_raw_signals(scenario_id=scenario_id)
        all_signals.extend(sup)
        source_counts["supplemental_mock"] = len(sup)
        if out_meta is not None:
            out_meta.setdefault("degraded_mode", []).append("supplemental_only_skip_live_apis")
    else:
        await asyncio.gather(
            _pull("usgs", fetch_usgs_signals),
            _pull("gdacs", fetch_gdacs_signals),
            _pull("reliefweb", fetch_reliefweb_signals),
        )

    if include_supplemental and not supplemental_only:
        sup = load_supplemental_raw_signals(scenario_id=scenario_id)
        all_signals.extend(sup)
        source_counts["supplemental_mock"] = source_counts.get("supplemental_mock", 0) + len(sup)

    if include_enrichment_signals:
        enr = load_enrichment_raw_signals()
        if enr:
            all_signals.extend(enr)
            source_counts["enrichment_historical_transport"] = len(enr)

    if out_meta is not None:
        out_meta["signal_source_counts"] = source_counts
        if degraded:
            out_meta.setdefault("degraded_mode", []).extend(degraded)

    return all_signals
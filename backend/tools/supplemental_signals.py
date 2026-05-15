from __future__ import annotations

import logging

from models.schemas import RawSignalRecord
from tools.mock_data_io import MOCK_ROOT, load_json, parse_raw_signals

logger = logging.getLogger(__name__)

_SUPPLEMENTAL_FILE = "supplemental_crisis_streams.json"


def load_supplemental_raw_signals(*, scenario_id: str | None = None) -> list[RawSignalRecord]:
    path = MOCK_ROOT / _SUPPLEMENTAL_FILE
    if not path.exists():
        logger.warning("Supplemental file missing: %s", path)
        return []
    try:
        data = load_json(_SUPPLEMENTAL_FILE)
    except (OSError, ValueError) as e:
        logger.warning("Could not load supplemental streams: %s", e)
        return []
    if not isinstance(data, list):
        return []
    rows = parse_raw_signals(data)
    if scenario_id and scenario_id != "g10_flood_plus_heat":
        logger.info("Scenario %s: using full supplemental set (no filter yet)", scenario_id)
    return rows

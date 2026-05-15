"""Historical vulnerability + public-transport style enrichments (mock JSON)."""

from __future__ import annotations

import logging

from models.schemas import RawSignalRecord
from tools.mock_data_io import load_json, parse_raw_signals

logger = logging.getLogger(__name__)

_FILE = "enrichment_signals.json"


def load_enrichment_raw_signals() -> list[RawSignalRecord]:
    try:
        data = load_json(_FILE)
    except (OSError, FileNotFoundError) as e:
        logger.debug("No enrichment file: %s", e)
        return []
    except ValueError as e:
        logger.warning("Bad enrichment JSON: %s", e)
        return []
    if not isinstance(data, list):
        return []
    return parse_raw_signals(data)

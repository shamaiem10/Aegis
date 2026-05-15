"""Disk-backed cache for raw signal feeds (fallback when upstream APIs fail)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from models.schemas import RawSignalRecord

logger = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"
_CACHE_FILE = _CACHE_DIR / "signal_feeds.json"


def _ensure_dir() -> None:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _read_all() -> dict[str, Any]:
    if not _CACHE_FILE.exists():
        return {}
    try:
        return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Signal cache read failed: %s", e)
        return {}


def _write_all(data: dict[str, Any]) -> None:
    _ensure_dir()
    _CACHE_FILE.write_text(json.dumps(data, indent=0), encoding="utf-8")


def cache_put(namespace: str, records: list[RawSignalRecord]) -> None:
    blob = _read_all()
    blob[namespace] = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "items": [r.model_dump(mode="json") for r in records],
    }
    _write_all(blob)


def cache_get(namespace: str) -> list[RawSignalRecord] | None:
    blob = _read_all()
    entry = blob.get(namespace)
    if not entry or not isinstance(entry.get("items"), list):
        return None
    try:
        return [RawSignalRecord.model_validate(x) for x in entry["items"]]
    except Exception as e:
        logger.warning("Signal cache parse failed for %s: %s", namespace, e)
        return None

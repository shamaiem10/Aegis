"""Cache last-good Open-Meteo snapshot keyed by coarse lat/lon (API fallback)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"
_CACHE_FILE = _CACHE_DIR / "weather_snapshot.json"


def _key(lat: float, lon: float) -> str:
    return f"{round(lat, 2)}_{round(lon, 2)}"


def _read() -> dict[str, Any]:
    if not _CACHE_FILE.exists():
        return {}
    try:
        return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write(data: dict[str, Any]) -> None:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _CACHE_FILE.write_text(json.dumps(data, indent=0), encoding="utf-8")


def weather_cache_put(lat: float, lon: float, payload: dict[str, Any]) -> None:
    data = _read()
    data[_key(lat, lon)] = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }
    _write(data)


def weather_cache_get(lat: float, lon: float) -> dict[str, Any] | None:
    data = _read()
    row = data.get(_key(lat, lon))
    if not row:
        return None
    p = row.get("payload")
    return p if isinstance(p, dict) else None

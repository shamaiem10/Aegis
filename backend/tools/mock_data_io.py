"""Shared JSON + raw signal parsing for mock_data (avoids circular imports)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from models.schemas import RawSignalRecord

MOCK_ROOT = Path(__file__).resolve().parent.parent / "mock_data"


def load_json(name: str) -> Any:
    path = MOCK_ROOT / name
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw)


def parse_raw_signals(data: list[dict[str, Any]]) -> list[RawSignalRecord]:
    out: list[RawSignalRecord] = []
    for row in data:
        ts_raw = row.get("recorded_at") or row.get("ts")
        if isinstance(ts_raw, str):
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        elif isinstance(ts_raw, (int, float)):
            ts = datetime.fromtimestamp(ts_raw, tz=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)
        out.append(
            RawSignalRecord(
                id=row["id"],
                source=str(row["source"]),
                kind=str(row.get("kind", "mixed")),
                text=str(row.get("text", "")),
                lat=float(row["lat"]),
                lon=float(row["lon"]),
                region=str(row.get("region", "")),
                severity_hint=int(row.get("severity_hint", 5)),
                recorded_at=ts,
                payload=dict(row.get("payload") or {}),
            )
        )
    return out

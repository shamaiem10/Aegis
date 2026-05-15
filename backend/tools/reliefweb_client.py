"""Fetch live disaster reports from ReliefWeb API v2 (optional — requires RELIEFWEB_APPNAME)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from config import get_settings
from models.schemas import RawSignalRecord

logger = logging.getLogger(__name__)


async def fetch_reliefweb_signals() -> list[RawSignalRecord]:
    """
    ReliefWeb v1 returns 410; v2 needs a pre-approved ``appname``.
    If ``RELIEFWEB_APPNAME`` is unset, skip (USGS + GDACS still run).
    """
    appname = (get_settings().reliefweb_appname or "").strip()
    if not appname:
        logger.debug(
            "ReliefWeb ingest skipped (set RELIEFWEB_APPNAME in .env — see https://apidoc.reliefweb.int/)",
        )
        return []

    url = (
        f"https://api.reliefweb.int/v2/disasters?"
        f"appname={appname}&limit=15&sort=date:created&profile=full"
    )

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code != 200:
                logger.warning("ReliefWeb returned HTTP %s", r.status_code)
                return []
            data = r.json()
    except Exception as e:
        logger.warning("ReliefWeb fetch failed: %s", e)
        return []

    signals: list[RawSignalRecord] = []

    for item in data.get("data", []):
        fields = item.get("fields", {})
        name = fields.get("name") or "ReliefWeb disaster"

        lat, lon = 0.0, 0.0
        primary_country = fields.get("primary_country") or {}
        if isinstance(primary_country, dict):
            loc = primary_country.get("location") or {}
            if isinstance(loc, dict):
                lat = float(loc.get("lat") or 0.0)
                lon = float(loc.get("lon") or 0.0)
        region = (
            primary_country.get("name")
            if isinstance(primary_country, dict)
            else None
        ) or "Unknown"

        recorded_at = datetime.now(timezone.utc)
        date_field = fields.get("date")
        if isinstance(date_field, dict) and date_field.get("created"):
            try:
                recorded_at = datetime.fromisoformat(
                    str(date_field["created"]).replace("Z", "+00:00"),
                )
                if recorded_at.tzinfo is None:
                    recorded_at = recorded_at.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError, OSError):
                pass

        signals.append(
            RawSignalRecord(
                id=f"rw_{item.get('id')}",
                source="reliefweb",
                kind="news",
                text=str(name),
                lat=lat,
                lon=lon,
                region=str(region),
                severity_hint=6,
                recorded_at=recorded_at,
                payload={},
            ),
        )

    return signals

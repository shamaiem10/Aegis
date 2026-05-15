"""Fetch weather from Open-Meteo (no API key required)."""

from __future__ import annotations

from typing import Any

import httpx

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


async def forecast_snapshot(lat: float, lon: float) -> dict[str, Any]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "hourly": "precipitation_probability,precipitation",
        "forecast_days": 1,
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(FORECAST_URL, params=params)
        r.raise_for_status()
        return r.json()


async def geocode_city(name: str, country_codes: str = "pk") -> tuple[float, float] | None:
    params = {"name": name, "count": 1}
    if country_codes:
        params["country"] = country_codes
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(GEOCODE_URL, params=params)
        r.raise_for_status()
        data = r.json()
        results = data.get("results") or []
        if not results:
            return None
        top = results[0]
        return float(top["latitude"]), float(top["longitude"])

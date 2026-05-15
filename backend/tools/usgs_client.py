"""Fetch live earthquake data from USGS."""

from __future__ import annotations

from datetime import datetime, timezone
import httpx

from models.schemas import RawSignalRecord

USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"

async def fetch_usgs_signals(min_magnitude: float = 3.0) -> list[RawSignalRecord]:
    """Fetch live earthquake data from USGS and convert to RawSignalRecord."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(USGS_URL)
        r.raise_for_status()
        data = r.json()
        
    features = data.get("features", [])
    signals = []
    
    for f in features:
        props = f.get("properties", {})
        mag = props.get("mag")
        if mag is None or mag < min_magnitude:
            continue
            
        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue
            
        lon, lat = coords[0], coords[1]
        time_ms = props.get("time")
        if time_ms:
            ts = datetime.fromtimestamp(time_ms / 1000.0, tz=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)
            
        severity_hint = min(10, max(1, int(mag * 2)))  # Rough scaling
        
        sig = RawSignalRecord(
            id=f.get("id", f"usgs_{int(ts.timestamp())}"),
            source="usgs_seismic",
            kind="sensor",
            text=f"USGS Earthquake Alert: {props.get('title', 'Unknown')} (Mag: {mag})",
            lat=float(lat),
            lon=float(lon),
            region=props.get("place", "Unknown"),
            severity_hint=severity_hint,
            recorded_at=ts,
            payload={
                "magnitude": mag,
                "url": props.get("url"),
                "status": props.get("status")
            }
        )
        signals.append(sig)
        
    return signals

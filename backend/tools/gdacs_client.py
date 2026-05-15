"""Fetch live disaster alerts from GDACS RSS feed."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
import httpx

from models.schemas import RawSignalRecord

GDACS_RSS_URL = "https://www.gdacs.org/xml/rss.xml"

async def fetch_gdacs_signals() -> list[RawSignalRecord]:
    """Fetch live disasters from GDACS RSS."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(GDACS_RSS_URL)
        r.raise_for_status()
        xml_data = r.text
        
    root = ET.fromstring(xml_data)
    signals = []
    
    for item in root.findall(".//item"):
        title = item.findtext("title") or "Unknown Event"
        desc = item.findtext("description") or ""
        
        # GDACS uses georss:Point
        point = item.findtext("{http://www.georss.org/georss}Point")
        lat, lon = 0.0, 0.0
        if point:
            parts = point.split()
            if len(parts) == 2:
                lat, lon = float(parts[0]), float(parts[1])
                
        # GDACS custom tags
        alert_level = item.findtext("{http://www.gdacs.org}alertlevel") or "Green"
        event_type = item.findtext("{http://www.gdacs.org}eventtype") or "other"
        
        severity_hint = 4
        if alert_level.lower() == "orange":
            severity_hint = 7
        elif alert_level.lower() == "red":
            severity_hint = 9
            
        sig = RawSignalRecord(
            id=f"gdacs_{hash(title)}",
            source="gdacs_official",
            kind="official",
            text=f"GDACS Alert [{alert_level}]: {title}. {desc[:100]}...",
            lat=lat,
            lon=lon,
            region=item.findtext("{http://www.gdacs.org}country") or "Unknown",
            severity_hint=severity_hint,
            recorded_at=datetime.now(timezone.utc),
            payload={
                "alert_level": alert_level,
                "event_type": event_type
            }
        )
        signals.append(sig)
        
    return signals

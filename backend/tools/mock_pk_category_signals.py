"""
Pakistan AOI mock alerts for rehearsal / standalone deploy (`accidents`, earthquakes, floods, disease spreads).

Returned rows match `RawSignalRecord` — used instead of foreign live feeds for alert pipelines.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Literal, cast

from models.schemas import RawSignalRecord

AlertCategorySlug = Literal["accidents", "earthquakes", "floods", "disease"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sig(
    id_: str,
    *,
    source: str,
    kind: str,
    text: str,
    lat: float,
    lon: float,
    region: str,
    severity_hint: int,
    minutes_ago: int,
    payload: dict | None = None,
) -> RawSignalRecord:
    return RawSignalRecord(
        id=id_,
        source=source,
        kind=kind,
        text=text,
        lat=lat,
        lon=lon,
        region=region,
        severity_hint=severity_hint,
        recorded_at=_now() - timedelta(minutes=minutes_ago),
        payload=payload or {},
    )


def get_mock_signals_accidents() -> list[RawSignalRecord]:
    return [
        _sig(
            "pk-acc-m1-crash-khi-01",
            source="aegis_mock_pk_accidents",
            kind="traffic_accident",
            text=(
                "Multi-vehicle incident reported — Karachi Northern Bypass westbound lane near Surjani junction; "
                "rescue dispatched; motorists advised alternate route via Lyari Expressway spur."
            ),
            lat=24.9740,
            lon=67.0643,
            region="Karachi, Sindh",
            severity_hint=8,
            minutes_ago=18,
            payload={"mock_category": "accidents", "road_class": "arterial"},
        ),
        _sig(
            "pk-acc-m2-pileup-lhr-02",
            source="aegis_mock_pk_accidents",
            kind="traffic_accident",
            text=(
                "Heavy goods collision + secondary pile-up — Lahore Ring Road Sector F bottleneck; ICT EMS mutual "
                "aid requested; drones for thermal sweep."
            ),
            lat=31.4452,
            lon=74.2486,
            region="Lahore, Punjab",
            severity_hint=7,
            minutes_ago=54,
            payload={"mock_category": "accidents", "vehicles_involved_estimate": 6},
        ),
        _sig(
            "pk-acc-m3-gt-hotspot-rwp-03",
            source="aegis_mock_pk_accidents",
            kind="road_incident",
            text=(
                "GT Road Rawalpindi–Taxila corridor — overturned cargo tanker partially blocking uphill lane; NHMP "
                "rolling closure segments 800m east of toll."
            ),
            lat=33.6112,
            lon=72.8195,
            region="Rawalpindi, Punjab",
            severity_hint=6,
            minutes_ago=112,
            payload={"mock_category": "accidents", "hazard": "fuel_spill_possible"},
        ),
    ]


def get_mock_signals_earthquakes() -> list[RawSignalRecord]:
    return [
        _sig(
            "pk-seq-hk-feltisb-04",
            source="aegis_mock_pk_seismic",
            kind="earthquake_alert",
            text=(
                "M4.9 regional event — foothills northwest; Islamabad/Rwp reported light shaking EMS II–III equivalent; "
                "NDMA liaison cell monitoring aftershocks (mock rehearsal feed)."
            ),
            lat=33.7210,
            lon=73.0601,
            region="Islamabad–Rawalpindi felt area",
            severity_hint=5,
            minutes_ago=26,
            payload={"mock_category": "earthquakes", "mag": 4.9, "depth_km_approx": 18},
        ),
        _sig(
            "pk-seq-baloch-remote-05",
            source="aegis_mock_pk_seismic",
            kind="earthquake_alert",
            text=(
                "Moderate distal quake — Balochistan–Afghan frontier; negligible population exposure PK side; DGPDMA "
                "sit-rep standby (training signal)."
            ),
            lat=30.1120,
            lon=67.0891,
            region="Balochistan (border AOI)",
            severity_hint=4,
            minutes_ago=191,
            payload={"mock_category": "earthquakes", "mag": 5.2},
        ),
    ]


def get_mock_signals_floods() -> list[RawSignalRecord]:
    return [
        _sig(
            "pk-fl-kabul-stage-warn-06",
            source="aegis_mock_pk_hydro",
            kind="river_flood",
            text=(
                "Kabul River Nowshera gauge trending rapid rise — precautionary evacuation advisory low terraces; "
                "sync with PDMA KP sandbag corridors (mock)."
            ),
            lat=34.0159,
            lon=71.9815,
            region="Nowshera, KPK",
            severity_hint=8,
            minutes_ago=33,
            payload={"mock_category": "floods", "stage_alert": "watch"},
        ),
        _sig(
            "pk-fl-urban-cell-khi-07",
            source="aegis_mock_pk_hydro",
            kind="flash_flood_risk",
            text=(
                "High-intensity cell track over Lyari corridor — Karachi DMC pre-position pumps; BRT underpass sump "
                "watch list active."
            ),
            lat=24.8607,
            lon=66.9905,
            region="Karachi Central, Sindh",
            severity_hint=7,
            minutes_ago=47,
            payload={"mock_category": "floods", "rain_mm_h_peak_est": 42},
        ),
        _sig(
            "pk-fl-coastal-swath-gw-08",
            source="aegis_mock_pk_hydro",
            kind="coastal_surge",
            text=(
                "Monsoon-enhanced runoff — Gwadar East Bay low-lying access roads precautionary cordon rehearsal; PDMA "
                "Balochistan coordination net check."
            ),
            lat=25.2332,
            lon=62.3354,
            region="Gwadar, Balochistan",
            severity_hint=5,
            minutes_ago=203,
            payload={"mock_category": "floods"},
        ),
    ]


def get_mock_signals_disease_spreads() -> list[RawSignalRecord]:
    return [
        _sig(
            "pk-dis-meas-cluster-mkd-09",
            source="aegis_mock_pk_health",
            kind="disease_cluster",
            text=(
                "KP Health EOC — accelerated measles case cluster flagged in periphery wards; supplementary "
                "vaccination mop-up window 72h (synthetic tabletop feed)."
            ),
            lat=34.3076,
            lon=73.0363,
            region="Mansehra, KPK",
            severity_hint=6,
            minutes_ago=61,
            payload={"mock_category": "disease", "pathogen_hint": "measles"},
        ),
        _sig(
            "pk-dis-deng-lhr-watch-10",
            source="aegis_mock_pk_health",
            kind="vector_borne_watch",
            text=(
                "Punjab NIH dengue sentinel uptick — Lahore hotspots vector indices above district trigger; larvicide "
                "sorties confirmed for next dawn cycle (mock)."
            ),
            lat=31.5497,
            lon=74.3436,
            region="Lahore, Punjab",
            severity_hint=5,
            minutes_ago=88,
            payload={"mock_category": "disease", "pathogen_hint": "dengue"},
        ),
        _sig(
            "pk-dis-hepatitis-khi-monitor-11",
            source="aegis_mock_pk_health",
            kind="wash_related_cluster",
            text=(
                "Karachi Korangi industrial belt — hepatitis A suspicion cluster sampling expanded; bottled-water "
                "advisory corridors issued to schools (training payload)."
            ),
            lat=24.8353,
            lon=67.1270,
            region="Karachi, Sindh",
            severity_hint=5,
            minutes_ago=140,
            payload={"mock_category": "disease"},
        ),
    ]


_MOGETTERS: dict[AlertCategorySlug, Callable[[], list[RawSignalRecord]]] = {
    "accidents": get_mock_signals_accidents,
    "earthquakes": get_mock_signals_earthquakes,
    "floods": get_mock_signals_floods,
    "disease": get_mock_signals_disease_spreads,
}


def normalize_alert_category_slug(raw: str) -> AlertCategorySlug | None:
    s = raw.strip().lower().replace("-", "_")
    if s in ("disease_spreads", "diseasespreads", "disease_spread", "health"):
        s = "disease"
    if s in ("quake", "seismic", "earthquake"):
        s = "earthquakes"
    if s in ("flood", "floods", "inundation"):
        s = "floods"
    if s in ("accidents", "earthquakes", "floods", "disease"):
        return cast(AlertCategorySlug, s)
    return None


async def fetch_mock_signals_for_category_slug(slug: AlertCategorySlug) -> list[RawSignalRecord]:
    return _MOGETTERS[slug]()


async def load_all_mock_pk_category_signals() -> list[RawSignalRecord]:
    parts = await asyncio.gather(
        fetch_mock_signals_for_category_slug("accidents"),
        fetch_mock_signals_for_category_slug("earthquakes"),
        fetch_mock_signals_for_category_slug("floods"),
        fetch_mock_signals_for_category_slug("disease"),
    )
    merged: list[RawSignalRecord] = []
    for p in parts:
        merged.extend(p)
    merged.sort(key=lambda r: r.recorded_at, reverse=True)
    return merged


__all__ = [
    "AlertCategorySlug",
    "normalize_alert_category_slug",
    "get_mock_signals_accidents",
    "get_mock_signals_earthquakes",
    "get_mock_signals_floods",
    "get_mock_signals_disease_spreads",
    "fetch_mock_signals_for_category_slug",
    "load_all_mock_pk_category_signals",
]

"""Load typed `LiveCrisisMockBundle` from JSON (`mock_data/live_crises_mock.json`) or built-ins."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from models.schemas import (
    ClassificationResult,
    CrisisCategory,
    CrisisDossier,
    CrisisStatus,
    FusedSignal,
    LiveCrisisMockBundle,
    NotificationPayload,
    ResourceAllocation,
    ResourceUnit,
    SeverityResult,
)
from tools.mock_data_io import MOCK_ROOT, load_json

logger = logging.getLogger(__name__)


def _window_hours(hours: float) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    return end - timedelta(hours=hours), end


def _builtin_bundle() -> LiveCrisisMockBundle:
    w1_start, w1_end = _window_hours(8.0)
    w2_start, w2_end = _window_hours(3.0)
    created1 = datetime.now(timezone.utc) - timedelta(minutes=52)
    created2 = datetime.now(timezone.utc) - timedelta(minutes=134)

    c1 = CrisisDossier(
        crisis_id="mock-live-lhr-flood-pmd-001",
        status=CrisisStatus.active,
        fused=[
            FusedSignal(
                id="f-mock-lhr-a",
                source_ids=["pmd-synth-01", "openmeteo-pk-02"],
                kind="official",
                summary=(
                    "Heavy monsoon burst over Lahore—PMD red-cell rainfall advisory; localized urban "
                    "ponding on primary drains (Mughalpura–Shalimar corridor)."
                ),
                lat=31.5497,
                lon=74.3436,
                region="Punjab, Pakistan",
                confidence=0.82,
                fused_severity_hint=8,
                window_start=w1_start,
                window_end=w1_end,
            ),
        ],
        classification=ClassificationResult(
            category=CrisisCategory.flood,
            confidence=0.82,
            rationale="Overlapping meteorological advisory + watershed hydrology thresholds for Lahore AOI.",
        ),
        severity=SeverityResult(
            score=8,
            factors=[
                "Peak hourly rainfall exceeding urban design storm in 6h window",
                "Evening commuter + school-route overlap",
                "Compound risk with low-lying commercial blocks",
            ],
            weather_note="PMD bulletin indicates sustained cells through 06:00 PKT tomorrow.",
        ),
        allocation=ResourceAllocation(
            units=[
                ResourceUnit(
                    resource_id="resc-ldr-01",
                    name="Urban rescue detachments",
                    kind="team",
                    quantity_available=6,
                    lat=31.52,
                    lon=74.35,
                    eta_minutes_estimate=25,
                ),
                ResourceUnit(
                    resource_id="pump-mobile-03",
                    name="Mobile dewatering pumps",
                    kind="equipment",
                    quantity_available=14,
                    lat=31.48,
                    lon=74.40,
                    eta_minutes_estimate=35,
                ),
                ResourceUnit(
                    resource_id="amb-lhr-arc",
                    name="EMS ambulance tasking",
                    kind="vehicle",
                    quantity_available=9,
                    lat=31.56,
                    lon=74.31,
                    eta_minutes_estimate=18,
                ),
            ],
            notes=(
                "Lahore rehearsal: prioritize Mughalpura trunk drain checks; stagger pump convoys "
                "to avoid Ring Road choke."
            ),
        ),
        notifications=[
            NotificationPayload(
                channel="ops_console",
                title="Live mock — Lahore rainfall stress",
                body="Synthetic bundle for UI rehearsal; replace with pipeline output in production.",
            ),
        ],
        created_at=created1,
        updated_at=created1,
        meta={
            "mock_live": True,
            "display_name": "Lahore monsoon corridor stress",
            "crisis_type": "Urban Flooding",
            "location_label": "Lahore, Punjab",
            "lat": 31.5497,
            "lon": 74.3436,
        },
    )

    c2 = CrisisDossier(
        crisis_id="mock-live-isb-heatwave-002",
        status=CrisisStatus.monitoring,
        fused=[
            FusedSignal(
                id="f-mock-isb-a",
                source_ids=["pepa-air-iso", "openmeteo-heat-index"],
                kind="sensor",
                summary=(
                    "Heat-index plateau 46–49°C Islamabad foothills—stable synoptic ridge; pediatric "
                    "EMS advisories trending up in F-8 catchment."
                ),
                lat=33.6938,
                lon=73.0652,
                region="Islamabad Capital Territory",
                confidence=0.76,
                fused_severity_hint=7,
                window_start=w2_start,
                window_end=w2_end,
            ),
        ],
        classification=ClassificationResult(
            category=CrisisCategory.heatwave,
            confidence=0.76,
            rationale="Thermal/humidity composite breach with sensor stability over 12h smoothing window.",
        ),
        severity=SeverityResult(
            score=7,
            factors=[
                "Prolonged heat index above policy threshold",
                "Cooling centres at 78% staffed capacity",
                "Night-time recovery window compressed",
            ],
            weather_note="No meaningful relief before 21:30 PKT; light easterlies after midnight.",
        ),
        allocation=ResourceAllocation(
            units=[
                ResourceUnit(
                    resource_id="med-fast-cta",
                    name="Heat-stroke rapid-response teams",
                    kind="team",
                    quantity_available=4,
                    lat=33.72,
                    lon=73.08,
                    eta_minutes_estimate=22,
                ),
                ResourceUnit(
                    resource_id="cool-station-kit",
                    name="Portable cooling station kits",
                    kind="equipment",
                    quantity_available=11,
                    lat=33.68,
                    lon=73.05,
                    eta_minutes_estimate=40,
                ),
            ],
            notes="ICT rehearsal: stagger field teams with night markets; hydrate logistics pre-positioned.",
        ),
        notifications=[
            NotificationPayload(
                channel="sms_drill",
                title="Mock heatwave escalation watch",
                body="Training feed only — corroborates with Open-Meteo heat-index proxy.",
            ),
        ],
        created_at=created2,
        updated_at=created2,
        meta={
            "mock_live": True,
            "display_name": "Islamabad heat plateau",
            "crisis_type": "Heatwave",
            "location_label": "Islamabad, Pakistan",
            "lat": 33.6938,
            "lon": 73.0652,
        },
    )

    return LiveCrisisMockBundle(
        scenario_id="pakistan_demo_v2",
        label="Built-in Lahore flood + ICT heat plateau (live-mock rehearsal)",
        source="builtin_python",
        crises=[c1, c2],
    )


def get_live_crises_mock_bundle() -> LiveCrisisMockBundle:
    candidate = MOCK_ROOT / "live_crises_mock.json"
    if not candidate.is_file():
        return _builtin_bundle()
    try:
        raw = load_json("live_crises_mock.json")
        parsed = LiveCrisisMockBundle.model_validate(raw)
        if parsed.crises:
            return parsed
    except Exception as e:
        logger.warning("live_crises_mock.json invalid — using built-ins (%s)", e)
    return _builtin_bundle()


__all__ = ["get_live_crises_mock_bundle"]

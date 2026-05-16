from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CrisisStatus(str, Enum):
    active = "active"
    monitoring = "monitoring"
    resolved = "resolved"


class CrisisCategory(str, Enum):
    flood = "flood"
    fire = "fire"
    heatwave = "heatwave"
    civil_unrest = "civil_unrest"
    earthquake = "earthquake"
    disease_outbreak = "disease_outbreak"
    accident = "accident"
    infrastructure = "infrastructure"
    power_outage = "power_outage"
    other = "other"


class RawSignalRecord(BaseModel):
    """Single ingested observation (mock file or API payload)."""

    id: str
    source: str
    kind: str = Field(description="sensor | social | news | weather_alert | official")
    text: str = ""
    lat: float
    lon: float
    region: str = ""
    severity_hint: int = Field(ge=1, le=10, default=5)
    recorded_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class FusedSignal(BaseModel):
    id: str
    source_ids: list[str]
    kind: str
    summary: str
    lat: float
    lon: float
    region: str
    confidence: float = Field(ge=0, le=1)
    fused_severity_hint: int = Field(ge=1, le=10)
    window_start: datetime
    window_end: datetime


class ClassificationResult(BaseModel):
    category: CrisisCategory
    confidence: float = Field(ge=0, le=1)
    rationale: str


class SeverityResult(BaseModel):
    score: int = Field(ge=1, le=10)
    factors: list[str]
    weather_note: str | None = None


class ResourceUnit(BaseModel):
    resource_id: str
    name: str
    kind: str
    quantity_available: int
    lat: float
    lon: float
    eta_minutes_estimate: int | None = None


class ResourceAllocation(BaseModel):
    units: list[ResourceUnit]
    notes: str


class NotificationPayload(BaseModel):
    channel: str
    title: str
    body: str
    recipients_hint: str = "ops_console"


class AntigravityTraceStep(BaseModel):
    """One Antigravity orchestration step for audit/UI."""

    agent: str
    phase: str
    detail: str
    inputs_summary: str = ""
    outputs_summary: str = ""
    confidence: float | None = Field(default=None, ge=0, le=1)
    flags: list[str] = Field(default_factory=list)


class SimulatedResponseAction(BaseModel):
    action_id: str
    before_state: str
    response_action: str
    expected_after_state: str
    response_time_improvement_min: int | None = None
    congestion_impact: str = ""
    resource_cost_units: float | None = None
    possible_side_effects: list[str] = Field(default_factory=list)


class PipelineRunRequest(BaseModel):
    include_weather: bool = True
    use_llm_classifier: bool = False
    include_supplemental_mock_signals: bool = Field(
        default=False,
        description="Merge `mock_data/supplemental_crisis_streams.json` for multi-source demos.",
    )
    supplemental_only: bool = Field(
        default=False,
        description="If true, skip live API fetches and use supplemental (+ optional file mock) only.",
    )
    force_multi_incident: bool = Field(
        default=False,
        description="Run constrained multi-incident allocation when ≥2 fused bundles exist.",
    )
    use_signal_cache: bool = Field(
        default=True,
        description="Persist and replay last-good feeds when upstream APIs fail.",
    )
    include_enrichment_signals: bool = Field(
        default=False,
        description="Merge historical vulnerability + public-transport mocks where configured.",
    )
    use_discrete_resource_optimizer: bool = Field(
        default=True,
        description="Use discrete surrogate optimizer for unit selection (bounded search).",
    )


class ScenarioRunRequest(BaseModel):
    scenario_id: str = "g10_flood_plus_heat"
    merge_live_signals: bool = False
    include_weather: bool = True
    use_llm_classifier: bool = False
    include_enrichment_signals: bool = Field(
        default=False,
        description="Scenario runs default clean AOI; set True to add historical + transport mocks.",
    )
    use_signal_cache: bool = True
    use_discrete_resource_optimizer: bool = True


class CrisisDossier(BaseModel):
    crisis_id: str
    status: CrisisStatus = CrisisStatus.active
    fused: list[FusedSignal]
    classification: ClassificationResult
    severity: SeverityResult
    allocation: ResourceAllocation
    notifications: list[NotificationPayload]
    weather_snapshot: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    meta: dict[str, Any] = Field(default_factory=dict)

    def to_firestore_dict(self) -> dict[str, Any]:
        return {
            "crisis_id": self.crisis_id,
            "status": self.status.value,
            "fused": [f.model_dump(mode="json") for f in self.fused],
            "classification": self.classification.model_dump(mode="json"),
            "severity": self.severity.model_dump(mode="json"),
            "allocation": self.allocation.model_dump(mode="json"),
            "notifications": [n.model_dump(mode="json") for n in self.notifications],
            "weather_snapshot": self.weather_snapshot,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "meta": self.meta,
        }

    @classmethod
    def from_firestore_dict(cls, data: dict[str, Any]) -> CrisisDossier:
        if not data:
            raise ValueError("empty crisis document")
        return cls.model_validate(data)


class LiveCrisisMockBundle(BaseModel):
    """Deterministic “live” crisis rows for UI rehearsal / LAN demos (served as API wrapper `data`)."""

    scenario_id: str = "pakistan_demo_v1"
    label: str = "Built-in Pakistan rehearsal bundle"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "builtin"
    crises: list[CrisisDossier]

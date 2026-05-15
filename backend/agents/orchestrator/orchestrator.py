from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from agents.action_simulator.simulator import simulate_response_actions
from agents.crisis_classifier.classifier import classify_crisis, detect_hypothesis_conflict
from agents.detection_gaps.analyzer import assess_detection_gaps
from agents.notifier.notifier import build_notifications
from agents.resource_allocator.allocator import (
    allocate_resources,
    allocate_resources_multi,
    allocate_resources_optimized,
)
from agents.severity_predictor.predictor import predict_severity, severity_evolution_meta
from agents.signal_fusion.dedup import merge_duplicate_fused_bundles
from agents.signal_fusion.fusion import fuse_signals
from agents.staged_alerting.planner import plan_staged_alerts
from models.schemas import (
    AntigravityTraceStep,
    ClassificationResult,
    CrisisCategory,
    CrisisDossier,
    FusedSignal,
    NotificationPayload,
    PipelineRunRequest,
    RawSignalRecord,
    ScenarioRunRequest,
    SeverityResult,
)
from store.repository import CrisisRepository, get_repository
from tools.credibility import contradiction_level, score_raw_signal
from tools.open_meteo import forecast_snapshot
from tools.signals_loader import load_live_raw_signals
from tools.weather_cache import weather_cache_get, weather_cache_put
from utils.ids import new_crisis_id


def _trace_step(
    agent: str,
    phase: str,
    detail: str,
    *,
    inputs_summary: str = "",
    outputs_summary: str = "",
    confidence: float | None = None,
    flags: list[str] | None = None,
) -> dict[str, Any]:
    return AntigravityTraceStep(
        agent=agent,
        phase=phase,
        detail=detail,
        inputs_summary=inputs_summary,
        outputs_summary=outputs_summary,
        confidence=confidence,
        flags=flags or [],
    ).model_dump(mode="json")


def _raw_for_fused(f: FusedSignal, all_raw: list[RawSignalRecord]) -> list[RawSignalRecord]:
    ids = set(f.source_ids)
    return [r for r in all_raw if r.id in ids]


def _audit(entries: list[dict[str, Any]], event: str, **kwargs: Any) -> None:
    row = {"ts": datetime.now(timezone.utc).isoformat(), "event": event, **kwargs}
    entries.append(row)


class CrisisOrchestrator:
    def __init__(self, repo: CrisisRepository | None = None) -> None:
        self._repo = repo or get_repository()

    async def run_live_pipeline(
        self,
        *,
        request: PipelineRunRequest | None = None,
    ) -> CrisisDossier:
        req = request or PipelineRunRequest()
        traces: list[dict[str, Any]] = []
        audit_log: list[dict[str, Any]] = []
        ingest_meta: dict[str, Any] = {}
        _audit(audit_log, "pipeline_start", request=req.model_dump(mode="json"))

        raw = await load_live_raw_signals(
            include_supplemental=req.include_supplemental_mock_signals,
            supplemental_only=req.supplemental_only,
            out_meta=ingest_meta,
            use_signal_cache=req.use_signal_cache,
            include_enrichment_signals=req.include_enrichment_signals,
        )
        _audit(
            audit_log,
            "signals_ingested",
            count=len(raw),
            degraded=bool(ingest_meta.get("degraded_mode")),
        )
        traces.append(
            _trace_step(
                "signal_ingest",
                "pull",
                "Fetched hazard feeds, cache fallback, enrichment (historical + transport), optional supplemental mocks.",
                inputs_summary=(
                    f"supplemental_only={req.supplemental_only}, "
                    f"merge_supplemental={req.include_supplemental_mock_signals}, "
                    f"cache={req.use_signal_cache}, enrichment={req.include_enrichment_signals}"
                ),
                outputs_summary=f"{len(raw)} raw rows; counts={ingest_meta.get('signal_source_counts', {})}",
                confidence=0.92 if not ingest_meta.get("degraded_mode") else 0.55,
                flags=["degraded_source"] if ingest_meta.get("degraded_mode") else [],
            )
        )

        cred_profiles = [score_raw_signal(r) for r in raw]
        traces.append(
            _trace_step(
                "credibility_scorer",
                "score",
                "Per-signal trust, geo confidence, velocity, contradiction flags.",
                outputs_summary=f"scored {len(cred_profiles)} observations",
                confidence=0.78,
            )
        )

        fused = fuse_signals(raw)
        traces.append(
            _trace_step(
                "fusion_agent",
                "cluster",
                "Spatiotemporal clustering with incident_group partitions.",
                outputs_summary=f"{len(fused)} fused bundle(s) pre-dedup",
                confidence=round(min(1.0, 0.55 + 0.12 * max(1, len(fused))), 3),
            )
        )

        fused, dedup_audit = merge_duplicate_fused_bundles(fused)
        if dedup_audit:
            _audit(audit_log, "duplicate_incident_merge", merges=dedup_audit)
            traces.append(
                _trace_step(
                    "dedup_agent",
                    "merge",
                    "Merged near-duplicate fused bundles (same incident, repeated ingest).",
                    outputs_summary=str(dedup_audit)[:420],
                    confidence=0.84,
                    flags=["deduplication"],
                )
            )

        traces.append(
            _trace_step(
                "fusion_agent",
                "dedup_complete",
                "Post-deduplication fuse set ready for classification.",
                outputs_summary=f"{len(fused)} fused bundle(s)",
                confidence=0.86,
            )
        )

        multi = (
            len(fused) >= 2
            and (req.force_multi_incident or req.include_supplemental_mock_signals)
        )
        weather: dict[str, Any] | None = None
        weather_secondary: dict[str, Any] | None = None

        if fused:
            centroid_lat = sum(f.lat for f in fused) / len(fused)
            centroid_lon = sum(f.lon for f in fused) / len(fused)
        else:
            centroid_lat, centroid_lon = 24.8607, 67.0011

        if req.include_weather:
            try:
                weather = await forecast_snapshot(centroid_lat, centroid_lon)
                weather_cache_put(centroid_lat, centroid_lon, weather)
            except Exception:
                weather = weather_cache_get(centroid_lat, centroid_lon)
                if weather:
                    ingest_meta.setdefault("degraded_mode", []).append("open_meteo_cache_fallback")
                    _audit(audit_log, "weather_cache_fallback", lat=centroid_lat, lon=centroid_lon)
                else:
                    weather = None
                    ingest_meta.setdefault("degraded_mode", []).append("open_meteo_primary_failed")
            if multi and len(fused) >= 2:
                try:
                    weather_secondary = await forecast_snapshot(fused[1].lat, fused[1].lon)
                    weather_cache_put(fused[1].lat, fused[1].lon, weather_secondary)
                except Exception:
                    weather_secondary = weather_cache_get(fused[1].lat, fused[1].lon)
                    if weather_secondary:
                        ingest_meta.setdefault("degraded_mode", []).append(
                            "open_meteo_secondary_cache_fallback"
                        )

        classification: ClassificationResult
        severity: SeverityResult
        allocation: Any
        secondary_block: dict[str, Any] | None = None
        trade_sentence = ""

        _alloc_single = (
            allocate_resources_optimized if req.use_discrete_resource_optimizer else allocate_resources
        )

        if multi and len(fused) >= 2:
            r0 = _raw_for_fused(fused[0], raw)
            r1 = _raw_for_fused(fused[1], raw)
            cls_a = await classify_crisis(
                [fused[0]], use_llm=req.use_llm_classifier, raw_context=r0
            )
            cls_b = await classify_crisis(
                [fused[1]], use_llm=req.use_llm_classifier, raw_context=r1
            )
            sev_a = predict_severity([fused[0]], cls_a, weather=weather)
            sev_b = predict_severity([fused[1]], cls_b, weather=weather_secondary or weather)
            traces.append(
                _trace_step(
                    "classifier",
                    "label",
                    "Independent labels for simultaneous bundles (Antigravity policy).",
                    outputs_summary=f"A:{cls_a.category.value}@{cls_a.confidence:.2f}, B:{cls_b.category.value}@{cls_b.confidence:.2f}",
                    confidence=round((cls_a.confidence + cls_b.confidence) / 2, 3),
                )
            )
            allocation, trade_sentence = allocate_resources_multi(
                [
                    (fused[0].lat, fused[0].lon, cls_a, sev_a),
                    (fused[1].lat, fused[1].lon, cls_b, sev_b),
                ],
                use_discrete_optimizer=req.use_discrete_resource_optimizer,
            )
            traces.append(
                _trace_step(
                    "allocator",
                    "optimize",
                    "Constrained multi-incident discrete surrogate optimization + trade-offs.",
                    outputs_summary=allocation.notes[:420],
                    confidence=0.74,
                    flags=["resource_tradeoff", "discrete_optimizer"],
                )
            )
            if sev_b.score > sev_a.score or (
                sev_b.score == sev_a.score and cls_b.confidence > cls_a.confidence
            ):
                classification, severity = cls_b, sev_b
                secondary_block = {
                    "fused_id": fused[0].id,
                    "classification": cls_a.model_dump(mode="json"),
                    "severity": sev_a.model_dump(mode="json"),
                    "summary": fused[0].summary[:280],
                }
            else:
                classification, severity = cls_a, sev_a
                secondary_block = {
                    "fused_id": fused[1].id,
                    "classification": cls_b.model_dump(mode="json"),
                    "severity": sev_b.model_dump(mode="json"),
                    "summary": fused[1].summary[:280],
                }
        else:
            classification = await classify_crisis(
                fused, use_llm=req.use_llm_classifier, raw_context=raw
            )
            traces.append(
                _trace_step(
                    "classifier",
                    "label",
                    "Crisis taxonomy + rationale (keyword + optional Antigravity LLM).",
                    outputs_summary=f"{classification.category.value} conf={classification.confidence}",
                    confidence=classification.confidence,
                )
            )
            severity = predict_severity(fused, classification, weather=weather)
            allocation = _alloc_single(
                centroid_lat, centroid_lon, classification, severity
            )
            traces.append(
                _trace_step(
                    "allocator",
                    "optimize",
                    "Discrete surrogate or greedy deployment under tiered severity budget.",
                    outputs_summary=allocation.notes[:320],
                    confidence=0.8,
                    flags=["discrete_optimizer"] if req.use_discrete_resource_optimizer else [],
                )
            )

        gaps = assess_detection_gaps(
            raw,
            fused,
            classification,
            ingest_degraded=bool(ingest_meta.get("degraded_mode")),
        )
        if gaps.get("escalate_manual_review"):
            traces.append(
                _trace_step(
                    "recall_agent",
                    "fn_bias",
                    "Low feed confidence / degraded ingest — bias to under-detection; manual watchstander ping.",
                    outputs_summary=str(gaps.get("risks"))[:420],
                    confidence=0.6,
                    flags=["false_negative_guard", "manual_escalation"],
                )
            )
            _audit(audit_log, "detection_gap_escalation", risks=gaps.get("risks"))

        traces.append(
            _trace_step(
                "severity_agent",
                "predict",
                "Score + weather-linked adjustments + evolution envelope.",
                outputs_summary=f"score={severity.score}; factors={len(severity.factors)}",
                confidence=round(classification.confidence * 0.95, 3),
            )
        )

        hypothesis_conflict = detect_hypothesis_conflict(classification, raw)
        contra = contradiction_level(raw)
        evolution = severity_evolution_meta(fused, classification, severity)

        staged_plan = plan_staged_alerts(
            classification_confidence=classification.confidence,
            contradiction_level=contra,
            severity_score=severity.score,
            hypothesis_conflict_level=float(hypothesis_conflict.get("level") or 0),
        )
        traces.append(
            _trace_step(
                "staged_alert_policy",
                "plan",
                "Concentric rings, delays, and per-ring rate limits to mitigate evac congestion.",
                outputs_summary=f"rings={len(staged_plan.get('rings', []))}, evac_staging={staged_plan.get('evacuation_staging')}",
                confidence=0.73,
                flags=["staged_messaging"],
            )
        )

        reclass_stub: dict[str, Any] | None = None
        if hypothesis_conflict.get("level", 0) >= 0.65 and classification.category == CrisisCategory.flood:
            reclass_stub = {
                "if_field_confirms": "water_main_burst_only",
                "updated_primary_category": CrisisCategory.infrastructure.value,
                "actions": [
                    "Patch dossier classification to infrastructure / water.",
                    "Notify CDA water ops with valve isolation sketch.",
                    "Append audit entry `classification_corrected`.",
                ],
            }
            _audit(
                audit_log,
                "reclassification_pending",
                from_category=classification.category.value,
                to_category=CrisisCategory.infrastructure.value,
            )

        if hypothesis_conflict.get("level", 0) >= 0.65:
            traces.append(
                _trace_step(
                    "verification_agent",
                    "escalate",
                    "Hold or retract broad public flood wording pending mains verification.",
                    outputs_summary="; ".join(hypothesis_conflict.get("notes") or []),
                    confidence=0.66,
                    flags=["pending_field_truth"],
                )
            )

        crisis_id = new_crisis_id()
        dossier = CrisisDossier(
            crisis_id=crisis_id,
            fused=fused,
            classification=classification,
            severity=severity,
            allocation=allocation,
            notifications=[],
            weather_snapshot=weather,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            meta={
                "signals_ingested": len(raw),
                "fusion_bundles": len(fused),
                "signal_credibility": cred_profiles[:40],
                "ingest_meta": ingest_meta,
                "hypothesis_conflict": hypothesis_conflict,
                "contradiction_level_global": round(contra, 3),
                "severity_evolution": evolution,
                "resource_tradeoffs": trade_sentence,
                "secondary_incident": secondary_block,
                "detection_gaps": gaps,
                "staged_alert_plan": staged_plan,
                "recovery_playbook": reclass_stub,
                "audit_log": audit_log,
            },
        )

        if hypothesis_conflict.get("level", 0) >= 0.65:
            traces.append(
                _trace_step(
                    "recovery_agent",
                    "retract_stub",
                    "Queue public correction + utility-first messaging if mains confirmed.",
                    outputs_summary="Retract broad flood evacuation; shift to localized water-service advisory.",
                    confidence=0.58,
                    flags=["recovery_retraction"],
                )
            )
            dossier.notifications.append(
                NotificationPayload(
                    channel="public_retraction_stub",
                    title="Correction — pending verification",
                    body=(
                        "Earlier push used flood template; field engineers investigating pressurized main breach. "
                        "Follow official ICT channel for service & routing updates."
                    ),
                    recipients_hint="geo_fenced_residents",
                )
            )
            _audit(
                audit_log,
                "public_retraction_queued",
                channels=["public_retraction_stub"],
                apology_template="Localized service disruption language; regret for alarm if mains-only.",
            )

        dossier.notifications.extend(build_notifications(dossier))

        sim = simulate_response_actions(dossier)
        dossier.meta["action_simulation"] = [s.model_dump(mode="json") for s in sim]
        traces.append(
            _trace_step(
                "simulation_agent",
                "dry_run",
                "Before/after blocks for traffic, EMS, utility, and public comms.",
                outputs_summary=f"{len(sim)} simulated actions",
                confidence=0.72,
            )
        )
        traces.append(
            _trace_step(
                "comms_agent",
                "notify_fanout",
                "Stakeholder-tailored payloads (public, EMS, hospitals, utility, transport, media).",
                outputs_summary=f"{len(dossier.notifications)} notifications",
                confidence=0.75,
            )
        )

        dossier.meta["antigravity_trace"] = traces
        _audit(audit_log, "pipeline_complete", crisis_id=crisis_id)
        await self._repo.save(dossier)
        return dossier

    async def run_scenario(self, body: ScenarioRunRequest) -> CrisisDossier:
        pipeline_req = PipelineRunRequest(
            include_weather=body.include_weather,
            use_llm_classifier=body.use_llm_classifier,
            include_supplemental_mock_signals=True,
            supplemental_only=not body.merge_live_signals,
            force_multi_incident=True,
            include_enrichment_signals=body.include_enrichment_signals,
            use_signal_cache=body.use_signal_cache,
            use_discrete_resource_optimizer=body.use_discrete_resource_optimizer,
        )
        return await self.run_live_pipeline(request=pipeline_req)


async def run_default_pipeline(
    *,
    request: PipelineRunRequest | None = None,
    repo: CrisisRepository | None = None,
) -> CrisisDossier:
    orch = CrisisOrchestrator(repo=repo)
    return await orch.run_live_pipeline(request=request)


async def run_scenario_pipeline(
    *,
    request: ScenarioRunRequest,
    repo: CrisisRepository | None = None,
) -> CrisisDossier:
    orch = CrisisOrchestrator(repo=repo)
    return await orch.run_scenario(request)

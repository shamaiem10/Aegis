from __future__ import annotations

from typing import Any

from models.schemas import ClassificationResult, FusedSignal, RawSignalRecord
from tools.credibility import score_raw_signal


def assess_detection_gaps(
    raw: list[RawSignalRecord],
    fused: list[FusedSignal],
    classification: ClassificationResult | None,
    *,
    ingest_degraded: bool,
) -> dict[str, Any]:
    """False-negative / low-confidence pathways and manual escalation hooks."""
    risks: list[dict[str, Any]] = []
    max_cred = 0.0
    for r in raw:
        max_cred = max(max_cred, score_raw_signal(r).get("credibility") or 0.0)

    if len(raw) == 0:
        risks.append(
            {
                "code": "empty_feed",
                "detail": "No observations ingested — treat as CRITICAL blind spot; manual watchstander.",
                "severity": "critical",
            }
        )
    elif len(raw) < 3 and len(fused) == 0:
        risks.append(
            {
                "code": "sparse_no_fusion",
                "detail": "Sparse feed and nothing fused — possible emerging incident below clustering threshold.",
                "severity": "high",
            }
        )

    if classification is not None and classification.confidence < 0.48:
        risks.append(
            {
                "code": "low_confidence_classification",
                "detail": "Label confidence under threshold — hold automatic mass notifications; widen sensor net.",
                "severity": "medium",
            }
        )

    if max_cred < 0.42 and len(raw) >= 2:
        risks.append(
            {
                "code": "low_trust_cluster",
                "detail": "Crowd signals only with weak credibility — request official corroboration.",
                "severity": "medium",
            }
        )

    if ingest_degraded:
        risks.append(
            {
                "code": "degraded_ingest",
                "detail": "One or more APIs failed — recall-oriented bias: assume under-detection until verified.",
                "severity": "high",
            }
        )

    escalate = any(r.get("severity") in {"critical", "high"} for r in risks) or len(risks) >= 2

    return {
        "risks": risks,
        "escalate_manual_review": escalate,
        "max_source_credibility": round(max_cred, 3),
    }

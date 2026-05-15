from __future__ import annotations

from typing import Any


def plan_staged_alerts(
    *,
    classification_confidence: float,
    contradiction_level: float,
    severity_score: int,
    hypothesis_conflict_level: float,
) -> dict[str, Any]:
    """Executable staged alerting: concentric rings, delays, and rate limits to reduce evac congestion."""
    high_uncertainty = contradiction_level >= 0.45 or hypothesis_conflict_level >= 0.55
    inner_delay = 0
    middle_delay = 150 if high_uncertainty else 75
    outer_delay = 300 if high_uncertainty else 180

    inner_rate = 24 if severity_score >= 8 else 18
    middle_rate = 12
    outer_rate = 6

    return {
        "version": 1,
        "rings": [
            {
                "id": "inner",
                "radius_km": 0.7,
                "delay_sec": inner_delay,
                "channels": ["push_high_priority", "sms_stub"],
                "max_messages_per_minute": inner_rate,
                "template_tone": "advisory_no_mass_evac" if high_uncertainty else "protect_in_place",
            },
            {
                "id": "middle",
                "radius_km": 2.2,
                "delay_sec": middle_delay,
                "channels": ["push_standard", "variable_message_signs_stub"],
                "max_messages_per_minute": middle_rate,
                "template_tone": "staged_movement",
            },
            {
                "id": "outer",
                "radius_km": 7.5,
                "delay_sec": outer_delay,
                "channels": ["public_web_feed", "media_command"],
                "max_messages_per_minute": outer_rate,
                "template_tone": "awareness_only",
            },
        ],
        "evacuation_staging": high_uncertainty or severity_score >= 7,
        "policy_rationale": (
            "Delay outer ring and throttle push rate when sensors conflict or mains hypothesis competes "
            "with flood narrative — reduces spontaneous convergent traffic (evac congestion side-effect)."
        ),
        "confidence_gating": round(classification_confidence, 3),
    }

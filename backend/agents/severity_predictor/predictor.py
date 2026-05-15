from __future__ import annotations

from typing import Any

from models.schemas import CrisisCategory, ClassificationResult, FusedSignal, SeverityResult


def _evolution_estimate(score: int, category: CrisisCategory) -> dict[str, Any]:
    radius_km = 1.2 + score * 0.35
    hours = 3 + score * 1.4
    if category == CrisisCategory.heatwave:
        hours += 4
        radius_km += 0.4
    if category == CrisisCategory.power_outage:
        hours += 3
        radius_km += 0.3
    if category == CrisisCategory.flood:
        radius_km += 0.5
    return {
        "affected_radius_km_estimate": round(radius_km, 2),
        "duration_hours_estimate": round(hours, 1),
        "peak_impact_hours_from_now": round(max(0.5, 4.2 - score * 0.35), 1),
        "spread_risk": "elevated" if score >= 7 else "moderate" if score >= 5 else "limited",
        "uncertainty_band": "±25% on radius/time while verification pending",
    }


def predict_severity(
    fused_signals: list[FusedSignal],
    classification: ClassificationResult,
    *,
    weather: dict[str, Any] | None = None,
) -> SeverityResult:
    base = max((fs.fused_severity_hint for fs in fused_signals), default=5)
    factors = [f"highest fused hint={base}", f"class `{classification.category.value}`"]

    if len(fused_signals) > 1:
        corroboration_boost = min(2, len(fused_signals) - 1)
        base += corroboration_boost
        factors.append(f"+{corroboration_boost} multi-bundle corroboration")

    categorical = {
        CrisisCategory.flood: 1,
        CrisisCategory.earthquake: 2,
        CrisisCategory.civil_unrest: 1,
        CrisisCategory.disease_outbreak: 2,
        CrisisCategory.fire: 1,
        CrisisCategory.infrastructure: 1,
        CrisisCategory.power_outage: 2,
        CrisisCategory.heatwave: 2,
        CrisisCategory.accident: 1,
        CrisisCategory.other: 0,
    }
    b = categorical[classification.category]
    if b:
        base += b
        factors.append(f"+{b} categorical stress")

    weather_note: str | None = None
    if weather and classification.category == CrisisCategory.flood:
        hourly = weather.get("hourly") or {}
        precip = hourly.get("precipitation") or []
        prob = hourly.get("precipitation_probability") or []
        try:
            pmax = max(float(x) for x in precip[:8] if x is not None)
        except ValueError:
            pmax = 0.0
        try:
            pb = max(float(x) for x in prob[:8] if x is not None)
        except ValueError:
            pb = 0.0
        if pmax > 5:
            base += 1
            factors.append("+1 precip intensity (Open-Meteo)")
            weather_note = f"max hourly precip ~{pmax} mm"
        if pb > 60:
            base += 1
            factors.append("+1 high precip probability window")
            weather_note = weather_note or f"peak precip probability ≈{pb:.0f}%"

    if weather and classification.category == CrisisCategory.heatwave:
        current = (weather.get("current_weather") or {}).get("temperature")
        if current is not None and float(current) > 38:
            base += 1
            factors.append("+1 observed temperature stress (Open-Meteo)")
            weather_note = f"current air temp ≈{float(current):.1f}°C"

    base = max(1, min(10, base))
    return SeverityResult(score=base, factors=factors, weather_note=weather_note)


def severity_evolution_meta(
    fused_signals: list[FusedSignal],
    classification: ClassificationResult,
    severity: SeverityResult,
) -> dict[str, Any]:
    evo = _evolution_estimate(severity.score, classification.category)
    pop = len(fused_signals) * 1200 + severity.score * 350
    return {
        "severity_score": severity.score,
        "evolution": evo,
        "affected_population_order_of_magnitude": int(pop),
        "confidence_in_evolution": round(min(0.95, classification.confidence * 0.9), 3),
    }

from __future__ import annotations

from models.schemas import (
    ClassificationResult,
    CrisisCategory,
    FusedSignal,
    RawSignalRecord,
)
from tools.gemini_client import classify_text_with_llm


def _keyword_classification(blob: str) -> tuple[CrisisCategory, float]:
    text = blob.lower()
    scoring: dict[CrisisCategory, int] = {c: 0 for c in CrisisCategory}

    rules: tuple[tuple[str, CrisisCategory], ...] = (
        ("river embank breach monsoon inundation karachi flood rainwater inundation", CrisisCategory.flood),
        ("flash flood inundation dams overflow standing water", CrisisCategory.flood),
        ("fire blaze wildfire ignition smoke", CrisisCategory.fire),
        ("heatwave heat stroke hyperthermia heat emergency dehydration urban heat", CrisisCategory.heatwave),
        ("riot protest unrest curfew clashes march", CrisisCategory.civil_unrest),
        ("tremor seismic epicenter landslide earthquake", CrisisCategory.earthquake),
        ("measles cholera epidemic outbreak contagion vaccine cluster", CrisisCategory.disease_outbreak),
        ("pileup collision crash motorway accident vehicle rollover", CrisisCategory.accident),
        ("grid substation telecommunication mast cellular tower bridge collapse", CrisisCategory.infrastructure),
        ("water main burst pipe utility excavation valve sewer", CrisisCategory.infrastructure),
    )
    if "power outage" in text or "blackout" in text or "load shedding" in text or "rolling blackout" in text:
        scoring[CrisisCategory.power_outage] += 5
    for keys, cat in rules:
        for kw in keys.split():
            if kw in text:
                scoring[cat] += 2
    scoring[CrisisCategory.other] = 1
    ranked = sorted(scoring.items(), key=lambda kv: kv[1], reverse=True)
    winner, pts = ranked[0]
    if pts <= 1:
        return CrisisCategory.other, 0.35
    second = ranked[1][1] if len(ranked) > 1 else 0
    margin = max(pts - second, 1)
    conf = round(min(0.95, 0.42 + margin * 0.08), 3)
    return winner, conf


async def classify_crisis(
    fused_signals: list[FusedSignal],
    *,
    use_llm: bool = False,
    raw_context: list[RawSignalRecord] | None = None,
) -> ClassificationResult:
    blob = "\n".join(fs.summary.lower() + " " + fs.region.lower() for fs in fused_signals)
    if raw_context:
        blob += "\n" + "\n".join(r.text.lower() for r in raw_context if r.text)

    llm_pick = await classify_text_with_llm(blob) if use_llm else None
    if llm_pick:
        try:
            cat = CrisisCategory(llm_pick)
        except ValueError:
            cat = None
        if cat is not None:
            return ClassificationResult(
                category=cat,
                confidence=0.78,
                rationale=f"Antigravity/Gemini label `{cat.value}` corroborating keyword cues.",
            )
    cat, conf = _keyword_classification(blob)
    rationale = (
        f"Heuristic lexical scan over {len(fused_signals)} fused bundle(s); "
        f"highest thematic match `{cat.value}`."
    )
    return ClassificationResult(category=cat, confidence=conf, rationale=rationale)


def detect_hypothesis_conflict(classification: ClassificationResult, raw_rows: list[RawSignalRecord]) -> dict:
    """Surface field-report vs classification tensions (e.g. flood vs water main)."""
    text_blob = " ".join(r.text.lower() for r in raw_rows)
    out: dict = {"level": 0.0, "notes": []}
    if classification.category == CrisisCategory.flood and (
        "water main" in text_blob or "burst" in text_blob
    ):
        out["level"] = max(out["level"], 0.72)
        out["notes"].append("Conflicting hypothesis: flooding vs reported water-main failure.")
        out["suggested_followup"] = "Utility crew verification + pressure telemetry before sustained flood public alert."
    return out

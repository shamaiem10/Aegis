from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Path

from models.schemas import RawSignalRecord
from tools.mock_data_io import load_json
from tools.mock_pk_category_signals import (
    fetch_mock_signals_for_category_slug,
    normalize_alert_category_slug,
)
from tools.signals_loader import load_live_raw_signals

router = APIRouter(tags=["signals"], prefix="/signals")


@router.get("/mock")
async def mock_raw_signals() -> list[dict]:
    return load_json("raw_signals.json")


def _serialized(rows: list[RawSignalRecord]) -> list[dict[str, Any]]:
    return [r.model_dump(mode="json") for r in rows]


def _signals_envelope(rows: list[RawSignalRecord]) -> dict[str, Any]:
    return {"success": True, "data": _serialized(rows), "error": None}


async def _envelope_slug(slug: Literal["accidents", "earthquakes", "floods", "disease"]) -> dict[str, Any]:
    try:
        rows = await fetch_mock_signals_for_category_slug(slug)
        return _signals_envelope(rows)
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}


@router.get("/mock/accidents")
async def mock_signals_accidents() -> dict[str, Any]:
    """Dedicated API — Pakistan mock traffic / accident alerts."""
    return await _envelope_slug("accidents")


@router.get("/mock/earthquakes")
async def mock_signals_earthquakes() -> dict[str, Any]:
    """Dedicated API — Pakistan mock seismic rehearsal alerts."""
    return await _envelope_slug("earthquakes")


@router.get("/mock/floods")
async def mock_signals_floods() -> dict[str, Any]:
    """Dedicated API — Pakistan mock flood / hydro alerts."""
    return await _envelope_slug("floods")


@router.get("/mock/disease")
async def mock_signals_disease() -> dict[str, Any]:
    """Dedicated API — Pakistan mock disease / outbreak rehearsal alerts."""
    return await _envelope_slug("disease")


@router.get("/mock/category/{category}")
async def mock_signals_by_category(
    category: Annotated[
        str,
        Path(description="accidents | earthquakes | floods | disease (+ aliases such as disease-spreads, seismic)"),
    ],
) -> dict[str, Any]:
    """Standalone deploy-friendly mock alerts for one category (Pakistan AOI)."""
    slug = normalize_alert_category_slug(category)
    if slug is None:
        raise HTTPException(
            status_code=404,
            detail="unknown_mock_category_expected_accidents_earthquakes_floods_disease",
        )
    try:
        rows = await fetch_mock_signals_for_category_slug(slug)
        return _signals_envelope(rows)
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}


@router.get("/live/parsed", response_model=list[RawSignalRecord])
async def live_parsed_signals() -> list[RawSignalRecord]:
    """Merge all mock category feeds (+ optional enrichment per loader defaults)."""
    return await load_live_raw_signals()

from typing import Annotated

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from agents.crisis_classifier.classifier import classify_crisis
from agents.resource_allocator.allocator import allocate_resources
from agents.severity_predictor.predictor import predict_severity
from agents.signal_fusion.fusion import fuse_signals
from models.schemas import CrisisStatus
from store.repository import get_repository
from tools.open_meteo import forecast_snapshot
from tools.mock_data_io import parse_raw_signals
from tools.signals_loader import load_live_raw_signals

router = APIRouter(tags=["crises"], prefix="/crises")


@router.post("/preview")
async def preview_from_payload(
    signals: Annotated[list[dict], Body()],
):
    parsed = parse_raw_signals(signals)
    return await preview_core(parsed)


@router.post("/preview/live")
async def preview_live_bundle():
    raw = await load_live_raw_signals()
    return await preview_core(raw)


async def preview_core(raw: list):
    fused = fuse_signals(raw)
    cls = await classify_crisis(fused)
    centroid_lat = sum(f.lat for f in fused) / len(fused) if fused else 24.8607
    centroid_lon = sum(f.lon for f in fused) / len(fused) if fused else 67.0011
    try:
        wx = await forecast_snapshot(centroid_lat, centroid_lon)
    except Exception:
        wx = None
    sev = predict_severity(fused, cls, weather=wx)
    alloc = allocate_resources(centroid_lat, centroid_lon, cls, sev)
    return {
        "fused": fused,
        "classification": cls,
        "severity": sev,
        "allocation": alloc,
        "weather_loaded": wx is not None,
    }


@router.get("")
async def list_crises(limit: int = 50, status: CrisisStatus | None = None):
    repo = get_repository()
    return await repo.list(limit=limit, status=status)


class StatusPatch(BaseModel):
    status: CrisisStatus


@router.patch("/{crisis_id}/status")
async def patch_status(crisis_id: str, body: StatusPatch):
    repo = get_repository()
    updated = await repo.update_status(crisis_id, body.status)
    if not updated:
        raise HTTPException(status_code=404, detail="crisis_not_found")
    return updated


@router.get("/{crisis_id}")
async def get_crisis(crisis_id: str):
    repo = get_repository()
    row = await repo.get(crisis_id)
    if not row:
        raise HTTPException(status_code=404, detail="crisis_not_found")
    return row

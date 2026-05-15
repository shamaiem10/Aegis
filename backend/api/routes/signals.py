from fastapi import APIRouter

from models.schemas import RawSignalRecord
from tools.mock_data_io import load_json
from tools.signals_loader import load_live_raw_signals

router = APIRouter(tags=["signals"], prefix="/signals")


@router.get("/mock")
async def mock_raw_signals() -> list[dict]:
    return load_json("raw_signals.json")


@router.get("/live/parsed", response_model=list[RawSignalRecord])
async def live_parsed_signals() -> list[RawSignalRecord]:
    return await load_live_raw_signals()

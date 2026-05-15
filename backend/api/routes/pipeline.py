from fastapi import APIRouter, HTTPException

from agents.orchestrator.orchestrator import run_default_pipeline, run_scenario_pipeline
from models.schemas import PipelineRunRequest, ScenarioRunRequest
from store.repository import get_repository

router = APIRouter(tags=["pipeline"], prefix="/pipeline")


@router.post("/run")
async def run_pipeline(body: PipelineRunRequest | None = None):
    dossier = await run_default_pipeline(request=body or PipelineRunRequest())
    return dossier


@router.post("/run/scenario")
async def run_pipeline_scenario(body: ScenarioRunRequest | None = None):
    """Stress scenario: Islamabad G-10 hydro signals + I-9 heat (see `agents.md`)."""
    dossier = await run_scenario_pipeline(request=body or ScenarioRunRequest())
    return dossier


@router.get("/latest")
async def get_latest_pipeline_dossier():
    """Most recent crisis dossier from the repository (full `meta` for mobile orchestration UI)."""
    repo = get_repository()
    rows = await repo.list(limit=1)
    if not rows:
        raise HTTPException(status_code=404, detail="no_dossiers_yet_run_pipeline_first")
    return rows[0]

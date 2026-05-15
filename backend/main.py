"""Aegis Crisis API — FastAPI app entrypoint.

Mobile dev (Expo on a physical phone): run with ``uvicorn main:app --host 0.0.0.0 --port 8000``
so the device can reach the PC via LAN IP (not 127.0.0.1).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import crises_router, health_router, pipeline_router, signals_router, weather_router
from config import cors_origin_list, get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = app
    settings = get_settings()
    cred_path = (settings.google_application_credentials or "").strip()
    if cred_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path
    logger.info("Aegis backend starting (%s)", settings.app_env)
    yield
    logger.info("Aegis backend shutting down")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Aegis Crisis API",
        description="Signal fusion → classification → severity → allocation → notifications",
        version="1.0.0",
        lifespan=lifespan,
        debug=settings.debug,
    )
    origins = cors_origin_list(settings.cors_origins)
    if origins == ["*"]:
        cred = False
    else:
        cred = True
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=cred,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    api = "/api/v1"
    app.include_router(pipeline_router, prefix=api)
    app.include_router(crises_router, prefix=api)
    app.include_router(signals_router, prefix=api)
    app.include_router(weather_router, prefix=api)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    s = get_settings()
    uvicorn.run("main:app", host="0.0.0.0", port=s.port, reload=s.debug)

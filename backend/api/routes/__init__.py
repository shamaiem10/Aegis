from api.routes.crises import router as crises_router
from api.routes.health import router as health_router
from api.routes.pipeline import router as pipeline_router
from api.routes.signals import router as signals_router
from api.routes.weather import router as weather_router

__all__ = [
    "crises_router",
    "health_router",
    "pipeline_router",
    "signals_router",
    "weather_router",
]

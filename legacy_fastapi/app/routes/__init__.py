"""
API routes package initialization.
"""
from backend.app.routes.api_events import router as events_router
from backend.app.routes.api_health import router as health_router
from backend.app.routes.api_statistics import router as statistics_router
from backend.app.routes.api_ingest import router as ingest_router
from backend.app.routes.api_persistence import router as persistence_router

__all__ = [
    "events_router",
    "health_router",
    "statistics_router",
    "ingest_router",
    "persistence_router",
]

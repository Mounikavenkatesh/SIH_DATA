"""
Health check and system diagnostics endpoint.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
from datetime import datetime, timezone

from backend.app.database.connection import get_db
from backend.app.config import settings
from backend.app.models.thermal_event import ThermalEvent
from backend.app.models.persistence_group import PersistenceGroup

router = APIRouter(tags=["Health & System"])


@router.get("/health", summary="System Health & Diagnostic Status")
def get_system_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns system health, database connection state, pipeline mode,
    and event record counts.
    """
    db_healthy = False
    event_count = 0
    cluster_count = 0

    try:
        db.execute(text("SELECT 1"))
        db_healthy = True
        event_count = db.query(ThermalEvent).count()
        cluster_count = db.query(PersistenceGroup).count()
    except Exception as ex:
        db_healthy = False

    return {
        "status": "healthy" if db_healthy else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": {
            "connected": db_healthy,
            "engine": "SQLite" if "sqlite" in settings.DATABASE_URL else "PostgreSQL",
            "total_events": event_count,
            "total_persistence_groups": cluster_count
        },
        "modules": {
            "firms_ingestion": "live_configured" if settings.FIRMS_MAP_KEY else "mock_demo_ready",
            "osm_enrichment": "active",
            "land_cover_provider": settings.LAND_COVER_PROVIDER,
            "persistence_clustering": "active",
            "classification_heuristic": "active"
        }
    }

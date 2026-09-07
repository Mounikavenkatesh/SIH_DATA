"""
Main FastAPI application entrypoint for the Satellite Thermal Intelligence Pipeline.
Configures middleware, API routers, database lifecycle, startup auto-seeding, and static file hosting.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.database.connection import init_db, SessionLocal
from backend.app.models.thermal_event import ThermalEvent
from backend.app.services.firms_service import firms_service
from backend.app.services.pipeline import pipeline_orchestrator

from backend.app.routes.api_health import router as health_router
from backend.app.routes.api_events import router as events_router
from backend.app.routes.api_statistics import router as statistics_router
from backend.app.routes.api_ingest import router as ingest_router
from backend.app.routes.api_persistence import router as persistence_router

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("thermal_intelligence")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database tables
    logger.info("Initializing database schema...")
    init_db()

    # Optional Auto-seeding
    if settings.ENABLE_AUTO_SEED_ON_STARTUP:
        db = SessionLocal()
        try:
            event_count = db.query(ThermalEvent).count()
            if event_count == 0:
                logger.info("Auto-seed enabled and database empty. Loading initial mock FIRMS events...")
                raw_events = firms_service.load_mock_events(shift_to_today=True)
                if raw_events:
                    result = pipeline_orchestrator.process_raw_events(
                        db=db,
                        raw_events=raw_events,
                        source_label="INITIAL_AUTO_SEED"
                    )
                    logger.info(
                        f"Auto-seed completed: {result['events_enriched']} events enriched, "
                        f"{result['clusters_formed']} clusters formed."
                    )
            else:
                logger.info(f"Database already contains {event_count} thermal events. Skipping auto-seed.")
        except Exception as ex:
            logger.error(f"Error during auto-seeding: {ex}", exc_info=True)
        finally:
            db.close()

    yield

    logger.info("Shutting down Satellite Thermal Intelligence Pipeline.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Automated multi-sensor satellite thermal anomaly characterization, OSM industrial proximity intelligence, and persistent hotspot detection pipeline for SIH.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router)
app.include_router(events_router, prefix="/api/v1")
app.include_router(statistics_router, prefix="/api/v1")
app.include_router(ingest_router, prefix="/api/v1")
app.include_router(persistence_router, prefix="/api/v1")

# Mount frontend static files
static_path = Path(__file__).parent / "static"
if not static_path.exists():
    static_path.mkdir(parents=True, exist_ok=True)


@app.get("/", include_in_schema=False)
async def serve_index():
    index_file = static_path / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "health": "/health",
        "api_v1": "/api/v1"
    }


app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

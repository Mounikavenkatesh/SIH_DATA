"""
Data ingestion API endpoints.
Supports loading offline mock dataset, live NASA FIRMS streaming, and cache/database purge.
"""
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.models.thermal_event import ThermalEvent
from backend.app.models.facility_context import FacilityContext
from backend.app.models.event_features import EventFeatures
from backend.app.models.persistence_group import PersistenceGroup

from backend.app.schemas.ingest import (
    MockIngestRequest,
    FirmsApiIngestRequest,
    IngestResponse,
)
from backend.app.services.firms_service import firms_service
from backend.app.services.pipeline import pipeline_orchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Ingestion & Pipeline"])


@router.post(
    "/mock",
    response_model=IngestResponse,
    summary="Ingest Mock Thermal Events",
    description="Loads realistic pre-packaged satellite thermal anomalies, runs geospatial OSM enrichment, persistence clustering, and evidence-based classification."
)
def ingest_mock_events(
    payload: MockIngestRequest = MockIngestRequest(),
    db: Session = Depends(get_db)
):
    """
    Ingest the mock FIRMS dataset with optional date shifting to today and optional DB reset.
    """
    if payload.clear_existing:
        logger.info("Clearing existing thermal events prior to mock ingestion...")
        db.query(FacilityContext).delete()
        db.query(EventFeatures).delete()
        db.query(ThermalEvent).delete()
        db.query(PersistenceGroup).delete()
        db.commit()

    raw_events = firms_service.load_mock_events(shift_to_today=payload.shift_dates_to_today)
    if not raw_events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No mock events found in data/mock_firms_events.json"
        )

    result = pipeline_orchestrator.process_raw_events(
        db=db,
        raw_events=raw_events,
        source_label="MOCK_DATA"
    )

    return result


@router.post(
    "/firms",
    response_model=IngestResponse,
    summary="Ingest Live NASA FIRMS Data",
    description="Streams near-real-time active fire anomalies from NASA FIRMS Country API, or falls back to mock data if key is unconfigured."
)
def ingest_live_firms(
    payload: FirmsApiIngestRequest = FirmsApiIngestRequest(),
    db: Session = Depends(get_db)
):
    """
    Fetch and process near-real-time active fire points from NASA FIRMS API.
    """
    # Temporarily override map_key if explicitly provided
    original_key = firms_service.map_key
    if payload.map_key:
        firms_service.map_key = payload.map_key

    try:
        raw_events = firms_service.fetch_live_firms_csv(
            country_code=payload.country_code,
            source=payload.source,
            day_range=payload.day_range
        )
    finally:
        firms_service.map_key = original_key

    if not raw_events:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to fetch data from NASA FIRMS API and fallback returned no records."
        )

    result = pipeline_orchestrator.process_raw_events(
        db=db,
        raw_events=raw_events,
        source_label="FIRMS_API" if firms_service.is_live_configured() else "FIRMS_FALLBACK_MOCK"
    )

    return result


@router.post(
    "/clear",
    summary="Purge All Thermal Events and Clusters",
    description="Deletes all thermal events, geospatial facility contexts, feature vectors, and persistence clusters."
)
def clear_all_events(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Reset database to empty state.
    """
    deleted_events = db.query(ThermalEvent).count()
    deleted_clusters = db.query(PersistenceGroup).count()

    db.query(FacilityContext).delete()
    db.query(EventFeatures).delete()
    db.query(ThermalEvent).delete()
    db.query(PersistenceGroup).delete()
    db.commit()

    logger.info(f"Purged {deleted_events} thermal events and {deleted_clusters} clusters.")

    return {
        "status": "success",
        "message": f"Successfully purged {deleted_events} events and {deleted_clusters} clusters.",
        "deleted_events": deleted_events,
        "deleted_clusters": deleted_clusters
    }

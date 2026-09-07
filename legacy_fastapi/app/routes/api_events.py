"""
Thermal events REST API endpoints.
Provides filtering, spatial radius search, multi-layer context retrieval, and GeoJSON output.
"""
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from backend.app.database.connection import get_db
from backend.app.models.thermal_event import ThermalEvent
from backend.app.models.facility_context import FacilityContext
from backend.app.models.event_features import EventFeatures
from backend.app.models.persistence_group import PersistenceGroup

from backend.app.schemas.event import (
    ThermalEventResponse,
    ThermalEventDetailResponse,
    ThermalEventContextResponse,
    GeoJSONFeature,
    GeoJSONGeometry,
    GeoJSONFeatureCollection,
)
from backend.app.schemas.context import LandCoverContext
from backend.app.services.satellite_service import land_cover_service
from backend.app.utils.geo import haversine_distance_meters, bounding_box_for_radius

router = APIRouter(prefix="/events", tags=["Thermal Events"])


@router.get("", summary="List Thermal Events (with Filtering & GeoJSON)")
def list_thermal_events(
    category: Optional[str] = Query(None, description="Filter by heuristic classification category"),
    severity: Optional[str] = Query(None, description="Filter by thermal source severity ('Critical', 'High', 'Medium', 'Low', 'Resolved / No active source')"),
    status: Optional[str] = Query(None, description="Filter by fire status ('Active', 'Persistent', 'Resolved')"),
    min_frp: Optional[float] = Query(None, description="Minimum Fire Radiative Power (MW)"),
    max_frp: Optional[float] = Query(None, description="Maximum Fire Radiative Power (MW)"),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum normalized confidence (0.0 to 1.0)"),
    satellite: Optional[str] = Query(None, description="Satellite name (e.g., 'NOAA-20', 'Terra', 'Suomi-NPP')"),
    instrument: Optional[str] = Query(None, description="Instrument ('VIIRS' or 'MODIS')"),
    source: Optional[str] = Query(None, description="Source ('FIRMS_API' or 'MOCK_DATA')"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    output_format: str = Query("json", alias="format", description="Output format: 'json' or 'geojson'"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve thermal anomaly events with multi-criteria filtering.
    Supports GeoJSON format for direct Mapbox, Leaflet, and GIS rendering.
    """
    query = db.query(ThermalEvent).options(
        joinedload(ThermalEvent.facility_context),
        joinedload(ThermalEvent.features),
        joinedload(ThermalEvent.persistence_group)
    )

    if category:
        query = query.join(ThermalEvent.features).filter(EventFeatures.heuristic_classification == category)
    if min_frp is not None:
        query = query.filter(ThermalEvent.frp >= min_frp)
    if max_frp is not None:
        query = query.filter(ThermalEvent.frp <= max_frp)
    if min_confidence is not None:
        query = query.filter(ThermalEvent.confidence_normalized >= min_confidence)
    if satellite:
        query = query.filter(ThermalEvent.satellite == satellite)
    if instrument:
        query = query.filter(ThermalEvent.instrument == instrument.upper())
    if source:
        query = query.filter(ThermalEvent.source == source)
    if date_from:
        query = query.filter(ThermalEvent.acq_date >= date_from)
    if date_to:
        query = query.filter(ThermalEvent.acq_date <= date_to)

    raw_events = query.order_by(ThermalEvent.acq_date.desc(), ThermalEvent.acq_time.desc()).all()

    # Post-filter for computed severity & status
    if severity:
        sev_clean = severity.lower()
        if "no fire" in sev_clean or "resolved" in sev_clean:
            raw_events = [e for e in raw_events if "resolved" in e.severity.lower() or "no fire" in e.severity.lower()]
        else:
            raw_events = [e for e in raw_events if sev_clean in e.severity.lower()]
    if status:
        stat_clean = status.lower()
        raw_events = [e for e in raw_events if stat_clean == e.status.lower()]

    total_count = len(raw_events)
    events = raw_events[offset:offset + limit]

    if output_format.lower() == "geojson":
        features = []
        for e in events:
            feat_obj = GeoJSONFeature(
                id=e.id,
                geometry=GeoJSONGeometry(coordinates=[e.longitude, e.latitude]),
                properties={
                    "event_id": e.id,
                    "fire_id": e.fire_id,
                    "severity": e.severity,
                    "status": e.status,
                    "duration_text": e.duration_text,
                    "risk_zone_radius_m": e.risk_zone_radius_m,
                    "acq_date": e.acq_date,
                    "acq_time": e.acq_time,
                    "frp": e.frp,
                    "brightness_temperature": e.brightness_temperature,
                    "confidence_raw": e.confidence_raw,
                    "confidence_normalized": e.confidence_normalized,
                    "confidence_percent": int(e.confidence_normalized * 100),
                    "satellite": e.satellite,
                    "instrument": e.instrument,
                    "classification": e.features.heuristic_classification if e.features else "Unknown",
                    "overall_confidence": e.features.overall_model_confidence if e.features else 0.0,
                    "nearest_facility": e.facility_context.nearest_facility_name if e.facility_context else None,
                    "facility_type": e.facility_context.nearest_facility_type if e.facility_context else "unknown",
                    "facility_distance_m": e.facility_context.distance_meters if e.facility_context else None,
                    "persistence_score": e.features.persistence_score if e.features else 0.0,
                    "location_name": e.location_name
                }
            )
            features.append(feat_obj)
        return GeoJSONFeatureCollection(features=features, total_count=total_count)

    # Standard JSON
    return {
        "total_count": total_count,
        "offset": offset,
        "limit": limit,
        "events": [ThermalEventResponse.model_validate(e).model_dump(mode="json") for e in events]
    }


@router.post("/{event_id}/resolve", summary="Mark Thermal Incident as Resolved / No Active Source")
def resolve_event(event_id: str, db: Session = Depends(get_db)):
    """Mark a thermal incident as resolved, updating its severity to 'Resolved / No active source' and status to 'Resolved'."""
    event = db.query(ThermalEvent).filter(ThermalEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Thermal event not found")
    event.status = "Resolved"
    event.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)
    return {
        "status": "success",
        "message": f"Incident {event.fire_id} marked as RESOLVED / NO ACTIVE SOURCE",
        "event_id": event.id,
        "fire_id": event.fire_id,
        "new_status": event.status,
        "severity": event.severity
    }


@router.post("/simulate-detection", summary="Simulate Near-Real-Time Satellite Thermal Detection")
def simulate_fire_detection(db: Session = Depends(get_db)):
    """Simulate a new near-real-time satellite thermal anomaly detection (NASA FIRMS VIIRS/MODIS) at an industrial park."""
    import random
    from backend.app.services.pipeline import pipeline_orchestrator

    sample_locations = [
        {"name": "Hazira Petrochemical Industrial Complex", "lat": 21.1158, "lon": 72.6450, "fac": "Reliance Petrochem Plant", "fac_type": "refinery"},
        {"name": "Visakhapatnam Steel Industrial Zone", "lat": 17.6322, "lon": 83.1786, "fac": "Vizag Steel Mill Blast Furnace", "fac_type": "steel_mill"},
        {"name": "Manali Industrial Petrochem Estate", "lat": 13.1673, "lon": 80.2632, "fac": "CPCL Refinery Distillation Unit", "fac_type": "refinery"},
        {"name": "Korba Super Thermal Power Belt", "lat": 22.3595, "lon": 82.7501, "fac": "NTPC Thermal Power Station", "fac_type": "power_plant"},
        {"name": "Bhubaneswar Industrial Metal Park", "lat": 20.2961, "lon": 85.8245, "fac": "Aluminium Smelter Complex", "fac_type": "factory"},
    ]
    chosen = random.choice(sample_locations)
    now_dt = datetime.now(timezone.utc)
    new_event_raw = {
        "latitude": round(chosen["lat"] + random.uniform(-0.015, 0.015), 4),
        "longitude": round(chosen["lon"] + random.uniform(-0.015, 0.015), 4),
        "acq_date": now_dt.strftime("%Y-%m-%d"),
        "acq_time": now_dt.strftime("%H%M"),
        "satellite": "NOAA-20 (VIIRS)",
        "instrument": "VIIRS-I-Band-375m",
        "frp": round(random.uniform(48.0, 110.0), 1),
        "brightness_temperature": round(random.uniform(365.0, 410.0), 1),
        "bright_secondary": 305.0,
        "confidence": "high",
        "confidence_raw": "high",
        "confidence_normalized": round(random.uniform(0.92, 0.99), 2),
        "daynight": "D",
        "location_name": chosen["name"],
        "region": "India Industrial Corridor",
        "source": "NASA_FIRMS_VIIRS"
    }

    pipeline_orchestrator.process_raw_events(db, [new_event_raw], source_label="NASA_FIRMS")
    created = db.query(ThermalEvent).order_by(ThermalEvent.created_at.desc()).first()
    return {
        "status": "success",
        "message": f"New Satellite Thermal Anomaly Detected: {created.fire_id} at {chosen['name']}",
        "id": created.id,
        "event_id": created.id,
        "fire_id": created.fire_id,
        "severity": created.severity,
        "fire_status": created.status,
        "incident_status": created.status,
        "latitude": created.latitude,
        "longitude": created.longitude,
        "coordinates": [created.latitude, created.longitude],
        "confidence": f"{int(created.confidence_normalized * 100)}%",
        "risk_zone_radius_m": created.risk_zone_radius_m,
        "location": created.location_name,
        "location_name": created.location_name
    }


@router.get("/nearby", summary="Find Events Near Coordinate Radius")
def get_nearby_events(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Center latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Center longitude"),
    radius_km: float = Query(50.0, ge=0.5, le=500.0, description="Search radius in kilometers"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Spatial radius search using bounding box indexing and exact Haversine distance computation.
    """
    min_lat, min_lon, max_lat, max_lon = bounding_box_for_radius(lat, lon, radius_km)

    # Coarse filter using bounding box index
    candidates = (
        db.query(ThermalEvent)
        .options(
            joinedload(ThermalEvent.facility_context),
            joinedload(ThermalEvent.features)
        )
        .filter(
            ThermalEvent.latitude >= min_lat,
            ThermalEvent.latitude <= max_lat,
            ThermalEvent.longitude >= min_lon,
            ThermalEvent.longitude <= max_lon
        )
        .all()
    )

    # Precise Haversine distance filtering and sorting
    radius_meters = radius_km * 1000.0
    results = []
    for event in candidates:
        dist_m = haversine_distance_meters(lat, lon, event.latitude, event.longitude)
        if dist_m <= radius_meters:
            event_dict = {
                "id": event.id,
                "latitude": event.latitude,
                "longitude": event.longitude,
                "distance_km": round(dist_m / 1000.0, 2),
                "distance_meters": round(dist_m, 1),
                "acq_date": event.acq_date,
                "acq_time": event.acq_time,
                "frp": event.frp,
                "brightness_temperature": event.brightness_temperature,
                "satellite": event.satellite,
                "instrument": event.instrument,
                "confidence_raw": event.confidence_raw,
                "classification": event.features.heuristic_classification if event.features else "Unknown",
                "nearest_facility": event.facility_context.nearest_facility_name if event.facility_context else None,
                "facility_type": event.facility_context.nearest_facility_type if event.facility_context else "unknown",
                "persistence_score": event.features.persistence_score if event.features else 0.0,
                "location_name": event.location_name
            }
            results.append(event_dict)

    results.sort(key=lambda x: x["distance_meters"])
    return {
        "center": {"latitude": lat, "longitude": lon},
        "search_radius_km": radius_km,
        "total_found": len(results),
        "events": results[:limit]
    }


@router.get("/{event_id}", summary="Get Event by ID")
def get_event_by_id(event_id: str, db: Session = Depends(get_db)):
    """
    Retrieve single thermal event with associated facility context, engineered features,
    and persistence group.
    """
    event = (
        db.query(ThermalEvent)
        .options(
            joinedload(ThermalEvent.facility_context),
            joinedload(ThermalEvent.features),
            joinedload(ThermalEvent.persistence_group)
        )
        .filter(ThermalEvent.id == event_id)
        .first()
    )

    if not event:
        raise HTTPException(status_code=404, detail=f"Thermal event with ID '{event_id}' not found.")

    return event


@router.get("/{event_id}/context", summary="Get Rich Multi-Layer Event Context")
def get_event_context(event_id: str, db: Session = Depends(get_db)):
    """
    Deep context endpoint returning:
    - Raw observation telemetry
    - OpenStreetMap facility proximity details & raw tags
    - Pluggable land cover context (vegetation, canopy, industrial biome)
    - Persistence group history and active days
    - Normalized ML feature vector for downstream classifiers
    """
    event = (
        db.query(ThermalEvent)
        .options(
            joinedload(ThermalEvent.facility_context),
            joinedload(ThermalEvent.features),
            joinedload(ThermalEvent.persistence_group)
        )
        .filter(ThermalEvent.id == event_id)
        .first()
    )

    if not event:
        raise HTTPException(status_code=404, detail=f"Thermal event with ID '{event_id}' not found.")

    # Land cover context
    land_ctx = land_cover_service.get_land_cover_context(event.latitude, event.longitude)

    # Parse feature vector
    ml_vec = None
    if event.features and event.features.feature_vector_json:
        try:
            ml_vec = json.loads(event.features.feature_vector_json)
        except Exception:
            ml_vec = None

    # Parse tags json
    fac_tags = {}
    if event.facility_context and event.facility_context.tags_json:
        try:
            fac_tags = json.loads(event.facility_context.tags_json)
        except Exception:
            fac_tags = {}

    return {
        "event_id": event.id,
        "fire_id": event.fire_id,
        "severity": event.severity,
        "status": event.status,
        "duration_text": event.duration_text,
        "risk_zone_radius_m": event.risk_zone_radius_m,
        "telemetry": {
            "latitude": event.latitude,
            "longitude": event.longitude,
            "acq_date": event.acq_date,
            "acq_time": event.acq_time,
            "satellite": event.satellite,
            "instrument": event.instrument,
            "frp": event.frp,
            "brightness_temperature": event.brightness_temperature,
            "confidence_raw": event.confidence_raw,
            "confidence_normalized": event.confidence_normalized,
            "daynight": event.daynight,
            "location_name": event.location_name,
            "region": event.region
        },
        "facility_context": {
            "nearest_facility_name": event.facility_context.nearest_facility_name if event.facility_context else None,
            "nearest_facility_type": event.facility_context.nearest_facility_type if event.facility_context else "unknown",
            "distance_meters": event.facility_context.distance_meters if event.facility_context else None,
            "osm_id": event.facility_context.osm_id if event.facility_context else None,
            "osm_type": event.facility_context.osm_type if event.facility_context else None,
            "tags": fac_tags,
            "enrichment_source": event.facility_context.enrichment_source if event.facility_context else None
        } if event.facility_context else None,
        "land_cover_context": land_ctx,
        "persistence_context": {
            "group_id": event.persistence_group.id if event.persistence_group else None,
            "group_code": event.persistence_group.group_code if event.persistence_group else None,
            "site_name": event.persistence_group.site_name if event.persistence_group else None,
            "first_seen": event.persistence_group.first_seen if event.persistence_group else event.acq_date,
            "last_seen": event.persistence_group.last_seen if event.persistence_group else event.acq_date,
            "active_days": event.persistence_group.active_days if event.persistence_group else 1,
            "detection_count": event.persistence_group.detection_count if event.persistence_group else 1,
            "persistence_score": event.persistence_group.persistence_score if event.persistence_group else 0.0
        } if event.persistence_group else None,
        "classification": {
            "heuristic_category": event.features.heuristic_classification if event.features else "Other/Unknown",
            "overall_model_confidence": event.features.overall_model_confidence if event.features else 0.0,
            "scoring_mode": event.features.scoring_mode if event.features else "prototype_heuristic",
            "scores": {
                "industrial_score": event.features.industrial_score if event.features else 0.0,
                "flare_score": event.features.flare_score if event.features else 0.0,
                "agriculture_score": event.features.agriculture_score if event.features else 0.0,
                "wildfire_score": event.features.wildfire_score if event.features else 0.0,
                "persistence_score": event.features.persistence_score if event.features else 0.0,
            }
        } if event.features else None,
        "ml_feature_vector": ml_vec
    }

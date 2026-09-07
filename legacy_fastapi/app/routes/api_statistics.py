"""
Analytical intelligence and dashboard statistics endpoint.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List

from backend.app.database.connection import get_db
from backend.app.models.thermal_event import ThermalEvent
from backend.app.models.event_features import EventFeatures
from backend.app.models.persistence_group import PersistenceGroup
from backend.app.schemas.statistics import PipelineStatisticsResponse, CategoryBreakdown, PersistenceSummary

router = APIRouter(prefix="/statistics", tags=["Analytics & Statistics"])


@router.get("", summary="Get Aggregated Thermal Event Statistics", response_model=PipelineStatisticsResponse)
def get_pipeline_statistics(db: Session = Depends(get_db)):
    """
    Returns aggregate intelligence across all ingested and processed thermal anomalies:
    - Event counts and FRP distributions grouped by classification class
    - Persistent thermal hotspot clusters and top recurring sites
    - Satellite & sensor breakdown
    - Data quality and confidence ratios
    """
    total_events = db.query(ThermalEvent).count()
    total_persistent_clusters = db.query(PersistenceGroup).count()

    if total_events == 0:
        return {
            "total_events": 0,
            "total_persistent_clusters": 0,
            "categories_breakdown": [],
            "persistence_summary": {
                "total_groups": 0,
                "high_persistence_count": 0,
                "top_recurring_sites": []
            },
            "satellite_breakdown": {},
            "instrument_breakdown": {},
            "avg_frp_overall": 0.0,
            "max_frp_overall": 0.0,
            "high_confidence_ratio": 0.0,
            "active_date_range": {"min_date": "N/A", "max_date": "N/A"},
            "pipeline_mode": "idle"
        }

    # Category breakdown
    cat_rows = (
        db.query(
            EventFeatures.heuristic_classification,
            func.count(ThermalEvent.id),
            func.avg(ThermalEvent.frp),
            func.max(ThermalEvent.frp)
        )
        .join(EventFeatures, EventFeatures.event_id == ThermalEvent.id)
        .group_by(EventFeatures.heuristic_classification)
        .all()
    )

    categories_breakdown = [
        CategoryBreakdown(
            category=row[0],
            count=row[1],
            avg_frp=round(float(row[2] or 0.0), 2),
            max_frp=round(float(row[3] or 0.0), 2)
        )
        for row in cat_rows
    ]

    # Persistence summary
    high_persistence_count = db.query(PersistenceGroup).filter(PersistenceGroup.persistence_score >= 0.5).count()
    top_groups = (
        db.query(PersistenceGroup)
        .order_by(PersistenceGroup.persistence_score.desc(), PersistenceGroup.detection_count.desc())
        .limit(5)
        .all()
    )

    top_recurring_sites = [
        {
            "group_code": g.group_code,
            "site_name": g.site_name,
            "centroid": [g.centroid_lat, g.centroid_lon],
            "active_days": g.active_days,
            "detections": g.detection_count,
            "persistence_score": g.persistence_score,
            "dominant_category": g.dominant_category
        }
        for g in top_groups
    ]

    # Satellite breakdown
    sat_rows = db.query(ThermalEvent.satellite, func.count(ThermalEvent.id)).group_by(ThermalEvent.satellite).all()
    satellite_breakdown = {s[0]: s[1] for s in sat_rows}

    # Instrument breakdown
    inst_rows = db.query(ThermalEvent.instrument, func.count(ThermalEvent.id)).group_by(ThermalEvent.instrument).all()
    instrument_breakdown = {i[0]: i[1] for i in inst_rows}

    # Overall FRP metrics
    overall_frp = db.query(func.avg(ThermalEvent.frp), func.max(ThermalEvent.frp)).first()
    avg_frp = round(float(overall_frp[0] or 0.0), 2)
    max_frp = round(float(overall_frp[1] or 0.0), 2)

    # High confidence ratio
    high_conf_count = db.query(ThermalEvent).filter(ThermalEvent.confidence_normalized >= 0.8).count()
    high_conf_ratio = round(high_conf_count / total_events, 3)

    # Date range
    date_bounds = db.query(func.min(ThermalEvent.acq_date), func.max(ThermalEvent.acq_date)).first()

    # Industrial Fire Visualization Metrics
    all_events = db.query(ThermalEvent).order_by(ThermalEvent.created_at.desc()).all()
    active_fires = sum(1 for e in all_events if e.status != "Resolved")
    resolved_incidents = sum(1 for e in all_events if e.status == "Resolved")
    critical_fires = sum(1 for e in all_events if "Critical" in e.severity)

    recent_incidents = [
        {
            "id": e.id,
            "fire_id": e.fire_id,
            "location_name": e.location_name or "Industrial Area",
            "severity": e.severity,
            "status": e.status,
            "frp": e.frp,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "coordinates": [e.latitude, e.longitude],
            "acq_date": e.acq_date,
            "acq_time": e.acq_time,
            "duration_text": e.duration_text,
            "confidence_percent": int(e.confidence_normalized * 100)
        }
        for e in all_events[:8]
    ]

    return {
        "total_events": total_events,
        "total_fires": total_events,
        "active_fires": active_fires,
        "critical_fires": critical_fires,
        "resolved_incidents": resolved_incidents,
        "high_risk_locations": high_persistence_count,
        "total_persistent_clusters": total_persistent_clusters,
        "categories_breakdown": categories_breakdown,
        "persistence_summary": {
            "total_groups": total_persistent_clusters,
            "high_persistence_count": high_persistence_count,
            "top_recurring_sites": top_recurring_sites
        },
        "satellite_breakdown": satellite_breakdown,
        "instrument_breakdown": instrument_breakdown,
        "avg_frp_overall": avg_frp,
        "max_frp_overall": max_frp,
        "high_confidence_ratio": high_conf_ratio,
        "active_date_range": {
            "min_date": date_bounds[0] or "N/A",
            "max_date": date_bounds[1] or "N/A"
        },
        "recent_incidents": recent_incidents,
        "pipeline_mode": "operational"
    }

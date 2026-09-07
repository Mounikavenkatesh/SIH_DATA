"""
Persistence groups and recurring hotspot clusters API endpoints.
Provides cluster retrieval, high-persistence querying, and cluster detail view.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.database.connection import get_db
from backend.app.models.persistence_group import PersistenceGroup
from backend.app.schemas.persistence import (
    PersistenceGroupResponse,
    PersistenceGroupDetailResponse,
)

router = APIRouter(prefix="/clusters", tags=["Persistence & Clusters"])


@router.get(
    "",
    response_model=List[PersistenceGroupResponse],
    summary="List Persistent Thermal Clusters",
    description="Retrieve recurring spatial-temporal hotspot clusters filtered by persistence score, detection count, and category."
)
def list_persistence_clusters(
    min_persistence: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum persistence score (0.0 - 1.0)"),
    min_detections: Optional[int] = Query(None, ge=1, description="Minimum number of satellite detections"),
    category: Optional[str] = Query(None, description="Dominant classification category (e.g., 'Gas Flare', 'Industrial')"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of clusters to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db)
):
    """
    List persistence groups ordered by persistence score and detection count descending.
    """
    query = db.query(PersistenceGroup)

    if min_persistence is not None:
        query = query.filter(PersistenceGroup.persistence_score >= min_persistence)

    if min_detections is not None:
        query = query.filter(PersistenceGroup.detection_count >= min_detections)

    if category:
        query = query.filter(PersistenceGroup.dominant_category == category)

    clusters = (
        query.order_by(
            PersistenceGroup.persistence_score.desc(),
            PersistenceGroup.detection_count.desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return clusters


@router.get(
    "/{cluster_id}",
    response_model=PersistenceGroupDetailResponse,
    summary="Get Cluster Details",
    description="Retrieve a single persistent cluster with member thermal event identifiers."
)
def get_persistence_cluster(
    cluster_id: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific persistence group, including associated event IDs.
    """
    group = (
        db.query(PersistenceGroup)
        .options(joinedload(PersistenceGroup.events))
        .filter(PersistenceGroup.id == cluster_id)
        .first()
    )

    if not group:
        # Also try matching by group_code
        group = (
            db.query(PersistenceGroup)
            .options(joinedload(PersistenceGroup.events))
            .filter(PersistenceGroup.group_code == cluster_id)
            .first()
        )

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persistence group '{cluster_id}' not found."
        )

    event_ids = [e.id for e in group.events] if group.events else []

    return PersistenceGroupDetailResponse(
        id=group.id,
        group_code=group.group_code,
        centroid_lat=group.centroid_lat,
        centroid_lon=group.centroid_lon,
        radius_meters=group.radius_meters,
        first_seen=group.first_seen,
        last_seen=group.last_seen,
        active_days=group.active_days,
        detection_count=group.detection_count,
        persistence_score=group.persistence_score,
        dominant_category=group.dominant_category,
        site_name=group.site_name,
        created_at=group.created_at,
        event_ids=event_ids
    )

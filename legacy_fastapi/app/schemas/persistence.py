"""
Pydantic schemas for persistence groups and repeat thermal hotspot sites.
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PersistenceGroupResponse(BaseModel):
    id: str
    group_code: str
    centroid_lat: float
    centroid_lon: float
    radius_meters: float
    first_seen: str
    last_seen: str
    active_days: int
    detection_count: int
    persistence_score: float
    dominant_category: Optional[str] = None
    site_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PersistenceGroupDetailResponse(PersistenceGroupResponse):
    event_ids: List[str] = []

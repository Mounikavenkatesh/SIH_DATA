"""
Pydantic schemas for geospatial facility context and land cover data.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class FacilityContextBase(BaseModel):
    nearest_facility_name: Optional[str] = None
    nearest_facility_type: str = "unknown"
    distance_meters: float
    osm_id: Optional[str] = None
    osm_type: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    search_radius_meters: float = 3000.0
    enrichment_source: str = "OFFLINE_CACHE"


class FacilityContextResponse(FacilityContextBase):
    id: str
    event_id: str

    model_config = ConfigDict(from_attributes=True)


class LandCoverContext(BaseModel):
    land_use_type: str
    vegetation_context: str
    industrial_context: str
    forest_context: str
    provider: str

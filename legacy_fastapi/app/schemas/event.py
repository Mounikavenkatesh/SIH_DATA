"""
Pydantic schemas for NASA FIRMS thermal anomaly events.
Supports raw ingestion, normalized responses, spatial filtering, and GeoJSON export.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from backend.app.schemas.context import FacilityContextResponse, LandCoverContext
from backend.app.schemas.features import EventFeaturesResponse
from backend.app.schemas.persistence import PersistenceGroupResponse


class ThermalEventBase(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    acq_date: str = Field(..., description="Acquisition date (YYYY-MM-DD)")
    acq_time: str = Field(..., description="Acquisition time in UTC (HHMM)")
    satellite: str = Field(..., description="Satellite name (e.g. NOAA-20, Terra, Aqua, Suomi-NPP)")
    instrument: str = Field(..., description="Sensor instrument (VIIRS or MODIS)")
    frp: float = Field(..., ge=0.0, description="Fire Radiative Power in Megawatts (MW)")
    brightness_temperature: float = Field(..., description="Brightness temperature in Kelvin (T4/B21/B22)")
    bright_secondary: Optional[float] = Field(None, description="Secondary band brightness temperature in Kelvin")
    confidence_raw: str = Field(..., description="Raw instrument confidence ('high', 'nominal', 'low', or '0-100')")
    confidence_normalized: float = Field(..., ge=0.0, le=1.0, description="Normalized confidence 0.0 to 1.0")
    scan: Optional[float] = Field(None, description="Along-scan pixel size in km")
    track: Optional[float] = Field(None, description="Along-track pixel size in km")
    daynight: Optional[str] = Field(None, description="'D' for Day or 'N' for Night")
    location_name: Optional[str] = Field(None, description="Human-readable location label")
    region: Optional[str] = Field(None, description="Geographic region / country")
    source: str = Field("FIRMS_API", description="Source of event: 'FIRMS_API' or 'MOCK_DATA'")


class ThermalEventCreate(BaseModel):
    """Schema used during ingestion from FIRMS CSV/JSON or mock data."""
    latitude: float
    longitude: float
    acq_date: str
    acq_time: str
    satellite: str
    instrument: str
    frp: float
    brightness_temperature: float
    bright_secondary: Optional[float] = None
    confidence: Any  # Can be str or int/float from FIRMS
    scan: Optional[float] = None
    track: Optional[float] = None
    daynight: Optional[str] = None
    location_name: Optional[str] = None
    region: Optional[str] = None
    source: str = "FIRMS_API"


class ThermalEventResponse(ThermalEventBase):
    id: str
    created_at: Optional[datetime] = None
    persistence_group_id: Optional[str] = None
    facility_context: Optional[FacilityContextResponse] = None
    features: Optional[EventFeaturesResponse] = None
    heuristic_classification: Optional[str] = None
    fire_id: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    duration_text: Optional[str] = None
    risk_zone_radius_m: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ThermalEventDetailResponse(ThermalEventResponse):
    persistence_group: Optional[PersistenceGroupResponse] = None


class ThermalEventContextResponse(BaseModel):
    """Detailed multi-layer context for GET /api/events/{event_id}/context"""
    event_id: str
    latitude: float
    longitude: float
    acq_date: str
    acq_time: str
    frp: float
    facility_context: Optional[FacilityContextResponse] = None
    land_context: Optional[LandCoverContext] = None
    features: Optional[EventFeaturesResponse] = None
    persistence_group: Optional[PersistenceGroupResponse] = None
    ml_feature_vector: Optional[Dict[str, float]] = None


# GeoJSON Schemas for frontend and map integration (Mapbox, Leaflet, OpenLayers)
class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float] # [lon, lat]


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    id: str
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
    total_count: int

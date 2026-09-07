"""
Pydantic schemas for data ingestion endpoints.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MockIngestRequest(BaseModel):
    shift_dates_to_today: bool = Field(True, description="Whether to shift event dates to recent dates relative to today")
    clear_existing: bool = Field(False, description="Whether to purge existing records before ingesting")


class FirmsApiIngestRequest(BaseModel):
    country_code: str = Field("IND", description="ISO 3166-1 alpha-3 country code (e.g., 'IND', 'USA')")
    source: str = Field("VIIRS_SNPP_NRT", description="FIRMS data source: 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT'")
    day_range: int = Field(1, ge=1, le=10, description="Number of historical days to fetch (1 to 10)")
    map_key: Optional[str] = Field(None, description="Optional override for FIRMS Map Key")


class IngestResponse(BaseModel):
    status: str
    message: str
    source: str
    events_received: int
    events_validated: int
    events_deduplicated: int
    events_enriched: int
    clusters_formed: int
    execution_time_seconds: float
    sample_event_ids: List[str] = []

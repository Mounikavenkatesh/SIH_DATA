from typing import Dict, List, Any, Optional
from pydantic import BaseModel


class CategoryBreakdown(BaseModel):
    category: str
    count: int
    avg_frp: float
    max_frp: float


class PersistenceSummary(BaseModel):
    total_groups: int
    high_persistence_count: int
    top_recurring_sites: List[Dict[str, Any]]


class PipelineStatisticsResponse(BaseModel):
    total_events: int
    total_persistent_clusters: int
    categories_breakdown: List[CategoryBreakdown]
    persistence_summary: PersistenceSummary
    satellite_breakdown: Dict[str, int]
    instrument_breakdown: Dict[str, int]
    avg_frp_overall: float
    max_frp_overall: float
    high_confidence_ratio: float
    active_date_range: Dict[str, str]
    pipeline_mode: str
    # Industrial Fire Visualization Metrics
    total_fires: Optional[int] = None
    active_fires: Optional[int] = None
    critical_fires: Optional[int] = None
    resolved_incidents: Optional[int] = None
    high_risk_locations: Optional[int] = None
    recent_incidents: Optional[List[Dict[str, Any]]] = None

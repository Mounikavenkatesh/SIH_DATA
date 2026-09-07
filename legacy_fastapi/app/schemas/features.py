"""
Pydantic schemas for engineered features and prototype heuristic classification.
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class ClassificationResult(BaseModel):
    category: str
    confidence: float
    scoring_mode: str = "prototype_heuristic"
    scores: Dict[str, float]


class EventFeaturesResponse(BaseModel):
    id: str
    event_id: str
    land_use_type: str
    vegetation_context: Optional[str] = None
    is_industrial_zone: bool
    is_flare_adjacent: bool
    is_refinery_adjacent: bool
    is_power_plant_adjacent: bool
    distance_to_nearest_industrial_m: Optional[float] = None
    spatial_cluster_density: int
    industrial_score: float
    flare_score: float
    agriculture_score: float
    wildfire_score: float
    persistence_score: float
    overall_model_confidence: float
    heuristic_classification: str
    scoring_mode: str
    feature_vector: Optional[Dict[str, float]] = None

    model_config = ConfigDict(from_attributes=True)

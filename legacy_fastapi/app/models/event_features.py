"""
SQLAlchemy ORM model for engineered multi-dimensional features and heuristic classification scores.
Designed specifically to feed downstream ML classification models and decision dashboards.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class EventFeatures(Base):
    __tablename__ = "event_features"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Land & Satellite Context
    land_use_type = Column(String(64), nullable=False, default="unknown") # industrial, farmland, forest, urban, shrubland
    vegetation_context = Column(String(64), nullable=True) # sparse, dense_canopy, crop_field, barren
    
    # Proximity Boolean Features
    is_industrial_zone = Column(Boolean, default=False)
    is_flare_adjacent = Column(Boolean, default=False)
    is_refinery_adjacent = Column(Boolean, default=False)
    is_power_plant_adjacent = Column(Boolean, default=False)
    distance_to_nearest_industrial_m = Column(Float, nullable=True)
    
    # Cluster Dynamics
    spatial_cluster_density = Column(Integer, default=1) # Count of neighboring detections within 5km
    
    # Evidence-based Prototype Scoring (0.0 to 1.0)
    industrial_score = Column(Float, nullable=False, default=0.0)
    flare_score = Column(Float, nullable=False, default=0.0)
    agriculture_score = Column(Float, nullable=False, default=0.0)
    wildfire_score = Column(Float, nullable=False, default=0.0)
    persistence_score = Column(Float, nullable=False, default=0.0)
    overall_model_confidence = Column(Float, nullable=False, default=0.0)
    
    # Heuristic Classification Result
    # Categories:
    # 1. Industrial Thermal Event
    # 2. Gas Flare
    # 3. Agricultural Burning
    # 4. Wildfire
    # 5. Other/Unknown
    heuristic_classification = Column(String(64), nullable=False, default="Other/Unknown")
    scoring_mode = Column(String(32), default="prototype_heuristic")
    
    # Serialized ML Feature Vector for downstream models (e.g. XGBoost, Random Forest, PyTorch)
    feature_vector_json = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship
    event = relationship("ThermalEvent", back_populates="features")

    __table_args__ = (
        Index("idx_event_features_class", "heuristic_classification"),
        Index("idx_event_features_ind_score", "industrial_score"),
        Index("idx_event_features_flare_score", "flare_score"),
    )

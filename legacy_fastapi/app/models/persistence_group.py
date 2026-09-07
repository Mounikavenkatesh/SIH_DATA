"""
SQLAlchemy ORM model for grouped persistent thermal sources.
Tracks spatial-temporal clusters of repeated thermal activity over multiple days.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Index
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class PersistenceGroup(Base):
    __tablename__ = "persistence_groups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_code = Column(String(64), nullable=False, unique=True)
    
    # Cluster Spatial Geometry
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    radius_meters = Column(Float, nullable=False, default=1500.0)
    
    # Temporal Dynamics
    first_seen = Column(String(10), nullable=False) # Earliest acq_date YYYY-MM-DD
    last_seen = Column(String(10), nullable=False)  # Latest acq_date YYYY-MM-DD
    active_days = Column(Integer, nullable=False, default=1)
    detection_count = Column(Integer, nullable=False, default=1)
    
    # Quantitative Persistence Score (0.0 to 1.0)
    persistence_score = Column(Float, nullable=False, default=0.0)
    
    # Human-readable Identification
    site_name = Column(String(255), nullable=True)
    dominant_category = Column(String(64), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    events = relationship("ThermalEvent", back_populates="persistence_group")

    __table_args__ = (
        Index("idx_persistence_groups_centroid", "centroid_lat", "centroid_lon"),
        Index("idx_persistence_score", "persistence_score"),
    )

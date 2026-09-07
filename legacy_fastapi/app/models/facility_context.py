"""
SQLAlchemy ORM model for OpenStreetMap facility proximity context.
Stores enriched geospatial industrial/infrastructure data for each thermal event.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class FacilityContext(Base):
    __tablename__ = "facility_context"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Nearest facility details
    nearest_facility_name = Column(String(255), nullable=True)
    nearest_facility_type = Column(String(64), nullable=False, default="unknown") # refinery, gas_flare, power_plant, factory, mine, farmland, forest
    distance_meters = Column(Float, nullable=False)
    
    # OSM identifiers & tags
    osm_id = Column(String(64), nullable=True)
    osm_type = Column(String(16), nullable=True) # node, way, relation
    tags_json = Column(Text, nullable=True)      # Stored as serialized JSON string
    
    # Query metadata
    search_radius_meters = Column(Float, nullable=False, default=3000.0)
    enrichment_source = Column(String(32), default="OFFLINE_CACHE") # "OVERPASS_LIVE", "OFFLINE_CACHE"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship
    event = relationship("ThermalEvent", back_populates="facility_context")

    __table_args__ = (
        Index("idx_facility_context_type", "nearest_facility_type"),
        Index("idx_facility_context_dist", "distance_meters"),
    )

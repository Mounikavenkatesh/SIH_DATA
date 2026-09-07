"""
SQLAlchemy ORM model for raw and normalized satellite thermal events.
Stores observations from NASA FIRMS (VIIRS & MODIS).
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class ThermalEvent(Base):
    __tablename__ = "thermal_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Coordinates
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Acquisition Temporal Data
    acq_date = Column(String(10), nullable=False)   # YYYY-MM-DD
    acq_time = Column(String(4), nullable=False)    # HHMM
    
    # Satellite & Instrument
    satellite = Column(String(32), nullable=False)  # e.g., "NOAA-20", "Terra", "Aqua", "Suomi-NPP"
    instrument = Column(String(16), nullable=False) # e.g., "VIIRS", "MODIS"
    
    # Thermal Metrics
    frp = Column(Float, nullable=False)             # Fire Radiative Power in MW
    brightness_temperature = Column(Float, nullable=False) # In Kelvin (bright_ti4 / brightness)
    bright_secondary = Column(Float, nullable=True) # bright_ti5 / bright_t31 in Kelvin
    
    # Quality & Geometry
    confidence_raw = Column(String(16), nullable=False) # "high", "nominal", "low", "85"
    confidence_normalized = Column(Float, nullable=False) # 0.0 to 1.0
    scan = Column(Float, nullable=True)
    track = Column(Float, nullable=True)
    daynight = Column(String(1), nullable=True)    # "D" or "N"
    
    # Descriptive Context
    location_name = Column(String(255), nullable=True)
    region = Column(String(128), nullable=True)
    source = Column(String(32), default="FIRMS_API") # "FIRMS_API", "MOCK_DATA"
    
    # Persistence Group Association
    persistence_group_id = Column(String(36), ForeignKey("persistence_groups.id", ondelete="SET NULL"), nullable=True)
    
    # Status & Resolution (Active, Persistent, Resolved)
    status_field = Column("status", String(32), default="Active", nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def status(self) -> str:
        if hasattr(self, "status_field") and self.status_field:
            return self.status_field
        if self.persistence_group and self.persistence_group.detection_count >= 2:
            return "Persistent"
        return "Active"

    @status.setter
    def status(self, val: str):
        self.status_field = val

    @property
    def fire_id(self) -> str:
        clean_date = (self.acq_date or "2026-09-06").replace("-", "")
        short_id = (self.id or "000000")[:6].upper()
        return f"FIRE-{clean_date}-{short_id}"

    @property
    def severity(self) -> str:
        if self.status == "Resolved":
            return "Resolved / No active source"
        # High / Critical Intensity: high FRP or strong industrial combustion
        if self.frp >= 55.0 or (self.frp >= 35.0 and self.confidence_normalized >= 0.8):
            return "High / Critical Intensity"
        elif self.frp >= 20.0:
            return "Medium Intensity"
        else:
            return "Low Intensity"

    @property
    def risk_zone_radius_m(self) -> float:
        sev = self.severity
        if "Resolved" in sev or "No active source" in sev:
            return 100.0
        if "Critical" in sev:
            return 2500.0
        if "Medium" in sev:
            return 800.0
        return 350.0

    @property
    def duration_text(self) -> str:
        if self.status == "Resolved":
            return "Resolved / No active source"
        if self.persistence_group and self.persistence_group.active_days > 1:
            return f"{self.persistence_group.active_days} days ({self.persistence_group.detection_count} detections)"
        hours = max(1, int((self.frp * 0.12) + 2))
        return f"{hours} hrs (isolated detection)"

    @property
    def heuristic_classification(self) -> str:
        if self.features and self.features.heuristic_classification:
            return self.features.heuristic_classification
        return "Unknown"

    # Relationships
    facility_context = relationship("FacilityContext", uselist=False, back_populates="event", cascade="all, delete-orphan")
    features = relationship("EventFeatures", uselist=False, back_populates="event", cascade="all, delete-orphan")
    persistence_group = relationship("PersistenceGroup", back_populates="events")

    # Spatial-temporal indexing for fast querying
    __table_args__ = (
        Index("idx_thermal_events_lat_lon", "latitude", "longitude"),
        Index("idx_thermal_events_acq_date", "acq_date"),
        Index("idx_thermal_events_source", "source"),
    )

"""
Persistence and spatial-temporal detection history analysis service.
Identifies recurring industrial thermal sources, gas flaring pads, and persistent hotspots.
"""
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from backend.app.config import settings
from backend.app.models.persistence_group import PersistenceGroup
from backend.app.models.thermal_event import ThermalEvent
from backend.app.utils.geo import haversine_distance_meters, calculate_centroid

logger = logging.getLogger(__name__)


class PersistenceService:
    def __init__(self):
        self.distance_threshold = settings.PERSISTENCE_DISTANCE_THRESHOLD_METERS

    def calculate_persistence_score(self, active_days: int, detection_count: int, timespan_days: int = 7) -> float:
        """
        Calculate a normalized persistence score between 0.0 and 1.0.
        Persistent sources (refinery flaring, furnaces) recur across multiple separate days.
        Transient events (agricultural burning, lightning fires) typically last 1 or 2 days at a single coordinate.
        """
        # Temporal recurrence factor (active days out of window)
        recurrence_factor = min(1.0, active_days / 4.0)
        
        # Detection volume factor
        volume_factor = min(1.0, detection_count / 8.0)
        
        # Weighted combination: 65% consistency over time, 35% frequency
        score = (recurrence_factor * 0.65) + (volume_factor * 0.35)
        return round(float(score), 3)

    def assign_or_create_persistence_group(
        self,
        db: Session,
        latitude: float,
        longitude: float,
        acq_date: str,
        location_hint: Optional[str] = None
    ) -> PersistenceGroup:
        """
        Match coordinate against existing persistence groups within distance_threshold.
        If a match is found, update the group metrics.
        Otherwise, initialize a new candidate persistence group.
        """
        # Query all existing groups
        existing_groups = db.query(PersistenceGroup).all()

        best_group = None
        min_dist = float("inf")

        for grp in existing_groups:
            dist = haversine_distance_meters(latitude, longitude, grp.centroid_lat, grp.centroid_lon)
            if dist <= self.distance_threshold and dist < min_dist:
                min_dist = dist
                best_group = grp

        if best_group:
            # Update existing group
            new_detection_count = best_group.detection_count + 1
            
            # Update dates
            first_dt = min(best_group.first_seen, acq_date)
            last_dt = max(best_group.last_seen, acq_date)
            best_group.first_seen = first_dt
            best_group.last_seen = last_dt
            best_group.detection_count = new_detection_count

            # Recompute centroid (moving average)
            w = 1.0 / new_detection_count
            best_group.centroid_lat = round(best_group.centroid_lat * (1.0 - w) + latitude * w, 6)
            best_group.centroid_lon = round(best_group.centroid_lon * (1.0 - w) + longitude * w, 6)

            # Recompute active days by querying distinct dates linked to this group
            distinct_dates = (
                db.query(ThermalEvent.acq_date)
                .filter(ThermalEvent.persistence_group_id == best_group.id)
                .distinct()
                .all()
            )
            date_set = {d[0] for d in distinct_dates}
            if best_group.first_seen:
                date_set.add(best_group.first_seen)
            date_set.add(acq_date)
            best_group.active_days = len(date_set)

            # Recompute persistence score
            best_group.persistence_score = self.calculate_persistence_score(
                best_group.active_days,
                best_group.detection_count
            )
            
            db.commit()
            db.refresh(best_group)
            return best_group

        else:
            # Create a new PersistenceGroup
            short_id = uuid.uuid4().hex[:6].upper()
            code_prefix = (location_hint or "HOTSPOT").split()[0].replace("-", "").upper()[:8]
            group_code = f"PG-{code_prefix}-{short_id}"

            new_group = PersistenceGroup(
                group_code=group_code,
                centroid_lat=latitude,
                centroid_lon=longitude,
                radius_meters=self.distance_threshold,
                first_seen=acq_date,
                last_seen=acq_date,
                active_days=1,
                detection_count=1,
                persistence_score=0.15,
                site_name=location_hint or f"Hotspot Cluster {group_code}",
                dominant_category="Pending Classification"
            )
            db.add(new_group)
            db.commit()
            db.refresh(new_group)
            return new_group


persistence_service = PersistenceService()

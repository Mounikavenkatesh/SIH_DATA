"""
Feature engineering service.
Transforms raw telemetry, OpenStreetMap proximity, land cover, and persistence history
into structured, normalized features for classification and downstream ML consumers.
"""
import json
from typing import Dict, Any, Optional
from backend.app.schemas.context import LandCoverContext


class FeatureService:
    def extract_features(
        self,
        event_dict: Dict[str, Any],
        facility_context: Dict[str, Any],
        land_context: Dict[str, Any],
        persistence_score: float,
        cluster_density: int = 1
    ) -> Dict[str, Any]:
        """
        Produce normalized feature dictionary and ML-ready numeric vector.
        """
        fac_type = (facility_context.get("nearest_facility_type") or "").lower()
        dist_m = float(facility_context.get("distance_meters", 5000.0))
        frp = float(event_dict.get("frp", 0.0))
        bt = float(event_dict.get("brightness_temperature", 300.0))
        conf_norm = float(event_dict.get("confidence_normalized", 0.7))
        daynight = str(event_dict.get("daynight", "D")).upper()
        land_use = land_context.get("land_use_type", "unknown")

        # Proximity flags
        is_flare = ("flare" in fac_type) and (dist_m <= 1500.0)
        is_refinery = ("refinery" in fac_type or "petrochem" in fac_type) and (dist_m <= 2500.0)
        is_power = ("power" in fac_type) and (dist_m <= 2000.0)
        is_industrial = (fac_type in ("industrial", "factory", "works", "mine", "quarry") or is_flare or is_refinery or is_power) and (dist_m <= 3000.0)

        # Distance to industrial normalized [0, 1] where 1 is touching (0m) and 0 is >= 5000m
        dist_to_ind_m = dist_m if is_industrial else None
        ind_proximity_norm = max(0.0, 1.0 - (dist_m / 5000.0)) if is_industrial else 0.0

        # Feature vector for ML (standard numeric representations)
        ml_vector = {
            "frp": frp,
            "brightness_temperature": bt,
            "confidence_normalized": conf_norm,
            "is_night": 1.0 if daynight == "N" else 0.0,
            "is_industrial_zone": 1.0 if is_industrial else 0.0,
            "is_flare_adjacent": 1.0 if is_flare else 0.0,
            "is_refinery_adjacent": 1.0 if is_refinery else 0.0,
            "is_power_adjacent": 1.0 if is_power else 0.0,
            "industrial_proximity_factor": round(ind_proximity_norm, 3),
            "persistence_score": round(persistence_score, 3),
            "cluster_density": float(cluster_density),
            "is_farmland": 1.0 if land_use == "farmland" else 0.0,
            "is_forest": 1.0 if land_use == "forest" else 0.0,
        }

        return {
            "land_use_type": land_use,
            "vegetation_context": land_context.get("vegetation_context"),
            "is_industrial_zone": is_industrial,
            "is_flare_adjacent": is_flare,
            "is_refinery_adjacent": is_refinery,
            "is_power_plant_adjacent": is_power,
            "distance_to_nearest_industrial_m": round(dist_to_ind_m, 1) if dist_to_ind_m else None,
            "spatial_cluster_density": cluster_density,
            "ml_feature_vector": ml_vector,
            "ml_feature_vector_json": json.dumps(ml_vector)
        }


feature_service = FeatureService()

"""
Unified end-to-end data pipeline orchestrator.
Coordinates:
FIRMS ingestion -> validation -> normalization -> deduplication
-> geospatial enrichment (OSM) -> satellite land context
-> persistence analysis -> feature engineering -> classification scoring
-> database persistence.
"""
import time
import json
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from backend.app.models.thermal_event import ThermalEvent
from backend.app.models.facility_context import FacilityContext
from backend.app.models.event_features import EventFeatures
from backend.app.models.persistence_group import PersistenceGroup

from backend.app.services.firms_service import firms_service
from backend.app.services.osm_service import osm_service
from backend.app.services.satellite_service import land_cover_service
from backend.app.services.persistence_service import persistence_service
from backend.app.services.feature_service import feature_service
from backend.app.services.classification_service import classification_service

from backend.app.utils.geo import haversine_distance_meters

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    def process_raw_events(
        self,
        db: Session,
        raw_events: List[Dict[str, Any]],
        source_label: str = "PIPELINE"
    ) -> Dict[str, Any]:
        """
        Execute complete data pipeline for a batch of raw thermal events.
        """
        start_time = time.time()
        received_count = len(raw_events)

        # 1. Fetch existing signatures for deduplication
        existing_records = db.query(
            ThermalEvent.latitude,
            ThermalEvent.longitude,
            ThermalEvent.acq_date,
            ThermalEvent.acq_time,
            ThermalEvent.satellite
        ).all()

        existing_signatures = {
            (round(r.latitude, 3), round(r.longitude, 3), r.acq_date, r.acq_time, r.satellite)
            for r in existing_records
        }

        # 2. Validation, Normalization, and Deduplication
        valid_events, rejected_count, duplicate_count = firms_service.validate_and_deduplicate(
            raw_events,
            existing_signatures
        )

        logger.info(
            f"Pipeline [{source_label}]: Received {received_count}, "
            f"Validated {len(valid_events)}, Rejected {rejected_count}, Duplicate {duplicate_count}"
        )

        persisted_events = []

        # 3. Processing each valid event through enrichment, persistence, and classification
        for evt_data in valid_events:
            lat = evt_data["latitude"]
            lon = evt_data["longitude"]
            acq_date = evt_data["acq_date"]
            location_hint = evt_data.get("location_name")

            # A. OpenStreetMap Enrichment
            osm_match = osm_service.enrich_event(lat, lon)

            # B. Satellite Land-Cover Context
            land_ctx = land_cover_service.get_land_cover_context(lat, lon)

            # C. Persistence Grouping & Analysis
            p_group = persistence_service.assign_or_create_persistence_group(
                db=db,
                latitude=lat,
                longitude=lon,
                acq_date=acq_date,
                location_hint=location_hint
            )

            # D. Estimate local cluster density (within 5km)
            cluster_density = 1
            for other_evt in valid_events:
                if other_evt is not evt_data:
                    d = haversine_distance_meters(lat, lon, other_evt["latitude"], other_evt["longitude"])
                    if d <= 5000.0:
                        cluster_density += 1

            # E. Feature Engineering
            features_dict = feature_service.extract_features(
                event_dict=evt_data,
                facility_context=osm_match,
                land_context=land_ctx,
                persistence_score=p_group.persistence_score,
                cluster_density=cluster_density
            )

            # F. Classification Scoring (Evidence-based heuristic)
            scores_result = classification_service.compute_scores(
                event_dict=evt_data,
                facility_context=osm_match,
                land_context=land_ctx,
                persistence_score=p_group.persistence_score,
                cluster_density=cluster_density
            )

            # G. Database Persistence - ThermalEvent
            thermal_event = ThermalEvent(
                latitude=lat,
                longitude=lon,
                acq_date=evt_data["acq_date"],
                acq_time=evt_data["acq_time"],
                satellite=evt_data["satellite"],
                instrument=evt_data["instrument"],
                frp=evt_data["frp"],
                brightness_temperature=evt_data["brightness_temperature"],
                bright_secondary=evt_data["bright_secondary"],
                confidence_raw=evt_data["confidence_raw"],
                confidence_normalized=evt_data["confidence_normalized"],
                scan=evt_data["scan"],
                track=evt_data["track"],
                daynight=evt_data["daynight"],
                location_name=location_hint,
                region=evt_data.get("region"),
                source=evt_data.get("source", source_label),
                persistence_group_id=p_group.id
            )
            db.add(thermal_event)
            db.flush() # Populate thermal_event.id

            # H. Database Persistence - FacilityContext
            fac_context = FacilityContext(
                event_id=thermal_event.id,
                nearest_facility_name=osm_match.get("nearest_facility_name"),
                nearest_facility_type=osm_match.get("nearest_facility_type", "unknown"),
                distance_meters=osm_match.get("distance_meters", 3000.0),
                osm_id=osm_match.get("osm_id"),
                osm_type=osm_match.get("osm_type"),
                tags_json=json.dumps(osm_match.get("tags", {})),
                search_radius_meters=osm_match.get("search_radius_meters", 3000.0),
                enrichment_source=osm_match.get("enrichment_source", "OFFLINE_CACHE")
            )
            db.add(fac_context)

            # I. Database Persistence - EventFeatures
            event_features = EventFeatures(
                event_id=thermal_event.id,
                land_use_type=features_dict["land_use_type"],
                vegetation_context=features_dict["vegetation_context"],
                is_industrial_zone=features_dict["is_industrial_zone"],
                is_flare_adjacent=features_dict["is_flare_adjacent"],
                is_refinery_adjacent=features_dict["is_refinery_adjacent"],
                is_power_plant_adjacent=features_dict["is_power_plant_adjacent"],
                distance_to_nearest_industrial_m=features_dict["distance_to_nearest_industrial_m"],
                spatial_cluster_density=features_dict["spatial_cluster_density"],
                industrial_score=scores_result["industrial_score"],
                flare_score=scores_result["flare_score"],
                agriculture_score=scores_result["agriculture_score"],
                wildfire_score=scores_result["wildfire_score"],
                persistence_score=scores_result["persistence_score"],
                overall_model_confidence=scores_result["overall_model_confidence"],
                heuristic_classification=scores_result["heuristic_classification"],
                scoring_mode=scores_result["scoring_mode"],
                feature_vector_json=features_dict["ml_feature_vector_json"]
            )
            db.add(event_features)

            # Update dominant category on PersistenceGroup
            p_group.dominant_category = scores_result["heuristic_classification"]

            persisted_events.append(thermal_event)

        db.commit()

        duration = round(time.time() - start_time, 2)
        total_clusters = db.query(PersistenceGroup).count()

        return {
            "status": "success",
            "message": f"Processed {len(persisted_events)} thermal events successfully.",
            "source": source_label,
            "events_received": received_count,
            "events_validated": len(valid_events),
            "events_deduplicated": duplicate_count,
            "events_enriched": len(persisted_events),
            "clusters_formed": total_clusters,
            "execution_time_seconds": duration,
            "sample_event_ids": [e.id for e in persisted_events[:5]]
        }


pipeline_orchestrator = PipelineOrchestrator()

"""
Unit tests for pipeline services:
- FIRMS ingestion & deduplication
- OSM proximity enrichment
- Land cover satellite contextualization
- Heuristic multi-score classification
- Persistence spatial grouping
"""
import pytest
from backend.app.services.firms_service import firms_service
from backend.app.services.osm_service import osm_service
from backend.app.services.satellite_service import land_cover_service
from backend.app.services.classification_service import (
    classification_service,
    CLASS_FLARE,
    CLASS_AGRI,
    CLASS_INDUSTRIAL,
)
from backend.app.database.connection import SessionLocal, init_db
from backend.app.services.persistence_service import persistence_service


@pytest.fixture(scope="module")
def db_session():
    init_db()
    db = SessionLocal()
    yield db
    db.close()


def test_firms_mock_loading_and_deduplication():
    events = firms_service.load_mock_events(shift_to_today=False)
    assert len(events) > 0

    # Test deduplication
    signatures = set()
    validated, rejected, dupes = firms_service.validate_and_deduplicate(events, signatures)
    assert len(validated) > 0
    assert rejected == 0

    # Feeding same events again should all be detected as duplicates
    validated_2, _, dupes_2 = firms_service.validate_and_deduplicate(events, signatures)
    assert len(validated_2) == 0
    assert dupes_2 == len(events)


def test_osm_facility_enrichment():
    # Jamnagar refinery coordinates (approx 22.35, 69.85)
    result = osm_service.enrich_event(22.35, 69.85)
    assert result is not None
    assert "nearest_facility_name" in result
    assert "distance_meters" in result
    assert result["distance_meters"] <= 3000.0


def test_land_cover_service():
    # Forest zone (e.g. Siberia/Boreal 60.0, 100.0) or Farmland (Punjab 30.5, 75.8)
    ctx_farm = land_cover_service.get_land_cover_context(30.5, 75.8)
    assert ctx_farm["land_use_type"] == "farmland"
    assert "provider" in ctx_farm

    ctx_ind = land_cover_service.get_land_cover_context(22.4, 69.9)
    assert ctx_ind["land_use_type"] == "industrial"


def test_classification_service_flare():
    # Simulating a gas flare event adjacent to flare stack with high BT and nighttime recurrence
    mock_event = {
        "brightness_temperature": 375.0,
        "frp": 65.0,
        "confidence_normalized": 0.95,
        "daynight": "N"
    }
    facility_context = {
        "nearest_facility_type": "flare_stack",
        "distance_meters": 150.0,
        "nearest_facility_name": "Jamnagar Flare Stack Pad A"
    }
    land_context = {
        "land_use_type": "industrial",
        "vegetation_context": "barren_coastal"
    }
    scores = classification_service.compute_scores(
        event_dict=mock_event,
        facility_context=facility_context,
        land_context=land_context,
        persistence_score=0.9,
        cluster_density=1
    )
    assert scores["heuristic_classification"] == CLASS_FLARE
    assert scores["flare_score"] > 0.6


def test_classification_service_agricultural():
    # Simulating crop residue burning in Punjab with daytime acquisition and farmland
    mock_event = {
        "brightness_temperature": 315.0,
        "frp": 15.0,
        "confidence_normalized": 0.8,
        "daynight": "D"
    }
    facility_context = {
        "nearest_facility_type": "farmland",
        "distance_meters": 5000.0,
        "nearest_facility_name": None
    }
    land_context = {
        "land_use_type": "farmland",
        "vegetation_context": "crop_residue_canopy"
    }
    scores = classification_service.compute_scores(
        event_dict=mock_event,
        facility_context=facility_context,
        land_context=land_context,
        persistence_score=0.1,
        cluster_density=5
    )
    assert scores["heuristic_classification"] == CLASS_AGRI
    assert scores["agriculture_score"] > 0.5


def test_persistence_service_grouping(db_session):
    lat, lon = 22.3512, 69.8523
    group1 = persistence_service.assign_or_create_persistence_group(
        db=db_session,
        latitude=lat,
        longitude=lon,
        acq_date="2026-09-01",
        location_hint="Jamnagar Test"
    )
    db_session.commit()
    assert group1.id is not None
    assert group1.detection_count == 1

    # Same location on subsequent day
    group2 = persistence_service.assign_or_create_persistence_group(
        db=db_session,
        latitude=lat + 0.001, # ~110m away (well within 1500m threshold)
        longitude=lon + 0.001,
        acq_date="2026-09-02",
        location_hint="Jamnagar Test"
    )
    db_session.commit()
    assert group2.id == group1.id
    assert group2.detection_count == 2
    assert group2.active_days == 2
    assert group2.persistence_score > 0.0

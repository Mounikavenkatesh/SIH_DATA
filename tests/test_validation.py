"""
Unit tests for data validation, coordinates normalization, and geospatial utilities.
"""
import pytest
from backend.app.utils.validators import validate_and_clean_event
from backend.app.utils.geo import haversine_distance_meters, bounding_box_for_radius


def test_valid_viirs_event_cleaning():
    raw_event = {
        "latitude": "22.5726",
        "longitude": "88.3639",
        "acq_date": "2026-09-01",
        "acq_time": "1345",
        "satellite": "Suomi-NPP",
        "instrument": "VIIRS",
        "frp": "24.5",
        "bright_ti4": "345.2",
        "bright_ti5": "298.1",
        "confidence": "high",
        "daynight": "D"
    }
    is_valid, reason, cleaned = validate_and_clean_event(raw_event)
    assert is_valid is True
    assert reason is None
    assert isinstance(cleaned["latitude"], float)
    assert cleaned["latitude"] == 22.5726
    assert isinstance(cleaned["longitude"], float)
    assert cleaned["confidence_normalized"] == 1.0
    assert cleaned["frp"] == 24.5


def test_invalid_coordinates_rejected():
    # Latitude > 90
    bad_lat = {
        "latitude": "95.0",
        "longitude": "75.0",
        "acq_date": "2026-09-01",
        "acq_time": "1200",
        "satellite": "N20",
        "confidence": "nominal"
    }
    is_valid, reason, _ = validate_and_clean_event(bad_lat)
    assert is_valid is False
    assert "out of physical range" in reason

    # Longitude < -180
    bad_lon = {
        "latitude": "20.0",
        "longitude": "-195.0",
        "acq_date": "2026-09-01",
        "acq_time": "1200",
        "satellite": "N20",
        "confidence": "nominal"
    }
    is_valid, reason, _ = validate_and_clean_event(bad_lon)
    assert is_valid is False
    assert "out of physical range" in reason


def test_confidence_normalization_variants():
    # Percentage integer string
    ev1 = {"latitude": 20.0, "longitude": 75.0, "confidence": "85", "acq_date": "2026-09-01", "acq_time": "0100", "satellite": "Terra"}
    _, _, c1 = validate_and_clean_event(ev1)
    assert c1["confidence_normalized"] == 0.85

    # Nominal keyword
    ev2 = {"latitude": 20.0, "longitude": 75.0, "confidence": "n", "acq_date": "2026-09-01", "acq_time": "0100", "satellite": "Terra"}
    _, _, c2 = validate_and_clean_event(ev2)
    assert c2["confidence_normalized"] == 0.70

    # Low keyword
    ev3 = {"latitude": 20.0, "longitude": 75.0, "confidence": "l", "acq_date": "2026-09-01", "acq_time": "0100", "satellite": "Terra"}
    _, _, c3 = validate_and_clean_event(ev3)
    assert c3["confidence_normalized"] == 0.30


def test_haversine_distance():
    # Known distance: Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777) ~ 1148 km
    dist = haversine_distance_meters(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1_100_000 < dist < 1_200_000

    # Zero distance between identical points
    assert haversine_distance_meters(22.0, 80.0, 22.0, 80.0) == 0.0


def test_bounding_box_generation():
    lat, lon = 22.5, 75.0
    radius_m = 3000.0 # 3 km
    min_lat, min_lon, max_lat, max_lon = bounding_box_for_radius(lat, lon, radius_m)

    assert min_lat < lat < max_lat
    assert min_lon < lon < max_lon

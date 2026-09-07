"""
End-to-end integration tests for REST API endpoints using FastAPI TestClient.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.connection import init_db

# Initialize database schema before tests
init_db()
client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database" in data
    assert "modules" in data


def test_ingest_mock_data():
    # Ingest mock data with clear_existing=True for clean test slate
    response = client.post(
        "/api/v1/ingest/mock",
        json={"shift_dates_to_today": True, "clear_existing": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["events_enriched"] > 0
    assert data["clusters_formed"] > 0


def test_list_events():
    response = client.get("/api/v1/events?limit=20")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    events = data["events"]
    assert isinstance(events, list)
    assert len(events) > 0

    first_event = events[0]
    assert "id" in first_event
    assert "latitude" in first_event
    assert "longitude" in first_event
    assert "frp" in first_event
    assert "features" in first_event
    assert first_event["features"]["heuristic_classification"] is not None


def test_list_events_geojson():
    response = client.get("/api/v1/events?format=geojson&limit=20")
    assert response.status_code == 200
    geojson = response.json()
    assert geojson["type"] == "FeatureCollection"
    assert "features" in geojson
    assert len(geojson["features"]) > 0

    feature = geojson["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "Point"
    assert len(feature["geometry"]["coordinates"]) == 2
    assert "classification" in feature["properties"]


def test_get_event_context():
    # Fetch first event ID
    events_res = client.get("/api/v1/events?limit=1")
    events = events_res.json()["events"]
    assert len(events) > 0
    event_id = events[0]["id"]

    # Request multi-layer context
    context_res = client.get(f"/api/v1/events/{event_id}/context")
    assert context_res.status_code == 200
    context_data = context_res.json()

    assert context_data["event_id"] == event_id
    assert "telemetry" in context_data
    assert "facility_context" in context_data
    assert "land_cover_context" in context_data
    assert "classification" in context_data
    assert "ml_feature_vector" in context_data


def test_statistics_endpoint():
    response = client.get("/api/v1/statistics")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_events"] > 0
    assert stats["total_persistent_clusters"] > 0
    assert len(stats["categories_breakdown"]) > 0
    assert "persistence_summary" in stats


def test_persistence_clusters_endpoints():
    response = client.get("/api/v1/clusters?limit=10")
    assert response.status_code == 200
    clusters = response.json()
    assert isinstance(clusters, list)
    assert len(clusters) > 0

    cluster_id = clusters[0]["id"]
    detail_res = client.get(f"/api/v1/clusters/{cluster_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == cluster_id
    assert "event_ids" in detail
    assert isinstance(detail["event_ids"], list)


def test_resolve_fire_incident():
    events_res = client.get("/api/v1/events?limit=1")
    event = events_res.json()["events"][0]
    event_id = event["id"]

    res = client.post(f"/api/v1/events/{event_id}/resolve")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["new_status"] == "Resolved"
    assert data["severity"] in ["Resolved / No active source", "No Fire"]

    # Verify via context endpoint
    ctx_res = client.get(f"/api/v1/events/{event_id}/context")
    assert ctx_res.status_code == 200
    ctx_data = ctx_res.json()
    assert ctx_data["status"] == "Resolved"
    assert ctx_data["severity"] in ["Resolved / No active source", "No Fire"]


def test_simulate_fire_detection():
    res = client.post("/api/v1/events/simulate-detection")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "fire_id" in data
    assert "latitude" in data
    assert "longitude" in data
    assert "location_name" in data
    assert data["latitude"] is not None
    assert data["longitude"] is not None


def test_filter_by_severity_and_status():
    res = client.get("/api/v1/events?severity=Critical")
    assert res.status_code == 200
    data = res.json()
    for e in data["events"]:
        assert "Critical" in e["severity"] or "High" in e["severity"]

    res_stat = client.get("/api/v1/events?status=Resolved")
    assert res_stat.status_code == 200
    data_stat = res_stat.json()
    assert len(data_stat["events"]) >= 1
    assert data_stat["events"][0]["status"] == "Resolved"


def test_statistics_fire_telemetry_metrics():
    res = client.get("/api/v1/statistics")
    assert res.status_code == 200
    data = res.json()
    assert "total_fires" in data
    assert "active_fires" in data
    assert "critical_fires" in data
    assert "resolved_incidents" in data
    assert "recent_incidents" in data
    assert isinstance(data["recent_incidents"], list)
    if data["recent_incidents"]:
        first = data["recent_incidents"][0]
        assert "latitude" in first
        assert "longitude" in first
        assert "coordinates" in first


def test_clear_events_endpoint():
    response = client.post("/api/v1/ingest/clear")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["deleted_events"] > 0

    # Verify event count is 0
    stats_res = client.get("/api/v1/statistics")
    stats = stats_res.json()
    assert stats["total_events"] == 0
    assert stats["total_persistent_clusters"] == 0

    # Re-seed for subsequent operations/dashboard
    reseed_res = client.post(
        "/api/v1/ingest/mock",
        json={"shift_dates_to_today": True, "clear_existing": False}
    )
    assert reseed_res.status_code == 200

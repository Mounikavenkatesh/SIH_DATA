"""
OpenStreetMap geospatial enrichment service.
Identifies nearby industrial complexes, refineries, flare stacks, power plants, mines, and farmlands.
Features live Overpass API queries with automatic fallback to offline ground-truth facilities.
"""
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import requests

from backend.app.config import settings
from backend.app.utils.geo import haversine_distance_meters, bounding_box_for_radius

logger = logging.getLogger(__name__)

# Key industrial and infrastructural tags recognized in OSM
INDUSTRIAL_TAG_WEIGHTS = {
    "gas_flare": 1.0,
    "flare": 1.0,
    "refinery": 0.95,
    "petrochemical": 0.90,
    "gas_processing": 0.90,
    "power_plant": 0.85,
    "factory": 0.70,
    "works": 0.70,
    "industrial": 0.65,
    "mine": 0.60,
    "quarry": 0.60,
    "warehouse": 0.40,
    "farmland": 0.10,
    "forest": 0.05,
    "unknown": 0.0,
}


class OsmService:
    def __init__(self):
        self.default_radius = settings.OSM_SEARCH_RADIUS_METERS
        self.overpass_url = settings.OSM_OVERPASS_URL
        self.timeout = settings.OSM_TIMEOUT_SECONDS
        self.cache_enabled = settings.OSM_CACHE_ENABLED
        self.offline_facilities_path = Path("data/mock_osm_facilities.json")
        self._offline_facilities: List[Dict[str, Any]] = []
        self._load_offline_facilities()

    def _load_offline_facilities(self):
        """Pre-load offline ground-truth facilities from JSON for instant spatial matching."""
        if self.offline_facilities_path.exists():
            try:
                with open(self.offline_facilities_path, "r", encoding="utf-8") as f:
                    self._offline_facilities = json.load(f)
                logger.info(f"Loaded {len(self._offline_facilities)} offline OSM reference facilities.")
            except Exception as e:
                logger.error(f"Failed to load offline OSM facilities: {e}")

    def query_overpass_live(self, lat: float, lon: float, radius_meters: float) -> Optional[Dict[str, Any]]:
        """
        Query the live OpenStreetMap Overpass API for facilities within radius_meters.
        Filters for industrial, power, man_made=flare/works, landuse=industrial/quarry/farmland.
        """
        overpass_query = f"""
        [out:json][timeout:{self.timeout}];
        (
          node["man_made"~"gas_flare|flare|works"](around:{radius_meters},{lat},{lon});
          node["industrial"~"refinery|gas_processing|chemical|factory"](around:{radius_meters},{lat},{lon});
          node["power"="plant"](around:{radius_meters},{lat},{lon});
          way["landuse"~"industrial|quarry|farmland|forest"](around:{radius_meters},{lat},{lon});
          way["industrial"~"refinery|chemical|gas_processing"](around:{radius_meters},{lat},{lon});
          way["man_made"~"works|gas_flare"](around:{radius_meters},{lat},{lon});
        );
        out center tags 5;
        """
        try:
            resp = requests.post(self.overpass_url, data={"data": overpass_query}, timeout=self.timeout)
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get("elements", [])
                if elements:
                    return self._select_nearest_element(lat, lon, elements)
        except Exception as ex:
            logger.debug(f"Overpass live query failed or timed out: {ex}")
        
        return None

    def _select_nearest_element(self, lat: float, lon: float, elements: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Find the closest element from Overpass results and parse its facility type."""
        best_match = None
        min_dist = float("inf")

        for el in elements:
            el_lat = el.get("lat") or el.get("center", {}).get("lat")
            el_lon = el.get("lon") or el.get("center", {}).get("lon")
            if el_lat is None or el_lon is None:
                continue

            dist = haversine_distance_meters(lat, lon, el_lat, el_lon)
            if dist < min_dist:
                min_dist = dist
                tags = el.get("tags", {})
                facility_type = self._classify_facility_type(tags)
                facility_name = tags.get("name") or tags.get("operator") or f"{facility_type.capitalize()} Facility"
                
                best_match = {
                    "nearest_facility_name": facility_name,
                    "nearest_facility_type": facility_type,
                    "distance_meters": round(dist, 1),
                    "osm_id": f"{el.get('type')}/{el.get('id')}",
                    "osm_type": el.get("type"),
                    "tags": tags,
                    "search_radius_meters": settings.OSM_SEARCH_RADIUS_METERS,
                    "enrichment_source": "OVERPASS_LIVE"
                }

        return best_match

    def _query_offline_facilities(self, lat: float, lon: float, radius_meters: float) -> Optional[Dict[str, Any]]:
        """Search in offline cached facilities using Haversine distance."""
        best_match = None
        min_dist = float("inf")

        for fac in self._offline_facilities:
            f_lat = fac.get("latitude")
            f_lon = fac.get("longitude")
            if f_lat is None or f_lon is None:
                continue

            dist = haversine_distance_meters(lat, lon, f_lat, f_lon)
            if dist <= radius_meters and dist < min_dist:
                min_dist = dist
                best_match = {
                    "nearest_facility_name": fac.get("name", "Unknown Facility"),
                    "nearest_facility_type": fac.get("facility_type", "industrial"),
                    "distance_meters": round(dist, 1),
                    "osm_id": fac.get("osm_id"),
                    "osm_type": fac.get("osm_type", "node"),
                    "tags": fac.get("tags", {}),
                    "search_radius_meters": radius_meters,
                    "enrichment_source": "OFFLINE_CACHE"
                }

        return best_match

    def _classify_facility_type(self, tags: Dict[str, Any]) -> str:
        """Derive normalized facility type from OSM key-value pairs."""
        man_made = str(tags.get("man_made", "")).lower()
        industrial = str(tags.get("industrial", "")).lower()
        landuse = str(tags.get("landuse", "")).lower()
        power = str(tags.get("power", "")).lower()
        plant = str(tags.get("plant", "")).lower()

        if "flare" in man_made or "flare" in industrial or tags.get("petroleum") == "gas_flare":
            return "gas_flare"
        if "refinery" in industrial or "refinery" in plant:
            return "refinery"
        if "chemical" in industrial or "petrochemical" in industrial:
            return "petrochemical"
        if "gas" in industrial or "gas_processing" in industrial:
            return "gas_processing"
        if power == "plant" or "generator" in power:
            return "power_plant"
        if "quarry" in landuse or tags.get("mine") == "open_pit" or "mining" in industrial:
            return "mine"
        if "warehouse" in tags.get("building", ""):
            return "warehouse"
        if man_made == "works" or industrial == "factory":
            return "factory"
        if landuse == "industrial":
            return "industrial"
        if landuse in ("farmland", "farm", "orchard"):
            return "farmland"
        if landuse in ("forest", "wood") or tags.get("natural") in ("wood", "forest"):
            return "forest"

        return "industrial"

    def enrich_event(self, lat: float, lon: float, radius_meters: Optional[float] = None) -> Dict[str, Any]:
        """
        Enrich a thermal event coordinate with nearby facility context.
        First attempts offline index (instant, deterministic), then falls back or complements with live Overpass.
        """
        radius = radius_meters or self.default_radius
        
        # Check offline cache first (for speed and hackathon reliability)
        offline_match = self._query_offline_facilities(lat, lon, radius)
        if offline_match is not None:
            return offline_match

        # Otherwise attempt live Overpass API
        live_match = self.query_overpass_live(lat, lon, radius)
        if live_match is not None:
            return live_match

        # Default fallback if no facility within radius
        return {
            "nearest_facility_name": None,
            "nearest_facility_type": "none_in_radius",
            "distance_meters": radius,
            "osm_id": None,
            "osm_type": None,
            "tags": {},
            "search_radius_meters": radius,
            "enrichment_source": "NO_FACILITY_FOUND"
        }


osm_service = OsmService()

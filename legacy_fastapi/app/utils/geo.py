"""
Geospatial math and projection utilities.
High-precision Haversine distance, bounding box calculations, and centroid averaging.
"""
import math
from typing import List, Tuple

# Earth mean radius in meters (WGS-84 / IUGG)
EARTH_RADIUS_METERS = 6371008.8


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the Earth's surface
    using the Haversine formula.

    Returns:
        Distance in meters.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_METERS * c


def is_within_radius(lat1: float, lon1: float, lat2: float, lon2: float, radius_meters: float) -> bool:
    """Return True if distance between (lat1, lon1) and (lat2, lon2) is <= radius_meters."""
    return haversine_distance_meters(lat1, lon1, lat2, lon2) <= radius_meters


def calculate_centroid(coords: List[Tuple[float, float]]) -> Tuple[float, float]:
    """
    Calculate the geographic centroid (mean latitude, mean longitude) of a list of coordinates.
    """
    if not coords:
        return (0.0, 0.0)
    
    total_lat = sum(c[0] for c in coords)
    total_lon = sum(c[1] for c in coords)
    n = len(coords)
    return (round(total_lat / n, 6), round(total_lon / n, 6))


def bounding_box_for_radius(lat: float, lon: float, radius_km: float) -> Tuple[float, float, float, float]:
    """
    Calculate a bounding box (min_lat, min_lon, max_lat, max_lon) for a given coordinate and radius.
    Useful for fast DB indexing before precise Haversine filtering.
    """
    # 1 deg latitude ~ 111.32 km
    delta_lat = radius_km / 111.32
    # 1 deg longitude varies with latitude
    lat_rad = math.radians(lat)
    cos_lat = math.cos(lat_rad)
    if abs(cos_lat) < 1e-6:
        delta_lon = 180.0
    else:
        delta_lon = radius_km / (111.32 * cos_lat)

    min_lat = max(-90.0, lat - delta_lat)
    max_lat = min(90.0, lat + delta_lat)
    min_lon = max(-180.0, lon - delta_lon)
    max_lon = min(180.0, lon + delta_lon)

    return (round(min_lat, 6), round(min_lon, 6), round(max_lat, 6), round(max_lon, 6))

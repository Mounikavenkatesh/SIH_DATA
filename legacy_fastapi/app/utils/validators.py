"""
Data quality validation and normalization engine for FIRMS observations.
Ensures valid physical boundaries, handles missing fields, and normalizes confidence.
"""
from typing import Tuple, Optional, Any, Dict
import logging

logger = logging.getLogger(__name__)


def validate_coordinates(lat: Any, lon: Any) -> Tuple[bool, Optional[str]]:
    """Validate latitude and longitude ranges."""
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (ValueError, TypeError):
        return False, f"Coordinates must be numeric: lat={lat}, lon={lon}"

    if not (-90.0 <= lat_f <= 90.0):
        return False, f"Latitude {lat_f} is out of physical range [-90, 90]"
    if not (-180.0 <= lon_f <= 180.0):
        return False, f"Longitude {lon_f} is out of physical range [-180, 180]"

    return True, None


def validate_frp(frp: Any) -> Tuple[bool, Optional[str]]:
    """Validate Fire Radiative Power (MW)."""
    try:
        frp_f = float(frp)
    except (ValueError, TypeError):
        return False, f"FRP must be numeric: {frp}"

    if frp_f < 0.0:
        return False, f"FRP cannot be negative: {frp_f} MW"
    if frp_f > 20000.0:
        return False, f"FRP {frp_f} MW exceeds plausible physical limit (20,000 MW)"

    return True, None


def validate_brightness_temperature(temp: Any) -> Tuple[bool, Optional[str]]:
    """Validate brightness temperature in Kelvin."""
    try:
        t_f = float(temp)
    except (ValueError, TypeError):
        return False, f"Brightness temperature must be numeric: {temp}"

    # Terrestrial thermal fire detections range between ~250K (ambient winter) and ~550K (sensor saturation)
    if not (200.0 <= t_f <= 600.0):
        return False, f"Brightness temperature {t_f} K is outside plausible terrestrial range [200, 600]"

    return True, None


def normalize_confidence(confidence: Any, instrument: str = "VIIRS") -> Tuple[str, float]:
    """
    Normalize instrument-specific confidence to a standardized (raw_str, 0.0 - 1.0) float tuple.
    
    VIIRS uses categorical labels: 'l'/'low', 'n'/'nominal', 'h'/'high'.
    MODIS uses percentage: 0 to 100%.
    """
    raw_str = str(confidence).strip().lower() if confidence is not None else "nominal"

    if raw_str in ("high", "h"):
        return "high", 1.0
    elif raw_str in ("nominal", "n", "med", "medium"):
        return "nominal", 0.7
    elif raw_str in ("low", "l"):
        return "low", 0.3

    # Try numeric conversion (MODIS 0-100%)
    try:
        num = float(confidence)
        if 0.0 <= num <= 100.0:
            norm_val = round(num / 100.0, 3)
            category = "high" if num >= 80 else ("nominal" if num >= 40 else "low")
            return category, norm_val
        elif 0.0 <= num <= 1.0:
            category = "high" if num >= 0.8 else ("nominal" if num >= 0.4 else "low")
            return category, round(num, 3)
    except (ValueError, TypeError):
        pass

    return "nominal", 0.7


def validate_and_clean_event(raw: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Comprehensive validation and normalization for a single raw FIRMS record.
    Returns:
        (is_valid, error_reason, cleaned_dict)
    """
    # 1. Coordinates
    lat = raw.get("latitude") or raw.get("lat")
    lon = raw.get("longitude") or raw.get("lon")
    valid_coords, coord_err = validate_coordinates(lat, lon)
    if not valid_coords:
        return False, coord_err, None

    # 2. FRP
    frp_val = raw.get("frp", 0.0)
    valid_frp, frp_err = validate_frp(frp_val)
    if not valid_frp:
        return False, frp_err, None

    # 3. Brightness temperature
    bt = (raw.get("bright_ti4") or
          raw.get("brightness") or
          raw.get("brightness_temperature") or
          raw.get("bright_t31") or
          300.0)
    valid_bt, bt_err = validate_brightness_temperature(bt)
    if not valid_bt:
        return False, bt_err, None

    # 4. Secondary brightness
    bt_sec = raw.get("bright_ti5") or raw.get("bright_t31")
    bt_sec_f = float(bt_sec) if bt_sec is not None else None

    # 5. Acquisition date & time
    acq_date = str(raw.get("acq_date", "2026-09-01")).strip()
    acq_time = str(raw.get("acq_time", "0000")).strip().zfill(4)

    # 6. Satellite & Instrument
    instrument = str(raw.get("instrument", "VIIRS")).strip().upper()
    satellite = str(raw.get("satellite", "NOAA-20")).strip()

    # Map satellite aliases
    if satellite == "N":
        satellite = "Suomi-NPP"
    elif satellite == "1":
        satellite = "NOAA-20"
    elif satellite == "2":
        satellite = "NOAA-21"

    # 7. Confidence
    raw_conf = raw.get("confidence")
    conf_label, conf_score = normalize_confidence(raw_conf, instrument)

    # 8. Cleaned output
    cleaned = {
        "latitude": round(float(lat), 6),
        "longitude": round(float(lon), 6),
        "acq_date": acq_date,
        "acq_time": acq_time,
        "satellite": satellite,
        "instrument": instrument,
        "frp": round(float(frp_val), 2),
        "brightness_temperature": round(float(bt), 2),
        "bright_secondary": round(bt_sec_f, 2) if bt_sec_f is not None else None,
        "confidence_raw": conf_label,
        "confidence_normalized": conf_score,
        "scan": float(raw.get("scan")) if raw.get("scan") is not None else None,
        "track": float(raw.get("track")) if raw.get("track") is not None else None,
        "daynight": str(raw.get("daynight", "D")).strip().upper()[:1],
        "location_name": raw.get("location_name"),
        "region": raw.get("region"),
        "source": raw.get("source", "FIRMS_API"),
    }

    return True, None, cleaned

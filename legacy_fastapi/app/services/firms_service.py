"""
NASA FIRMS ingestion and data normalization service.
Supports live VIIRS/MODIS CSV streaming and robust offline mock data mode.
"""
import io
import csv
import json
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
import requests

from backend.app.config import settings
from backend.app.utils.validators import validate_and_clean_event

logger = logging.getLogger(__name__)


class FirmsService:
    def __init__(self):
        self.map_key = settings.FIRMS_MAP_KEY
        self.base_url = settings.FIRMS_BASE_URL
        self.mock_file_path = Path("data/mock_firms_events.json")

    def is_live_configured(self) -> bool:
        """Check if a real NASA FIRMS API key is provided."""
        return bool(self.map_key and len(self.map_key.strip()) > 8)

    def load_mock_events(self, shift_to_today: bool = True) -> List[Dict[str, Any]]:
        """
        Load realistic thermal events from mock JSON dataset.
        Optionally shifts dates to recent days ending today for realistic hackathon demos.
        """
        if not self.mock_file_path.exists():
            logger.warning(f"Mock data file {self.mock_file_path} not found.")
            return []

        with open(self.mock_file_path, "r", encoding="utf-8") as f:
            raw_events = json.load(f)

        if not shift_to_today or not raw_events:
            return raw_events

        # Calculate time delta so newest event matches today's date
        today = datetime.now(timezone.utc).date()
        try:
            max_date = max(datetime.strptime(e.get("acq_date", "2026-09-05"), "%Y-%m-%d").date() for e in raw_events)
            day_diff = (today - max_date).days
        except Exception:
            day_diff = 0

        shifted_events = []
        for event in raw_events:
            evt_copy = dict(event)
            try:
                orig_date = datetime.strptime(evt_copy.get("acq_date", "2026-09-01"), "%Y-%m-%d").date()
                new_date = orig_date + timedelta(days=day_diff)
                evt_copy["acq_date"] = new_date.strftime("%Y-%m-%d")
            except Exception:
                pass
            shifted_events.append(evt_copy)

        return shifted_events

    def fetch_live_firms_csv(self, country_code: str = "IND", source: str = "VIIRS_SNPP_NRT", day_range: int = 1) -> List[Dict[str, Any]]:
        """
        Fetch near-real-time active fire data from NASA FIRMS Country API.
        URL pattern: https://firms.modaps.eosdis.nasa.gov/api/country/csv/[MAP_KEY]/[SOURCE]/[COUNTRY]/[DAY_RANGE]
        """
        if not self.is_live_configured():
            logger.info("NASA FIRMS Map Key is not configured. Falling back to mock dataset.")
            return self.load_mock_events(shift_to_today=True)

        url = f"{self.base_url}/{self.map_key.strip()}/{source}/{country_code}/{day_range}"
        logger.info(f"Querying NASA FIRMS live API: source={source}, country={country_code}, days={day_range}")
        
        try:
            response = requests.get(url, timeout=25)
            response.raise_for_status()

            csv_text = response.text
            if not csv_text or "Bad MAP_KEY" in csv_text or "Error" in csv_text[:100]:
                logger.error(f"FIRMS API returned error message: {csv_text[:200]}")
                return self.load_mock_events(shift_to_today=True)

            reader = csv.DictReader(io.StringIO(csv_text))
            events = []
            for row in reader:
                # Add instrument metadata based on source
                row["source"] = "FIRMS_API"
                if "VIIRS" in source:
                    row["instrument"] = "VIIRS"
                elif "MODIS" in source:
                    row["instrument"] = "MODIS"
                events.append(row)

            logger.info(f"Successfully fetched {len(events)} events from NASA FIRMS live API.")
            return events

        except Exception as ex:
            logger.error(f"Failed to query NASA FIRMS API: {ex}. Falling back to mock dataset.")
            return self.load_mock_events(shift_to_today=True)

    def validate_and_deduplicate(
        self,
        raw_events: List[Dict[str, Any]],
        existing_signatures: set
    ) -> Tuple[List[Dict[str, Any]], int, int]:
        """
        Validate data quality and filter duplicates.
        Deduplication signature: (round(lat, 3), round(lon, 3), acq_date, acq_time, satellite)
        """
        validated_events = []
        rejected_count = 0
        duplicate_count = 0

        for raw in raw_events:
            is_valid, reason, cleaned = validate_and_clean_event(raw)
            if not is_valid or cleaned is None:
                rejected_count += 1
                logger.debug(f"Rejected event: {reason}")
                continue

            # Create spatial-temporal signature
            sig = (
                round(cleaned["latitude"], 3),
                round(cleaned["longitude"], 3),
                cleaned["acq_date"],
                cleaned["acq_time"],
                cleaned["satellite"]
            )

            if sig in existing_signatures:
                duplicate_count += 1
                continue

            existing_signatures.add(sig)
            validated_events.append(cleaned)

        return validated_events, rejected_count, duplicate_count


firms_service = FirmsService()

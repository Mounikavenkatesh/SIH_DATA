"""
Application configuration using Pydantic Settings.
Loads configuration from environment variables or .env file.
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Satellite Thermal Intelligence Pipeline"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database
    DATABASE_URL: str = "sqlite:///./data/thermal_intelligence.db"

    # NASA FIRMS API
    FIRMS_MAP_KEY: str = ""
    FIRMS_DEFAULT_SOURCE: str = "VIIRS_SNPP_NRT"
    FIRMS_DEFAULT_COUNTRY: str = "IND"
    FIRMS_BASE_URL: str = "https://firms.modaps.eosdis.nasa.gov/api/country/csv"

    # OpenStreetMap
    OSM_SEARCH_RADIUS_METERS: float = 3000.0
    OSM_OVERPASS_URL: str = "https://overpass-api.de/api/interpreter"
    OSM_TIMEOUT_SECONDS: int = 10
    OSM_CACHE_ENABLED: bool = True

    # Land Cover Provider ("mock_rule_based", "sentinel2_mock", "esa_worldcover")
    LAND_COVER_PROVIDER: str = "mock_rule_based"

    # Persistence Clustering
    PERSISTENCE_DISTANCE_THRESHOLD_METERS: float = 1500.0
    PERSISTENCE_MIN_DETECTIONS: int = 2

    # Demo / Ingestion Flags
    ENABLE_AUTO_SEED_ON_STARTUP: bool = True

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

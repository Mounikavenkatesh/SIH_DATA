"""
Extensible satellite and land-cover enrichment service.
Provides an abstract pluggable interface allowing easy integration with Sentinel-2,
ESA WorldCover, Copernicus, or rule-based mock providers.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any
import logging
from backend.app.config import settings

logger = logging.getLogger(__name__)


class LandCoverProvider(ABC):
    """Abstract interface for land cover and satellite contextual providers."""

    @abstractmethod
    def get_land_cover_context(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Enrich a geographic coordinate with land cover information.
        Must return:
            land_use_type (str)
            vegetation_context (str)
            industrial_context (str)
            forest_context (str)
            provider (str)
        """
        pass


class RuleBasedLandCoverProvider(LandCoverProvider):
    """
    Default rule-based provider using geographic coordinates, biomes,
    and regional metadata to provide accurate baseline land-use context.
    """

    def get_land_cover_context(self, latitude: float, longitude: float) -> Dict[str, Any]:
        lat, lon = latitude, longitude

        # High latitude boreal forest zones (Canada, Siberia, Alaska)
        if (50.0 <= lat <= 70.0 and -140.0 <= lon <= -60.0) or (55.0 <= lat <= 70.0 and 20.0 <= lon <= 170.0):
            return {
                "land_use_type": "forest",
                "vegetation_context": "dense_canopy",
                "industrial_context": "low_density_wilderness",
                "forest_context": "boreal_coniferous_taiga",
                "provider": "RuleBasedLandCoverProvider"
            }

        # Indo-Gangetic Plain intensive agricultural belt (Punjab, Haryana, UP)
        if 28.0 <= lat <= 32.5 and 74.0 <= lon <= 84.0:
            return {
                "land_use_type": "farmland",
                "vegetation_context": "crop_residue_canopy",
                "industrial_context": "rural_agro_industrial",
                "forest_context": "none",
                "provider": "RuleBasedLandCoverProvider"
            }

        # Gulf of Kutch / Jamnagar industrial coast
        if 22.0 <= lat <= 23.0 and 69.0 <= lon <= 70.5:
            return {
                "land_use_type": "industrial",
                "vegetation_context": "barren_coastal",
                "industrial_context": "heavy_petrochemical_refining",
                "forest_context": "none",
                "provider": "RuleBasedLandCoverProvider"
            }

        # Permian Basin, Texas / New Mexico (Arid scrub / hydrocarbon extraction)
        if 31.0 <= lat <= 33.5 and -104.5 <= lon <= -101.5:
            return {
                "land_use_type": "industrial",
                "vegetation_context": "semi_arid_shrubland",
                "industrial_context": "oil_and_gas_extraction_field",
                "forest_context": "none",
                "provider": "RuleBasedLandCoverProvider"
            }

        # Jurong Island & Singapore industrial core
        if 1.20 <= lat <= 1.35 and 103.60 <= lon <= 103.75:
            return {
                "land_use_type": "industrial",
                "vegetation_context": "sparse_reclaimed",
                "industrial_context": "dense_chemical_refinery_island",
                "forest_context": "none",
                "provider": "RuleBasedLandCoverProvider"
            }

        # Western US Mediterranean forest/chaparral (California wildfire zones)
        if 36.0 <= lat <= 42.0 and -124.0 <= lon <= -118.0:
            return {
                "land_use_type": "forest",
                "vegetation_context": "dry_pine_chaparral",
                "industrial_context": "low_wildland_urban_interface",
                "forest_context": "temperate_coniferous_forest",
                "provider": "RuleBasedLandCoverProvider"
            }

        # Default fallback
        return {
            "land_use_type": "open_land",
            "vegetation_context": "mixed_vegetation",
            "industrial_context": "unknown",
            "forest_context": "sparse",
            "provider": "RuleBasedLandCoverProvider"
        }


class Sentinel2MockProvider(LandCoverProvider):
    """
    Pluggable adapter simulating Sentinel-2 10-meter multispectral NDVI and scene classification.
    Can be replaced with real Copernicus Sentinel Hub API or ESA WorldCover raster queries.
    """

    def get_land_cover_context(self, latitude: float, longitude: float) -> Dict[str, Any]:
        # Simulates NDVI (Normalized Difference Vegetation Index) calculation
        base_provider = RuleBasedLandCoverProvider()
        base_context = base_provider.get_land_cover_context(latitude, longitude)
        base_context["provider"] = "Sentinel2_MSI_L2A_Adapter"
        base_context["simulated_ndvi"] = 0.62 if base_context["land_use_type"] in ("forest", "farmland") else 0.14
        return base_context


def get_land_cover_service() -> LandCoverProvider:
    """Factory to instantiate the configured land cover provider."""
    provider_name = settings.LAND_COVER_PROVIDER.lower()
    if "sentinel" in provider_name:
        return Sentinel2MockProvider()
    return RuleBasedLandCoverProvider()


land_cover_service = get_land_cover_service()

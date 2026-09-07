"""
Evidence-based multi-criteria scoring and heuristic classification service.
Calculates industrial, flare, agricultural, wildfire, and persistence scores.
Explicitly tagged as a prototype heuristic.
"""
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)

CLASS_INDUSTRIAL = "Industrial Thermal Event"
CLASS_FLARE = "Gas Flare"
CLASS_AGRI = "Agricultural Burning"
CLASS_WILDFIRE = "Wildfire"
CLASS_UNKNOWN = "Other/Unknown"


class ClassificationService:
    def compute_scores(
        self,
        event_dict: Dict[str, Any],
        facility_context: Dict[str, Any],
        land_context: Dict[str, Any],
        persistence_score: float,
        cluster_density: int = 1
    ) -> Dict[str, Any]:
        """
        Multi-criteria evidence-based scoring algorithm.
        Outputs scores in [0.0, 1.0] for each category.
        """
        frp = float(event_dict.get("frp", 0.0))
        bt = float(event_dict.get("brightness_temperature", 300.0))
        conf_norm = float(event_dict.get("confidence_normalized", 0.7))
        daynight = str(event_dict.get("daynight", "D")).upper()
        
        fac_type = (facility_context.get("nearest_facility_type") or "").lower()
        dist_m = float(facility_context.get("distance_meters", 5000.0))
        land_use = (land_context.get("land_use_type") or "").lower()

        # Proximity helpers
        is_flare_prox = ("flare" in fac_type) and (dist_m <= 1500.0)
        is_refinery_prox = ("refinery" in fac_type or "petrochem" in fac_type) and (dist_m <= 2500.0)
        is_power_prox = ("power" in fac_type) and (dist_m <= 2000.0)
        is_industrial_prox = (fac_type in ("industrial", "factory", "works", "mine", "quarry") or is_refinery_prox or is_power_prox) and (dist_m <= 3000.0)

        # -------------------------------------------------------------
        # 1. GAS FLARE SCORE
        # Criteria: flare/gas infrastructure proximity, high BT, nighttime recurrence
        # -------------------------------------------------------------
        flare_s = 0.0
        if is_flare_prox:
            flare_s += 0.55
        elif "gas" in fac_type or "refinery" in fac_type:
            flare_s += 0.25

        if bt >= 355.0:
            flare_s += 0.20
        elif bt >= 345.0:
            flare_s += 0.10

        if persistence_score >= 0.40:
            flare_s += 0.20
        elif persistence_score >= 0.20:
            flare_s += 0.10

        if daynight == "N":
            flare_s += 0.10

        if frp > 150.0:  # Flares rarely produce huge area FRP > 150 MW
            flare_s -= 0.25

        flare_score = round(max(0.0, min(1.0, flare_s * conf_norm)), 3)

        # -------------------------------------------------------------
        # 2. INDUSTRIAL THERMAL EVENT SCORE
        # Criteria: refinery/power/factory proximity, high persistence, stable FRP
        # -------------------------------------------------------------
        ind_s = 0.0
        if is_refinery_prox or is_power_prox:
            ind_s += 0.50
        elif is_industrial_prox:
            ind_s += 0.40
        elif land_use == "industrial":
            ind_s += 0.30

        if persistence_score >= 0.50:
            ind_s += 0.35
        elif persistence_score >= 0.25:
            ind_s += 0.20

        if 15.0 <= frp <= 120.0:
            ind_s += 0.15

        if flare_score > 0.70 and not is_refinery_prox:
            # If specifically a flare pad, dampen general industrial
            ind_s *= 0.75

        industrial_score = round(max(0.0, min(1.0, ind_s * conf_norm)), 3)

        # -------------------------------------------------------------
        # 3. AGRICULTURAL BURNING SCORE
        # Criteria: farmland land-use, low-moderate FRP, daytime, low persistence
        # -------------------------------------------------------------
        agri_s = 0.0
        if land_use == "farmland" or fac_type == "farmland":
            agri_s += 0.55

        if 3.0 <= frp <= 30.0:
            agri_s += 0.25
        elif frp > 60.0:
            agri_s -= 0.30

        if daynight == "D":
            agri_s += 0.15

        if persistence_score <= 0.25:
            agri_s += 0.15
        else:
            agri_s -= 0.40  # Stubble fires rarely persist > 2 days in the exact same 1km spot

        if is_industrial_prox or is_flare_prox:
            agri_s -= 0.40

        agriculture_score = round(max(0.0, min(1.0, agri_s * conf_norm)), 3)

        # -------------------------------------------------------------
        # 4. WILDFIRE SCORE
        # Criteria: forest / wilderness, high FRP, spatial cluster spread, low industrial
        # -------------------------------------------------------------
        wild_s = 0.0
        if land_use == "forest" or fac_type == "forest":
            wild_s += 0.45

        if frp >= 150.0:
            wild_s += 0.40
        elif frp >= 50.0:
            wild_s += 0.25
        elif frp <= 10.0:
            wild_s -= 0.20

        if cluster_density >= 3:
            wild_s += 0.20

        if is_industrial_prox or is_flare_prox:
            wild_s -= 0.50

        wildfire_score = round(max(0.0, min(1.0, wild_s * conf_norm)), 3)

        # -------------------------------------------------------------
        # 5. DETERMINATION & OVERALL CONFIDENCE
        # -------------------------------------------------------------
        score_dict = {
            CLASS_FLARE: flare_score,
            CLASS_INDUSTRIAL: industrial_score,
            CLASS_AGRI: agriculture_score,
            CLASS_WILDFIRE: wildfire_score,
        }

        best_category = max(score_dict, key=score_dict.get)
        best_score = score_dict[best_category]

        # Minimum threshold to assign a specific class
        if best_score < 0.35:
            heuristic_class = CLASS_UNKNOWN
            overall_conf = round(conf_norm * 0.4, 3)
        else:
            heuristic_class = best_category
            overall_conf = round(best_score * conf_norm, 3)

        return {
            "industrial_score": industrial_score,
            "flare_score": flare_score,
            "agriculture_score": agriculture_score,
            "wildfire_score": wildfire_score,
            "persistence_score": round(persistence_score, 3),
            "overall_model_confidence": overall_conf,
            "heuristic_classification": heuristic_class,
            "scoring_mode": "prototype_heuristic",
            "scores_breakdown": score_dict
        }


classification_service = ClassificationService()

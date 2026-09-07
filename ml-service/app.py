"""
FastAPI Machine Learning Service for Satellite Thermal Hotspot Classification.
Serves predictions using the trained Random Forest Classifier.

DISCLAIMER:
"Model performance on synthetic/demo data does not represent real-world accuracy."
"""
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml_service")

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "model.joblib"
METADATA_PATH = BASE_DIR / "model" / "metadata.joblib"

FEATURE_COLUMNS = [
    "brightness",
    "confidence",
    "latitude",
    "longitude",
    "distanceToIndustrialFacility",
    "industrialFacilityNearby",
    "previousDetectionCount",
    "persistenceDuration",
    "recentHotspotFrequency",
    "thermalIntensity"
]

ALL_CLASSES = [
    "Potential Industrial Fire",
    "Gas Flare",
    "Normal/Persistent Industrial Heat Source",
    "Agricultural Burning",
    "Other Thermal Source"
]

app = FastAPI(
    title="AI Industrial Fire ML Service",
    description="FastAPI Random Forest classifier for satellite thermal hotspot characterization.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model references
model = None
metadata = None


def load_model():
    global model, metadata
    if MODEL_PATH.exists() and METADATA_PATH.exists():
        try:
            model = joblib.load(MODEL_PATH)
            metadata = joblib.load(METADATA_PATH)
            logger.info(f"Loaded trained Random Forest model from {MODEL_PATH}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            model = None
            metadata = None
    else:
        logger.warning(f"Model file not found at {MODEL_PATH}. Running in heuristic fallback mode.")


@app.on_event("startup")
def startup_event():
    load_model()


class FeaturePayload(BaseModel):
    brightness: float = Field(320.0, description="Brightness temperature (Kelvin)")
    confidence: float = Field(80.0, ge=0.0, le=100.0, description="Detection confidence 0-100")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    distanceToIndustrialFacility: Optional[float] = Field(5.0, description="Distance to nearest industrial facility in km")
    industrialFacilityNearby: Optional[int] = Field(0, description="1 if industrial facility nearby, else 0")
    previousDetectionCount: Optional[int] = Field(0, description="Count of previous detections at location")
    persistenceDuration: Optional[float] = Field(0.0, description="Active detection duration in hours")
    recentHotspotFrequency: Optional[int] = Field(1, description="Hotspot detection frequency")
    thermalIntensity: Optional[float] = Field(30.0, description="Thermal intensity (FRP in MW)")


class PredictRequest(BaseModel):
    features: FeaturePayload


def heuristic_fallback_predict(feats: dict) -> dict:
    """Resilient fallback classifier when model joblib is not yet present on disk."""
    bt = feats.get("brightness", 320.0)
    ti = feats.get("thermalIntensity", 30.0)
    conf = feats.get("confidence", 80.0)
    dist = feats.get("distanceToIndustrialFacility", 10.0)
    prev = feats.get("previousDetectionCount", 0)
    nearby = feats.get("industrialFacilityNearby", 0)

    # Calculate raw heuristic score weights
    scores = {c: 0.05 for c in ALL_CLASSES}

    # 1. Gas Flare: high BT, very close to industry, flare stack distance <= 0.3km
    if dist <= 0.35 and bt >= 360.0 and conf >= 85:
        scores["Gas Flare"] += 0.85
    elif dist <= 0.8 and bt >= 350.0:
        scores["Gas Flare"] += 0.40

    # 2. Potential Industrial Fire: high thermal intensity, high confidence, nearby industry, acute/new
    if nearby == 1 and ti >= 50.0 and conf >= 85 and prev <= 1:
        scores["Potential Industrial Fire"] += 0.90
    elif nearby == 1 and ti >= 40.0:
        scores["Potential Industrial Fire"] += 0.50

    # 3. Normal/Persistent Industrial: nearby industry with repeated detections (prev >= 2)
    if nearby == 1 and prev >= 2:
        scores["Normal/Persistent Industrial Heat Source"] += 0.85
    elif nearby == 1 and prev >= 1:
        scores["Normal/Persistent Industrial Heat Source"] += 0.45

    # 4. Agricultural Burning: distant from industry, moderate intensity, day occurrence
    if dist >= 4.0 and 10.0 <= ti <= 35.0:
        scores["Agricultural Burning"] += 0.75
    elif dist >= 2.0:
        scores["Agricultural Burning"] += 0.35

    # 5. Other Thermal Source: isolated, low confidence or remote
    if dist >= 3.0 and ti <= 20.0:
        scores["Other Thermal Source"] += 0.60
    else:
        scores["Other Thermal Source"] += 0.15

    # Softmax normalization
    exp_scores = {k: np.exp(v * 3.0) for k, v in scores.items()}
    total_exp = sum(exp_scores.values())
    probs = {k: round(float(v / total_exp), 4) for k, v in exp_scores.items()}

    winning_class = max(probs, key=probs.get)
    confidence = probs[winning_class]

    return {
        "prediction": winning_class,
        "confidence": confidence,
        "probabilities": probs,
        "mode": "heuristic_fallback"
    }


@app.get("/health", summary="Health and Model Status")
def health_check():
    # Attempt reload if not loaded yet
    if model is None:
        load_model()

    return {
        "status": "healthy",
        "modelLoaded": model is not None,
        "algorithm": "RandomForestClassifier",
        "classes": metadata.get("classes", ALL_CLASSES) if metadata else ALL_CLASSES,
        "accuracy": metadata.get("accuracy", None) if metadata else None
    }


@app.post("/predict", summary="Predict Hotspot Classification")
def predict(payload: PredictRequest):
    global model, metadata
    if model is None:
        load_model()

    feats = payload.features.dict()

    # If trained model is available, use scikit-learn pipeline
    if model is not None:
        try:
            # Build feature array in strict column order
            input_data = []
            for col in FEATURE_COLUMNS:
                val = feats.get(col, 0.0)
                if val is None:
                    val = 0.0
                input_data.append(float(val))

            X = np.array([input_data])
            prediction = model.predict(X)[0]
            proba_arr = model.predict_proba(X)[0]

            classes = list(model.classes_)
            probabilities = {
                cls: round(float(proba_arr[i]), 4)
                for i, cls in enumerate(classes)
            }

            # Ensure all 5 classes appear in probabilities
            for c in ALL_CLASSES:
                if c not in probabilities:
                    probabilities[c] = 0.0

            confidence = round(float(np.max(proba_arr)), 4)

            return {
                "prediction": str(prediction),
                "confidence": confidence,
                "probabilities": probabilities,
                "disclaimer": "Model performance on synthetic/demo data does not represent real-world accuracy."
            }
        except Exception as e:
            logger.error(f"Inference error with joblib model: {e}. Falling back to heuristic.")

    # Graceful fallback
    result = heuristic_fallback_predict(feats)
    result["disclaimer"] = "Model performance on synthetic/demo data does not represent real-world accuracy."
    return result

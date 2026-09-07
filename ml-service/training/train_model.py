"""
Train Random Forest Classifier on synthetic satellite thermal hotspot observations.
Generates model.joblib and metadata.joblib for the FastAPI ML service.

DISCLAIMER:
"Model performance on synthetic/demo data does not represent real-world accuracy."
"""
import json
import os
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows terminal
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
DATA_FILE = PROJECT_ROOT / "sample-data" / "hotspots.json"
MODEL_DIR = BASE_DIR / "model"
MODEL_PATH = MODEL_DIR / "model.joblib"
METADATA_PATH = MODEL_DIR / "metadata.joblib"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

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

CLASSES = [
    "Potential Industrial Fire",
    "Gas Flare",
    "Normal/Persistent Industrial Heat Source",
    "Agricultural Burning",
    "Other Thermal Source"
]


def extract_features(hotspot: dict) -> dict:
    """Extract and derive features from a single hotspot observation."""
    dist = float(hotspot.get("distanceToIndustrialFacility", 10.0))
    nearby = 1 if (dist <= 1.5 or (hotspot.get("nearbyIndustrialFacility") and hotspot.get("nearbyIndustrialFacility") != "None")) else 0
    prev_count = int(hotspot.get("previousDetectionCount", 0))
    
    # Derived persistence duration and frequency
    duration_hours = prev_count * 24.0
    frequency = prev_count + 1
    
    return {
        "brightness": float(hotspot.get("brightness", 320.0)),
        "confidence": float(hotspot.get("confidence", 80.0)),
        "latitude": float(hotspot.get("latitude", 20.0)),
        "longitude": float(hotspot.get("longitude", 78.0)),
        "distanceToIndustrialFacility": dist,
        "industrialFacilityNearby": nearby,
        "previousDetectionCount": prev_count,
        "persistenceDuration": duration_hours,
        "recentHotspotFrequency": frequency,
        "thermalIntensity": float(hotspot.get("thermalIntensity", 30.0)),
        "targetClassification": hotspot.get("targetClassification", "Other Thermal Source")
    }


def train():
    print("=" * 60)
    print("[AI INDUSTRIAL FIRE & THERMAL CLASSIFIER - TRAINING PIPELINE]")
    print("=" * 60)
    print(f"Loading synthetic dataset from: {DATA_FILE}")

    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Sample data not found at {DATA_FILE}")

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_hotspots = data.get("hotspots", [])
    print(f"Loaded {len(raw_hotspots)} hotspot records.")

    processed = [extract_features(h) for h in raw_hotspots]
    df = pd.DataFrame(processed)

    X = df[FEATURE_COLUMNS]
    y = df["targetClassification"]

    print(f"Feature matrix shape: {X.shape}")
    print("Class distribution:")
    print(y.value_counts())

    # Stratified split if possible, otherwise simple random split
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )
    except Exception:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42
        )

    # Train Random Forest Classifier
    clf = RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_split=2,
        class_weight="balanced",
        random_state=42
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print("\n--- Evaluation on Hold-Out Test Set ---")
    print(f"Accuracy: {acc * 100:.2f}%\n")
    print("Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

    # Feature importances
    print("Feature Importances:")
    importances = sorted(zip(FEATURE_COLUMNS, clf.feature_importances_), key=lambda x: x[1], reverse=True)
    for feat, imp in importances:
        print(f"  {feat:30s}: {imp:.4f}")

    # Export model & metadata
    joblib.dump(clf, MODEL_PATH)
    metadata = {
        "features": FEATURE_COLUMNS,
        "classes": list(clf.classes_),
        "accuracy": float(acc),
        "trained_samples": len(X_train),
        "test_samples": len(X_test)
    }
    joblib.dump(metadata, METADATA_PATH)

    print(f"\n[OK] Model successfully exported to: {MODEL_PATH}")
    print(f"[OK] Metadata exported to: {METADATA_PATH}")
    print("\n" + "=" * 60)
    print("IMPORTANT SCIENTIFIC DISCLAIMER:")
    print("Model performance on synthetic/demo data does not represent real-world accuracy.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    train()

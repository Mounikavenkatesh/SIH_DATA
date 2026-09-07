# 🧠 Satellite Thermal Hotspot ML Service

FastAPI-powered Machine Learning microservice that classifies satellite thermal hotspot observations using a trained Random Forest model.

## 📌 Features
- **5 Classification Classes**:
  1. `Potential Industrial Fire`
  2. `Gas Flare`
  3. `Normal/Persistent Industrial Heat Source`
  4. `Agricultural Burning`
  5. `Other Thermal Source`
- **Trained Model**: Scikit-Learn `RandomForestClassifier` with balanced class weights.
- **REST Endpoints**:
  - `GET /health` - Service health and model status
  - `POST /predict` - Real-time classification and class probability distribution

## ⚠️ Important Scientific Disclaimer
> **"Model performance on synthetic/demo data does not represent real-world accuracy."**
> This prototype demonstrates an AI-assisted approach for classifying satellite thermal hotspots and estimating risk. Synthetic/demo data is used for development. Predictions and risk scores are not validated emergency-response determinations and should not be treated as operational fire certification.

## 🚀 Running the Service

```bash
# 1. Activate environment
# Windows:
..\.venv\Scripts\activate

# 2. Train the Random Forest model
python training/train_model.py

# 3. Start the FastAPI server on port 8000
uvicorn app:app --reload --port 8000
```

/**
 * Python ML Service HTTP Client
 * Dispatches feature vectors to FastAPI microservice for Random Forest classification.
 * Includes timeout protection and rule-based heuristic fallback if ML service is unreachable.
 */
require('dotenv').config();
const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

class MlClientService {
  /**
   * Request classification prediction from Python ML service.
   * @param {Object} features - 10-feature vector
   * @returns {Promise<Object>} { prediction, confidence, probabilities, source }
   */
  async predict(features) {
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/predict`,
        { features },
        { timeout: 3500 }
      );

      return {
        prediction: response.data.prediction,
        confidence: response.data.confidence,
        probabilities: response.data.probabilities || {},
        serviceSource: 'PYTHON_FASTAPI_RANDOM_FOREST',
        disclaimer: response.data.disclaimer,
      };
    } catch (error) {
      console.warn(
        `[ML Client] FastAPI ML service unavailable at ${ML_SERVICE_URL} (${error.message}). Activating local heuristic fallback.`
      );

      return this.localFallbackPredict(features);
    }
  }

  /**
   * Check ML service health.
   */
  async checkHealth() {
    try {
      const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2000 });
      return { available: true, data: res.data };
    } catch (e) {
      return { available: false, error: e.message };
    }
  }

  /**
   * Rule-based fallback classifier ensuring the backend NEVER crashes when Python service is starting.
   */
  localFallbackPredict(features) {
    const bt = features.brightness || 320;
    const ti = features.thermalIntensity || 30;
    const conf = features.confidence || 80;
    const dist = features.distanceToIndustrialFacility != null ? features.distanceToIndustrialFacility : 5.0;
    const prev = features.previousDetectionCount || 0;
    const nearby = features.industrialFacilityNearby || 0;

    let prediction = 'Other Thermal Source';
    let confidence = 0.82;
    const probabilities = {
      'Potential Industrial Fire': 0.05,
      'Gas Flare': 0.05,
      'Normal/Persistent Industrial Heat Source': 0.05,
      'Agricultural Burning': 0.05,
      'Other Thermal Source': 0.80,
    };

    if (dist <= 0.4 && bt >= 360) {
      prediction = 'Gas Flare';
      confidence = 0.94;
      probabilities['Gas Flare'] = 0.94;
      probabilities['Potential Industrial Fire'] = 0.03;
    } else if (nearby === 1 && ti >= 45 && prev <= 1) {
      prediction = 'Potential Industrial Fire';
      confidence = 0.91;
      probabilities['Potential Industrial Fire'] = 0.91;
      probabilities['Normal/Persistent Industrial Heat Source'] = 0.05;
    } else if (nearby === 1 && prev >= 2) {
      prediction = 'Normal/Persistent Industrial Heat Source';
      confidence = 0.93;
      probabilities['Normal/Persistent Industrial Heat Source'] = 0.93;
      probabilities['Potential Industrial Fire'] = 0.03;
    } else if (dist >= 4.0 && ti <= 35) {
      prediction = 'Agricultural Burning';
      confidence = 0.88;
      probabilities['Agricultural Burning'] = 0.88;
      probabilities['Other Thermal Source'] = 0.08;
    }

    return {
      prediction,
      confidence,
      probabilities,
      serviceSource: 'NODE_HEURISTIC_FALLBACK',
      disclaimer: 'Model performance on synthetic/demo data does not represent real-world accuracy.',
    };
  }
}

module.exports = new MlClientService();

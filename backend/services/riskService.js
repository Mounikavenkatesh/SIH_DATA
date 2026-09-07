/**
 * Risk Assessment Service
 * Computes transparent, auditable 0–100 risk score and categorical levels (LOW, MEDIUM, HIGH).
 */
const { riskWeights, riskThresholds, RISK_DISCLAIMER } = require('../utils/riskWeights');

class RiskService {
  /**
   * Calculate transparent risk score and factor breakdown.
   * @param {Object} params
   * @param {number} params.thermalIntensity - Fire radiative power or heat index (MW)
   * @param {number} params.confidence - Instrument confidence (0-100)
   * @param {number} params.distanceToIndustrialFacility - Distance in km
   * @param {boolean} params.isPersistent - Persistence boolean
   * @param {number} params.detectionCount - Number of detections in spatial cluster
   * @param {string} params.classification - Predicted classification category
   * @returns {Object} { score, level, factors, disclaimer }
   */
  calculateRisk({
    thermalIntensity = 25.0,
    confidence = 80.0,
    distanceToIndustrialFacility = 5.0,
    isPersistent = false,
    detectionCount = 1,
    classification = 'Other Thermal Source',
  }) {
    // 1. Normalize Thermal Intensity (0 - 120 MW -> 0 - 100)
    const normThermal = Math.min(100, Math.max(0, (thermalIntensity / 100) * 100));

    // 2. Normalize Confidence (0 - 100)
    const normConfidence = Math.min(100, Math.max(0, confidence));

    // 3. Normalize Industrial Proximity: 100 at 0km, decays to 0 at 5km
    const normProximity = Math.max(0, Math.min(100, (1 - distanceToIndustrialFacility / 5.0) * 100));

    // 4. Normalize Persistence Factor
    // Persistent industrial sources have steady heat, but sudden non-persistent spikes near industry pose acute fire risk
    let normPersistence = 30;
    if (isPersistent || detectionCount >= 3) {
      normPersistence = Math.min(100, 40 + detectionCount * 12);
    } else {
      normPersistence = 20;
    }

    // 5. Normalize Frequency Factor
    const normFrequency = Math.min(100, Math.max(10, detectionCount * 25));

    // 6. Abnormal / Acute Activity Factor
    // Highest for Potential Industrial Fire or sudden acute flare with no history
    let normAbnormal = 20;
    if (classification === 'Potential Industrial Fire') {
      normAbnormal = 95;
    } else if (classification === 'Gas Flare') {
      normAbnormal = 65;
    } else if (classification === 'Normal/Persistent Industrial Heat Source') {
      normAbnormal = 25; // Controlled permanent heat has low abnormality
    } else if (classification === 'Agricultural Burning') {
      normAbnormal = 35;
    }

    // Compute Weighted Contributions
    const factors = {
      thermalIntensity: Math.round(normThermal * riskWeights.thermalIntensity),
      confidence: Math.round(normConfidence * riskWeights.confidence),
      industrialProximity: Math.round(normProximity * riskWeights.industrialProximity),
      persistence: Math.round(normPersistence * riskWeights.persistence),
      frequency: Math.round(normFrequency * riskWeights.frequency),
      abnormalActivity: Math.round(normAbnormal * riskWeights.abnormalActivity),
    };

    // Calculate Raw Total
    const rawScore =
      factors.thermalIntensity +
      factors.confidence +
      factors.industrialProximity +
      factors.persistence +
      factors.frequency +
      factors.abnormalActivity;

    const score = Math.min(100, Math.max(0, rawScore));

    // Determine Risk Level
    let level = 'LOW';
    if (score >= riskThresholds.high) {
      level = 'HIGH';
    } else if (score >= riskThresholds.medium) {
      level = 'MEDIUM';
    }

    // Generate human-readable explanation of risk contributors
    const contributors = [];
    if (factors.thermalIntensity >= 12) {
      contributors.push(`acute thermal radiative intensity (${factors.thermalIntensity}/25 pts)`);
    }
    if (factors.industrialProximity >= 10) {
      contributors.push(`proximity to industrial infrastructure (${factors.industrialProximity}/20 pts)`);
    }
    if (factors.persistence >= 10) {
      contributors.push(`clustering persistence history (${factors.persistence}/20 pts)`);
    }
    if (factors.abnormalActivity >= 6) {
      contributors.push(`combustion abnormality factor (${factors.abnormalActivity}/10 pts)`);
    }
    if (factors.confidence >= 10) {
      contributors.push(`sensor detection confidence (${factors.confidence}/15 pts)`);
    }

    let explanation = 'Score reflects nominal baseline thermal intensity with isolated observation telemetry.';
    if (contributors.length > 0) {
      if (level === 'HIGH') {
        explanation = `High risk driven by ${contributors.slice(0, 2).join(' combined with ')}. Requires priority monitoring buffer review.`;
      } else if (level === 'MEDIUM') {
        explanation = `Moderate risk profile characterized by ${contributors.slice(0, 2).join(' alongside ')}. Routine monitoring recommended.`;
      } else {
        explanation = `Low risk profile driven by ${contributors[0]}. Nominal operational heat signature.`;
      }
    }

    return {
      score,
      level,
      factors,
      explanation,
      disclaimer: RISK_DISCLAIMER,
    };
  }
}

module.exports = new RiskService();

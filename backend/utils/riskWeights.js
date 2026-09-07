/**
 * Configurable weights and thresholds for transparent 0–100 risk scoring.
 * Supports environment variable overrides to avoid hardcoded heuristics.
 */

const riskWeights = {
  thermalIntensity: parseFloat(process.env.WEIGHT_THERMAL_INTENSITY || '0.25'),
  confidence: parseFloat(process.env.WEIGHT_CONFIDENCE || '0.15'),
  industrialProximity: parseFloat(process.env.WEIGHT_INDUSTRIAL_PROXIMITY || '0.20'),
  persistence: parseFloat(process.env.WEIGHT_PERSISTENCE || '0.20'),
  frequency: parseFloat(process.env.WEIGHT_FREQUENCY || '0.10'),
  abnormalActivity: parseFloat(process.env.WEIGHT_ABNORMAL_ACTIVITY || '0.10'),
};

const riskThresholds = {
  high: parseInt(process.env.RISK_HIGH_THRESHOLD || '70', 10),
  medium: parseInt(process.env.RISK_MEDIUM_THRESHOLD || '40', 10),
};

const RISK_DISCLAIMER =
  'This risk score is a prototype decision-support indicator and is NOT an emergency-response certification or safety determination.';

module.exports = {
  riskWeights,
  riskThresholds,
  RISK_DISCLAIMER,
};

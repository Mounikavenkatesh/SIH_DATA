/**
 * Request Validation Middleware
 * Validates coordinate bounds, confidence intervals, and thermal metrics.
 * Rejects invalid requests with structured JSON error messages.
 */

function validateHotspotPayload(req, res, next) {
  const data = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload. Request body must be a JSON object.',
    });
  }

  // Latitude validation
  if (data.latitude == null || isNaN(Number(data.latitude))) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid latitude. Latitude is required and must be numeric.',
    });
  }

  const lat = Number(data.latitude);
  if (lat < -90.0 || lat > 90.0) {
    return res.status(400).json({
      success: false,
      error: `Invalid latitude (${lat}). Latitude must be between -90.0 and 90.0.`,
    });
  }

  // Longitude validation
  if (data.longitude == null || isNaN(Number(data.longitude))) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid longitude. Longitude is required and must be numeric.',
    });
  }

  const lon = Number(data.longitude);
  if (lon < -180.0 || lon > 180.0) {
    return res.status(400).json({
      success: false,
      error: `Invalid longitude (${lon}). Longitude must be between -180.0 and 180.0.`,
    });
  }

  // Brightness validation
  if (data.brightness != null) {
    const br = Number(data.brightness);
    if (isNaN(br) || br < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid brightness. Brightness must be a non-negative numeric value.',
      });
    }
  }

  // Confidence validation
  if (data.confidence != null) {
    const conf = Number(data.confidence);
    if (isNaN(conf) || conf < 0 || conf > 100) {
      return res.status(400).json({
        success: false,
        error: `Invalid confidence (${conf}). Confidence must be numeric between 0 and 100.`,
      });
    }
  }

  // Timestamp validation
  if (data.timestamp != null) {
    const d = new Date(data.timestamp);
    if (isNaN(d.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timestamp. Must be a parseable ISO date string.',
      });
    }
  }

  next();
}

module.exports = {
  validateHotspotPayload,
};

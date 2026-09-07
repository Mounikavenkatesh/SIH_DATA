/**
 * Feature Generation Service
 * Prepares ML feature vectors and categorizes fields by provenance:
 * - REAL SOURCE FIELDS
 * - DERIVED FEATURES
 * - DEMO/SYNTHETIC FEATURES
 */

class FeatureService {
  /**
   * Generate comprehensive feature object from raw observation & spatial context.
   */
  generateFeatures({
    hotspot,
    persistence = {},
    industrialContext = {},
  }) {
    const ts = hotspot.timestamp ? new Date(hotspot.timestamp) : new Date();
    const hour = !isNaN(ts.getTime()) ? ts.getUTCHours() : 12;
    const dayOfWeek = !isNaN(ts.getTime()) ? ts.getUTCDay() : 1;

    const dist =
      industrialContext.distanceToIndustrialFacility != null
        ? industrialContext.distanceToIndustrialFacility
        : hotspot.distanceToIndustrialFacility != null
        ? hotspot.distanceToIndustrialFacility
        : 5.0;

    const facilityName =
      industrialContext.nearbyIndustrialFacility ||
      hotspot.nearbyIndustrialFacility ||
      'None';

    const isNearby = dist <= 1.5 || (facilityName && facilityName !== 'None') ? 1 : 0;
    const prevCount = persistence.previousDetectionCount != null ? persistence.previousDetectionCount : (hotspot.previousDetectionCount || 0);
    const duration = persistence.durationHours != null ? persistence.durationHours : (prevCount * 24.0);
    const freq = persistence.recentFrequency != null ? persistence.recentFrequency : (prevCount + 1);
    const clusterCount = persistence.spatialClusterCount != null ? persistence.spatialClusterCount : 1;

    const thermalIntensity = hotspot.thermalIntensity != null
      ? parseFloat(hotspot.thermalIntensity)
      : parseFloat(hotspot.frp || hotspot.brightness ? (hotspot.brightness > 300 ? hotspot.brightness - 300 : 25.0) : 25.0);

    return {
      // 1. Vector directly ingested by Python ML Service
      vector: {
        brightness: parseFloat(hotspot.brightness || 320.0),
        confidence: parseFloat(hotspot.confidence || 80.0),
        latitude: parseFloat(hotspot.latitude),
        longitude: parseFloat(hotspot.longitude),
        distanceToIndustrialFacility: parseFloat(dist),
        industrialFacilityNearby: isNearby,
        previousDetectionCount: prevCount,
        persistenceDuration: parseFloat(duration),
        recentHotspotFrequency: freq,
        thermalIntensity: parseFloat(thermalIntensity),
      },

      // 2. Clear Categorization by Data Provenance
      provenance: {
        sourceFields: {
          latitude: hotspot.latitude,
          longitude: hotspot.longitude,
          brightness: hotspot.brightness,
          confidence: hotspot.confidence,
          timestamp: hotspot.timestamp || new Date().toISOString(),
          satellite: hotspot.satellite || 'VIIRS / MODIS',
          source: hotspot.source || 'DEMO',
        },
        derivedFeatures: {
          distanceToIndustrialFacility: dist,
          industrialFacilityNearby: isNearby,
          nearbyIndustrialFacility: facilityName,
          previousDetectionCount: prevCount,
          persistenceDurationHours: duration,
          recentHotspotFrequency: freq,
          hourOfDay: hour,
          dayOfWeek: dayOfWeek,
          spatialClusterCount: clusterCount,
          thermalIntensity: thermalIntensity,
        },
        syntheticDemoFields: {
          isSyntheticDemo: hotspot.isSyntheticDemo !== false,
          disclaimer: 'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS',
        },
      },
    };
  }
}

module.exports = new FeatureService();

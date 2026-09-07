/**
 * Spatiotemporal Persistence Analysis Service
 * Clusters observations within spatial tolerance (default: 1 km) and evaluates recurrence.
 */

// Haversine distance in kilometers
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class PersistenceService {
  constructor() {
    this.spatialToleranceKm = parseFloat(process.env.SPATIAL_TOLERANCE_KM || '1.0');
    this.minDetections = parseInt(process.env.PERSISTENCE_MIN_DETECTIONS || '2', 10);
  }

  /**
   * Analyze spatiotemporal persistence against historical hotspot records.
   * @param {Object} current - Current hotspot { latitude, longitude, timestamp }
   * @param {Array<Object>} history - List of historical hotspot documents/objects
   * @returns {Object} Persistence metrics
   */
  analyzePersistence(current, history = []) {
    const curLat = current.latitude;
    const curLon = current.longitude;
    const curTime = current.timestamp ? new Date(current.timestamp) : new Date();

    // Find all historical points within spatial tolerance radius (~1km)
    const cluster = history.filter((h) => {
      const d = haversineDistanceKm(curLat, curLon, h.latitude, h.longitude);
      return d <= this.spatialToleranceKm;
    });

    // Sort observations chronologically
    const allTimestamps = cluster
      .map((h) => (h.timestamp ? new Date(h.timestamp) : null))
      .filter((t) => t !== null && !isNaN(t.getTime()));

    allTimestamps.push(curTime);
    allTimestamps.sort((a, b) => a.getTime() - b.getTime());

    const detectionCount = allTimestamps.length;
    const firstDetected = allTimestamps[0];
    const lastDetected = allTimestamps[allTimestamps.length - 1];

    // Compute duration in hours
    const durationHours = Math.max(
      0,
      Math.round((lastDetected.getTime() - firstDetected.getTime()) / (1000 * 60 * 60))
    );

    // Compute active distinct dates
    const uniqueDays = new Set(allTimestamps.map((t) => t.toISOString().slice(0, 10)));

    // Persistence determination
    const isPersistent = detectionCount >= this.minDetections && (uniqueDays.size >= 2 || durationHours >= 12);

    return {
      status: isPersistent ? 'Persistent' : 'Non-persistent',
      isPersistent,
      detectionCount,
      previousDetectionCount: Math.max(0, detectionCount - 1),
      firstDetected: firstDetected.toISOString(),
      lastDetected: lastDetected.toISOString(),
      durationHours,
      activeDaysCount: uniqueDays.size,
      recentFrequency: detectionCount,
      spatialClusterCount: cluster.length,
      spatialToleranceKm: this.spatialToleranceKm,
    };
  }
}

module.exports = new PersistenceService();

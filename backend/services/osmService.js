/**
 * OpenStreetMap (OSM) Proximity Intelligence Service
 * Identifies nearby industrial facilities, refineries, power stations, and chemical sites.
 * Features in-memory caching and offline fallback dictionary of major industrial hubs.
 */
const axios = require('axios');

// Offline catalog of prominent Indian industrial corridors for guaranteed demonstration
const INDUSTRIAL_CORRIDORS = [
  { name: 'Reliance Petroleum Refinery & Petrochemicals Complex', lat: 22.352, lon: 69.854, type: 'refinery' },
  { name: 'Rashtriya Ispat Nigam Visakhapatnam Steel Plant', lat: 17.634, lon: 83.181, type: 'steel_mill' },
  { name: 'NTPC Singrauli Super Thermal Power Station', lat: 24.101, lon: 82.684, type: 'power_plant' },
  { name: 'Hazira Petrochemicals & LNG Terminal', lat: 21.118, lon: 72.648, type: 'refinery' },
  { name: 'BALCO Aluminium Smelter & Captive Thermal Unit', lat: 22.362, lon: 82.752, type: 'smelter' },
  { name: 'CPCL Manali Petrochemical & Solvent Estate', lat: 13.168, lon: 80.264, type: 'chemical' },
  { name: 'Dahej SEZ Hydrocarbon Processing Zone', lat: 21.712, lon: 72.584, type: 'chemical' },
  { name: 'Ankleshwar GIDC Bulk Chemical Complex', lat: 21.628, lon: 73.012, type: 'chemical' },
  { name: 'Pithampur Automotive & Packaging Industrial Zone', lat: 22.618, lon: 75.684, type: 'manufacturing' },
  { name: 'Baddi Pharma & Solvent Synthesis Estate', lat: 30.958, lon: 76.792, type: 'pharmaceutical' },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

class OsmService {
  constructor() {
    this.overpassUrl = process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
    this.cache = new Map(); // coordinate key -> cached context
  }

  /**
   * Find nearest industrial facility context for given coordinates.
   */
  async getNearbyIndustrialContext(latitude, longitude) {
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 1. Check Offline Industrial Catalog first (ultra-fast & offline-safe)
    let closestOffline = null;
    let minOfflineDist = Infinity;

    for (const ind of INDUSTRIAL_CORRIDORS) {
      const d = haversineKm(latitude, longitude, ind.lat, ind.lon);
      if (d < minOfflineDist) {
        minOfflineDist = d;
        closestOffline = ind;
      }
    }

    if (closestOffline && minOfflineDist <= 3.5) {
      const result = {
        available: true,
        source: 'OFFLINE_INDUSTRIAL_INDEX',
        nearbyIndustrialFacility: closestOffline.name,
        facilityType: closestOffline.type,
        distanceToIndustrialFacility: Math.round(minOfflineDist * 100) / 100,
        isIndustrialZone: minOfflineDist <= 1.5,
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // 2. Attempt Overpass query if online and distance is greater
    try {
      const radiusMeters = 3000;
      const query = `[out:json][timeout:3];(node["landuse"="industrial"](around:${radiusMeters},${latitude},${longitude});way["landuse"="industrial"](around:${radiusMeters},${latitude},${longitude});node["industrial"](around:${radiusMeters},${latitude},${longitude}););out center 1;`;
      
      const res = await axios.post(
        this.overpassUrl,
        `data=${encodeURIComponent(query)}`,
        { timeout: 2500, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const elements = res.data?.elements || [];
      if (elements.length > 0) {
        const el = elements[0];
        const elLat = el.lat || el.center?.lat || latitude;
        const elLon = el.lon || el.center?.lon || longitude;
        const distKm = haversineKm(latitude, longitude, elLat, elLon);
        const name = el.tags?.name || 'Local Industrial Complex';

        const result = {
          available: true,
          source: 'OVERPASS_OSM_API',
          nearbyIndustrialFacility: name,
          facilityType: el.tags?.industrial || 'industrial',
          distanceToIndustrialFacility: Math.round(distKm * 100) / 100,
          isIndustrialZone: distKm <= 1.0,
        };
        this.cache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      // Overpass failed or timed out; degrade gracefully
    }

    // 3. Fallback generic context
    const fallbackResult = {
      available: closestOffline != null,
      source: 'DISTANCE_HEURISTIC',
      nearbyIndustrialFacility: minOfflineDist <= 20.0 ? closestOffline.name : 'None',
      facilityType: minOfflineDist <= 20.0 ? closestOffline.type : 'none',
      distanceToIndustrialFacility: Math.round(minOfflineDist * 100) / 100,
      isIndustrialZone: minOfflineDist <= 1.5,
    };

    this.cache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }
}

module.exports = new OsmService();

/**
 * NASA FIRMS Ingestion & Data Provider Service
 * Supports live NASA FIRMS API when configured with FIRMS_API_KEY,
 * and defaults safely to DEMO MODE with synthetic data when credentials are absent.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function getSampleDataPath() {
  const candidates = [
    path.resolve(__dirname, '../../sample-data/hotspots.json'),
    path.resolve(__dirname, '../sample-data/hotspots.json'),
    path.resolve(process.cwd(), 'sample-data/hotspots.json'),
    path.resolve(process.cwd(), '../sample-data/hotspots.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

const SAMPLE_DATA_PATH = getSampleDataPath();

class FirmsService {
  constructor() {
    this.apiKey = process.env.FIRMS_API_KEY || '';
    this.apiUrl = process.env.FIRMS_API_URL || 'https://firms.modaps.eosdis.nasa.gov/api/country/csv';
  }

  isLiveModeEnabled() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getProviderStatus() {
    const isLive = this.isLiveModeEnabled();
    return {
      mode: isLive ? 'LIVE' : 'DEMO',
      badge: isLive ? 'LIVE DATA' : 'DEMO DATA',
      disclaimer: isLive
        ? 'Real NASA FIRMS Observations'
        : 'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS (Prototype Demonstration Only)',
      apiKeyConfigured: isLive,
      apiUrl: this.apiUrl,
    };
  }

  /**
   * Load synthetic hotspot dataset for Demo Mode.
   */
  loadDemoHotspots() {
    try {
      if (fs.existsSync(SAMPLE_DATA_PATH)) {
        const raw = fs.readFileSync(SAMPLE_DATA_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return parsed.hotspots || [];
      }
    } catch (e) {
      console.error('[FIRMS Service] Error reading sample dataset:', e.message);
    }
    return [];
  }

  /**
   * Fetch active observations from NASA FIRMS API (if configured).
   */
  async fetchLiveObservations({ countryCode = 'IND', sensor = 'VIIRS_SNPP_NRT', dayRange = 1 } = {}) {
    if (!this.isLiveModeEnabled()) {
      return {
        success: false,
        mode: 'DEMO',
        message: 'FIRMS_API_KEY is not configured in environment. Using Demo Dataset.',
        data: this.loadDemoHotspots(),
      };
    }

    try {
      const url = `${this.apiUrl}/${this.apiKey}/${sensor}/${countryCode}/${dayRange}`;
      const response = await axios.get(url, { timeout: 8000 });
      return {
        success: true,
        mode: 'LIVE',
        csvRaw: response.data,
      };
    } catch (error) {
      console.error('[FIRMS Service] Error fetching live NASA data:', error.message);
      return {
        success: false,
        mode: 'DEMO',
        message: `NASA FIRMS request failed (${error.message}). Falling back to Demo Dataset.`,
        data: this.loadDemoHotspots(),
      };
    }
  }
}

module.exports = new FirmsService();

/**
 * Database Seed Utility
 * Ingests sample-data/hotspots.json into MongoDB, runs initial persistence & risk scoring,
 * and avoids duplicate insertions using hotspotId indexing.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Hotspot = require('../models/Hotspot');
const persistenceService = require('../services/persistenceService');
const riskService = require('../services/riskService');
const featureService = require('../services/featureService');
const mlClientService = require('../services/mlClientService');

const SAMPLE_DATA_PATH = path.resolve(__dirname, '../../sample-data/hotspots.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/industrial_fire_ai';

async function seed() {
  console.log('='.repeat(60));
  console.log('🌱 SEEDING MONGODB WITH SYNTHETIC DEMO HOTSPOTS');
  console.log('='.repeat(60));
  console.log(`Connecting to MongoDB: ${MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    if (!fs.existsSync(SAMPLE_DATA_PATH)) {
      console.error(`❌ Sample data file not found at: ${SAMPLE_DATA_PATH}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(SAMPLE_DATA_PATH, 'utf-8');
    const { hotspots = [] } = JSON.parse(raw);
    console.log(`Loaded ${hotspots.length} sample records from JSON.`);

    let insertedCount = 0;
    let updatedCount = 0;

    // Process all records in temporal order
    for (const h of hotspots) {
      const lat = parseFloat(h.latitude);
      const lon = parseFloat(h.longitude);
      const curDate = new Date(h.timestamp);

      // Persistence analysis
      const persistence = persistenceService.analyzePersistence(
        { latitude: lat, longitude: lon, timestamp: curDate },
        hotspots.filter((other) => other.hotspotId !== h.hotspotId)
      );

      // Classification (target classification from demo dataset or fallback)
      const classification = h.targetClassification || 'Other Thermal Source';

      // Feature generation
      const features = featureService.generateFeatures({
        hotspot: h,
        persistence,
        industrialContext: {
          nearbyIndustrialFacility: h.nearbyIndustrialFacility,
          distanceToIndustrialFacility: h.distanceToIndustrialFacility,
        },
      });

      // Risk calculation
      const risk = riskService.calculateRisk({
        thermalIntensity: features.vector.thermalIntensity,
        confidence: h.confidence,
        distanceToIndustrialFacility: h.distanceToIndustrialFacility,
        isPersistent: persistence.isPersistent,
        detectionCount: persistence.detectionCount,
        classification,
      });

      const doc = {
        hotspotId: h.hotspotId,
        latitude: lat,
        longitude: lon,
        location: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        brightness: h.brightness,
        confidence: h.confidence,
        timestamp: curDate,
        date: h.date,
        time: h.time,
        satellite: h.satellite || 'NOAA-20 (VIIRS)',
        source: h.source || 'DEMO',
        thermalIntensity: features.vector.thermalIntensity,
        landUse: h.landUse || 'industrial',
        nearbyIndustrialFacility: h.nearbyIndustrialFacility || 'None',
        distanceToIndustrialFacility: h.distanceToIndustrialFacility != null ? h.distanceToIndustrialFacility : 5.0,
        previousDetectionCount: persistence.previousDetectionCount,
        features: features.provenance,
        classification,
        classificationConfidence: h.confidence ? h.confidence / 100 : 0.9,
        probabilities: {
          [classification]: 0.9,
        },
        persistence: {
          status: persistence.status,
          detectionCount: persistence.detectionCount,
          firstDetected: persistence.firstDetected,
          lastDetected: persistence.lastDetected,
          durationHours: persistence.durationHours,
          recentFrequency: persistence.recentFrequency,
        },
        riskScore: risk.score,
        riskLevel: risk.level,
        riskFactors: risk.factors,
        isSyntheticDemo: true,
        disclaimer: 'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS',
      };

      const result = await Hotspot.updateOne(
        { hotspotId: h.hotspotId },
        { $set: doc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        insertedCount++;
      } else {
        updatedCount++;
      }
    }

    const totalInDb = await Hotspot.countDocuments();
    console.log(`\n🎉 Seed Complete: ${insertedCount} inserted, ${updatedCount} updated.`);
    console.log(`📊 Total Hotspot Documents in Collection: ${totalInDb}`);
    console.log('='.repeat(60));
  } catch (err) {
    console.error('❌ Seeding failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seed();

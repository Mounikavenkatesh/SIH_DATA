const mongoose = require('mongoose');

const HotspotSchema = new mongoose.Schema(
  {
    hotspotId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    brightness: {
      type: Number,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    satellite: {
      type: String,
      default: 'NOAA-20 (VIIRS)',
    },
    source: {
      type: String,
      enum: ['DEMO', 'LIVE_FIRMS', 'MANUAL_INSPECTION', 'NASA_FIRMS_VIIRS', 'AI_STREAM'],
      default: 'DEMO',
    },
    thermalIntensity: {
      type: Number,
      default: 25.0,
    },
    landUse: {
      type: String,
      default: 'industrial',
    },
    nearbyIndustrialFacility: {
      type: String,
      default: 'None',
    },
    distanceToIndustrialFacility: {
      type: Number,
      default: 5.0,
    },
    previousDetectionCount: {
      type: Number,
      default: 0,
    },
    features: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    classification: {
      type: String,
      enum: [
        'Potential Industrial Fire',
        'Gas Flare',
        'Normal/Persistent Industrial Heat Source',
        'Agricultural Burning',
        'Other Thermal Source',
        'Unknown',
      ],
      default: 'Other Thermal Source',
      index: true,
    },
    classificationConfidence: {
      type: Number,
      default: 0.85,
    },
    probabilities: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    persistence: {
      status: {
        type: String,
        enum: ['Persistent', 'Non-persistent'],
        default: 'Non-persistent',
      },
      detectionCount: {
        type: Number,
        default: 1,
      },
      firstDetected: {
        type: Date,
      },
      lastDetected: {
        type: Date,
      },
      durationHours: {
        type: Number,
        default: 0,
      },
      recentFrequency: {
        type: Number,
        default: 1,
      },
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 30,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'LOW',
      index: true,
    },
    riskFactors: {
      thermalIntensity: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      industrialProximity: { type: Number, default: 0 },
      persistence: { type: Number, default: 0 },
      frequency: { type: Number, default: 0 },
      abnormalActivity: { type: Number, default: 0 },
    },
    riskExplanation: {
      type: String,
      default: '',
    },
    isSyntheticDemo: {
      type: Boolean,
      default: true,
    },
    disclaimer: {
      type: String,
      default: 'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS',
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial 2dsphere index on location for radius / distance queries
HotspotSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hotspot', HotspotSchema);

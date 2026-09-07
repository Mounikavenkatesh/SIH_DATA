/**
 * Hotspot Controller
 * Implements all REST endpoints for satellite thermal observations,
 * end-to-end pipeline analysis, spatial queries, and dashboard analytics.
 */
const Hotspot = require('../models/Hotspot');
const persistenceService = require('../services/persistenceService');
const riskService = require('../services/riskService');
const featureService = require('../services/featureService');
const mlClientService = require('../services/mlClientService');
const osmService = require('../services/osmService');
const firmsService = require('../services/firmsService');
const { riskThresholds, riskWeights, RISK_DISCLAIMER } = require('../utils/riskWeights');

class HotspotController {
  /**
   * GET /api/health
   */
  async getHealth(req, res) {
    const mlHealth = await mlClientService.checkHealth();
    const isMongoConnected = Hotspot.db.readyState === 1;

    res.json({
      status: 'healthy',
      service: 'Satellite Thermal Source Monitoring Backend',
      timestamp: new Date().toISOString(),
      database: {
        type: 'MongoDB',
        connected: isMongoConnected,
        readyState: Hotspot.db.readyState,
      },
      mlService: {
        url: process.env.ML_SERVICE_URL || 'http://localhost:8000',
        available: mlHealth.available,
        details: mlHealth.data || null,
      },
      dataMode: firmsService.getProviderStatus(),
    });
  }

  /**
   * GET /api/config
   */
  async getConfig(req, res) {
    res.json({
      success: true,
      provider: firmsService.getProviderStatus(),
      spatialToleranceKm: persistenceService.spatialToleranceKm,
      persistenceMinDetections: persistenceService.minDetections,
      riskThresholds,
      riskWeights,
      disclaimer: RISK_DISCLAIMER,
    });
  }

  /**
   * GET /api/hotspots
   * Supports filtering by riskLevel, classification, startDate, endDate, persistent, search, pagination.
   */
  async getHotspots(req, res, next) {
    try {
      const {
        riskLevel,
        classification,
        startDate,
        endDate,
        persistent,
        search,
        limit = 200,
        offset = 0,
      } = req.query;

      const query = {};

      if (riskLevel) {
        query.riskLevel = riskLevel.toUpperCase();
      }

      if (classification) {
        query.classification = classification;
      }

      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
      }

      if (persistent !== undefined) {
        const isP = persistent === 'true' || persistent === true;
        query['persistence.status'] = isP ? 'Persistent' : 'Non-persistent';
      }

      if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
          { hotspotId: regex },
          { nearbyIndustrialFacility: regex },
          { landUse: regex },
          { satellite: regex },
        ];
      }

      // Fetch from Mongo
      let hotspots = [];
      let total = 0;

      if (Hotspot.db.readyState === 1) {
        total = await Hotspot.countDocuments(query);
        hotspots = await Hotspot.find(query)
          .sort({ timestamp: -1 })
          .skip(parseInt(offset, 10))
          .limit(parseInt(limit, 10))
          .lean();
      } else {
        // Fallback to sample data file if DB not ready
        const demo = firmsService.loadDemoHotspots();
        total = demo.length;
        hotspots = demo.slice(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10));
      }

      res.json({
        success: true,
        total,
        count: hotspots.length,
        data: hotspots,
        provider: firmsService.getProviderStatus(),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/hotspots/:id
   */
  async getHotspotById(req, res, next) {
    try {
      const { id } = req.params;
      let hotspot = null;

      if (Hotspot.db.readyState === 1) {
        hotspot = await Hotspot.findOne({
          $or: [{ hotspotId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
        }).lean();
      }

      if (!hotspot) {
        const demo = firmsService.loadDemoHotspots();
        hotspot = demo.find((h) => h.hotspotId === id);
      }

      if (!hotspot) {
        return res.status(404).json({
          success: false,
          error: `Hotspot with ID '${id}' not found.`,
        });
      }

      res.json({
        success: true,
        data: hotspot,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/hotspots/nearby
   * Spatial query using coordinates and radius.
   */
  async getNearby(req, res, next) {
    try {
      const { latitude, longitude, radiusKm = 25 } = req.query;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'latitude and longitude query parameters are required.',
        });
      }

      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const radiusMeters = parseFloat(radiusKm) * 1000;

      let results = [];

      if (Hotspot.db.readyState === 1) {
        results = await Hotspot.find({
          location: {
            $nearSphere: {
              $geometry: {
                type: 'Point',
                coordinates: [lon, lat],
              },
              $maxDistance: radiusMeters,
            },
          },
        }).limit(50).lean();
      }

      res.json({
        success: true,
        center: { latitude: lat, longitude: lon },
        radiusKm: parseFloat(radiusKm),
        count: results.length,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/hotspots/history
   * Aggregated historical records grouped by date and location.
   */
  async getHistory(req, res, next) {
    try {
      if (Hotspot.db.readyState === 1) {
        const history = await Hotspot.aggregate([
          {
            $group: {
              _id: '$date',
              count: { $sum: 1 },
              avgBrightness: { $avg: '$brightness' },
              highRiskCount: {
                $sum: { $cond: [{ $eq: ['$riskLevel', 'HIGH'] }, 1, 0] },
              },
              persistentCount: {
                $sum: { $cond: [{ $eq: ['$persistence.status', 'Persistent'] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        return res.json({ success: true, data: history });
      }

      res.json({ success: true, data: [] });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/statistics
   * Computes aggregate analytics for dashboard cards and Recharts visualizations.
   */
  async getStatistics(req, res, next) {
    try {
      let allHotspots = [];

      if (Hotspot.db.readyState === 1) {
        allHotspots = await Hotspot.find().lean();
      } else {
        allHotspots = firmsService.loadDemoHotspots();
      }

      const totalHotspots = allHotspots.length;

      // Classification breakdown
      const classificationCounts = {
        'Potential Industrial Fire': 0,
        'Gas Flare': 0,
        'Normal/Persistent Industrial Heat Source': 0,
        'Agricultural Burning': 0,
        'Other Thermal Source': 0,
      };

      // Risk breakdown
      const riskCounts = {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      };

      let persistentCount = 0;
      let totalThermalIntensity = 0;
      const dateCounts = {};

      allHotspots.forEach((h) => {
        const cls = h.classification || h.targetClassification || 'Other Thermal Source';
        if (classificationCounts[cls] !== undefined) {
          classificationCounts[cls]++;
        } else {
          classificationCounts['Other Thermal Source']++;
        }

        const rk = h.riskLevel || 'LOW';
        if (riskCounts[rk] !== undefined) {
          riskCounts[rk]++;
        } else {
          riskCounts.LOW++;
        }

        if (h.persistence && h.persistence.status === 'Persistent') {
          persistentCount++;
        }

        const ti = h.thermalIntensity || 25;
        totalThermalIntensity += ti;

        const d = h.date || (h.timestamp ? h.timestamp.toString().slice(0, 10) : '2026-09-01');
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      });

      // Chart ready arrays
      const classificationChartData = Object.entries(classificationCounts).map(([name, count]) => ({
        name,
        count,
        percentage: totalHotspots > 0 ? Math.round((count / totalHotspots) * 100) : 0,
      }));

      const riskChartData = Object.entries(riskCounts).map(([level, count]) => ({
        level,
        count,
        percentage: totalHotspots > 0 ? Math.round((count / totalHotspots) * 100) : 0,
      }));

      const timelineChartData = Object.entries(dateCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({
          date,
          detections: count,
        }));

      res.json({
        success: true,
        summary: {
          totalHotspots,
          potentialIndustrialFires: classificationCounts['Potential Industrial Fire'],
          predictedIndustrialSources: classificationCounts['Potential Industrial Fire'] + classificationCounts['Normal/Persistent Industrial Heat Source'],
          gasFlares: classificationCounts['Gas Flare'],
          persistentHeatSources: classificationCounts['Normal/Persistent Industrial Heat Source'],
          agriculturalBurning: classificationCounts['Agricultural Burning'],
          otherThermalSources: classificationCounts['Other Thermal Source'],
          highRisk: riskCounts.HIGH,
          mediumRisk: riskCounts.MEDIUM,
          lowRisk: riskCounts.LOW,
          persistentCount,
          avgThermalIntensity: totalHotspots > 0 ? Math.round((totalThermalIntensity / totalHotspots) * 10) / 10 : 0,
        },
        charts: {
          classification: classificationChartData,
          risk: riskChartData,
          timeline: timelineChartData,
        },
        provider: firmsService.getProviderStatus(),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/analyze
   * Full end-to-end analysis pipeline:
   * Input -> Validation -> Context (OSM) -> Persistence -> Feature Gen -> ML Predict -> Risk Score -> DB Save -> Output
   */
  async analyzeHotspot(req, res, next) {
    try {
      const {
        latitude,
        longitude,
        brightness = 330.0,
        confidence = 90.0,
        thermalIntensity,
        timestamp,
        source = 'MANUAL_INSPECTION',
      } = req.body;

      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const curDate = timestamp ? new Date(timestamp) : new Date();
      const dateStr = curDate.toISOString().slice(0, 10);
      const timeStr = curDate.toISOString().slice(11, 16).replace(':', '');

      // 1. Context Search: Find nearby industrial facility context (OSM)
      const industrialContext = await osmService.getNearbyIndustrialContext(lat, lon);

      // 2. Persistence Analysis: Find existing hotspot history in ~1km radius
      let history = [];
      if (Hotspot.db.readyState === 1) {
        history = await Hotspot.find().lean();
      } else {
        history = firmsService.loadDemoHotspots();
      }

      const persistence = persistenceService.analyzePersistence(
        { latitude: lat, longitude: lon, timestamp: curDate },
        history
      );

      // 3. Feature Generation
      const featuresResult = featureService.generateFeatures({
        hotspot: {
          latitude: lat,
          longitude: lon,
          brightness: parseFloat(brightness),
          confidence: parseFloat(confidence),
          thermalIntensity: thermalIntensity != null ? parseFloat(thermalIntensity) : undefined,
          timestamp: curDate.toISOString(),
          satellite: 'NOAA-20 (VIIRS)',
          source,
        },
        persistence,
        industrialContext,
      });

      // 4. ML Prediction: Call Python FastAPI (or local fallback)
      const mlResult = await mlClientService.predict(featuresResult.vector);

      // 5. Risk Assessment: Compute 0-100 transparent score
      const risk = riskService.calculateRisk({
        thermalIntensity: featuresResult.vector.thermalIntensity,
        confidence: parseFloat(confidence),
        distanceToIndustrialFacility: industrialContext.distanceToIndustrialFacility,
        isPersistent: persistence.isPersistent,
        detectionCount: persistence.detectionCount,
        classification: mlResult.prediction,
      });

      // 6. Generate Unique Hotspot ID
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const hotspotId = `HS-${dateStr.replace(/-/g, '')}-${randomSuffix}`;

      // 7. Assemble Document
      const newHotspotDoc = {
        hotspotId,
        latitude: lat,
        longitude: lon,
        location: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        brightness: parseFloat(brightness),
        confidence: parseFloat(confidence),
        timestamp: curDate,
        date: dateStr,
        time: timeStr,
        satellite: 'NOAA-20 (VIIRS)',
        source,
        thermalIntensity: featuresResult.vector.thermalIntensity,
        landUse: industrialContext.isIndustrialZone ? 'industrial' : 'mixed',
        nearbyIndustrialFacility: industrialContext.nearbyIndustrialFacility,
        distanceToIndustrialFacility: industrialContext.distanceToIndustrialFacility,
        previousDetectionCount: persistence.previousDetectionCount,
        features: featuresResult.provenance,
        classification: mlResult.prediction,
        classificationConfidence: mlResult.confidence,
        probabilities: mlResult.probabilities,
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
        riskExplanation: risk.explanation,
        isSyntheticDemo: source === 'DEMO' || source === 'MANUAL_INSPECTION',
        disclaimer: 'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS',
      };

      // 8. Persist to MongoDB if available
      let savedRecord = newHotspotDoc;
      if (Hotspot.db.readyState === 1) {
        try {
          const created = await Hotspot.create(newHotspotDoc);
          savedRecord = created.toObject();
        } catch (dbErr) {
          console.error('[DB Error] Failed to persist hotspot:', dbErr.message);
        }
      }

      // 9. Format response matching Section 15 specifications
      res.status(201).json({
        success: true,
        hotspotId: savedRecord.hotspotId,
        location: {
          latitude: lat,
          longitude: lon,
        },
        classification: savedRecord.classification,
        confidence: savedRecord.classificationConfidence,
        probabilities: savedRecord.probabilities,
        persistence: {
          status: savedRecord.persistence.status,
          detectionCount: savedRecord.persistence.detectionCount,
          durationHours: savedRecord.persistence.durationHours,
          firstDetected: savedRecord.persistence.firstDetected,
          lastDetected: savedRecord.persistence.lastDetected,
        },
        risk: {
          score: savedRecord.riskScore,
          level: savedRecord.riskLevel,
          factors: savedRecord.riskFactors,
          explanation: risk.explanation,
        },
        industrialContext: {
          facility: savedRecord.nearbyIndustrialFacility,
          distanceKm: savedRecord.distanceToIndustrialFacility,
          source: industrialContext.source,
        },
        source: savedRecord.source,
        features: featuresResult.provenance,
        data: savedRecord,
        disclaimer: RISK_DISCLAIMER,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/hotspots
   * Direct creation endpoint.
   */
  async createHotspot(req, res, next) {
    return this.analyzeHotspot(req, res, next);
  }
}

module.exports = new HotspotController();

/**
 * REST API Routes for Satellite Thermal Hotspots & Analysis
 */
const express = require('express');
const router = express.Router();
const hotspotController = require('../controllers/hotspotController');
const { validateHotspotPayload } = require('../middleware/validationMiddleware');

// Health & System Info
router.get('/health', (req, res) => hotspotController.getHealth(req, res));
router.get('/config', (req, res) => hotspotController.getConfig(req, res));

// Analytics & Historical Aggregations
router.get('/statistics', (req, res, next) => hotspotController.getStatistics(req, res, next));
router.get('/hotspots/history', (req, res, next) => hotspotController.getHistory(req, res, next));
router.get('/hotspots/nearby', (req, res, next) => hotspotController.getNearby(req, res, next));

// Core Hotspot CRUD & Ingestion
router.get('/hotspots', (req, res, next) => hotspotController.getHotspots(req, res, next));
router.get('/hotspots/:id', (req, res, next) => hotspotController.getHotspotById(req, res, next));
router.post('/hotspots', validateHotspotPayload, (req, res, next) => hotspotController.createHotspot(req, res, next));

// Full Pipeline Analysis Endpoint (Section 15)
router.post('/analyze', validateHotspotPayload, (req, res, next) => hotspotController.analyzeHotspot(req, res, next));
router.post('/hotspots/analyze', validateHotspotPayload, (req, res, next) => hotspotController.analyzeHotspot(req, res, next));

module.exports = router;

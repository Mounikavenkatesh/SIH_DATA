/**
 * AI Industrial Fire & Persistent Thermal Source Intelligence Platform
 * Main Node.js Express Server
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const hotspotRoutes = require('./routes/hotspotRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/industrial_fire_ai';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Security & Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: '*', // Allow local frontend during hackathon development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Database Connection
mongoose.set('strictQuery', false);
mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log(`[MongoDB] Connected successfully to: ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB (${err.message}). Running in Demo/Memory Mode.`);
  });

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database server.');
});

// Root Health & API Docs Overview
app.get('/', (req, res) => {
  res.json({
    title: 'Satellite Thermal Source Monitoring & Anomaly Analysis API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      health: 'GET /api/health',
      config: 'GET /api/config',
      hotspots: 'GET /api/hotspots',
      analyze: 'POST /api/analyze',
      statistics: 'GET /api/statistics',
      history: 'GET /api/hotspots/history',
      nearby: 'GET /api/hotspots/nearby',
    },
    dataMode: process.env.FIRMS_API_KEY ? 'LIVE_MODE' : 'DEMO_MODE',
    disclaimer: 'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS',
  });
});

// Mount API Router
app.use('/api', hotspotRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
const server = app.listen(PORT, () => {
  console.log('='.repeat(65));
  console.log(`🛰️ SATELLITE THERMAL SOURCE MONITORING BACKEND`);
  console.log(`📡 Server listening on port: ${PORT} (http://localhost:${PORT})`);
  console.log(`🌍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Statistics:   http://localhost:${PORT}/api/statistics`);
  console.log(`🔥 Hotspots API: http://localhost:${PORT}/api/hotspots`);
  console.log(`⚙️  Data Mode:    ${process.env.FIRMS_API_KEY ? '🟢 LIVE' : '🟡 DEMO MODE'}`);
  console.log('='.repeat(65));
});

module.exports = { app, server };

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
const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/errorHandler');

const app = express();

// Railway provides PORT through environment variables.
// 8080 is used only when running locally.
const PORT = process.env.PORT || 8080;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/industrial_fire_ai';

// ================================
// Security & Middleware
// ================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ================================
// MongoDB Connection
// ================================

mongoose.set('strictQuery', false);

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log('[MongoDB] Connected successfully.');
  })
  .catch((err) => {
    console.warn(
      `[MongoDB Warning] Could not connect to MongoDB (${err.message}).`
    );
    console.warn(
      '[MongoDB] Running in Demo/Memory Mode.'
    );
  });

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database server.');
});

// ================================
// Root Route
// ================================

app.get('/', (req, res) => {
  res.json({
    title:
      'Satellite Thermal Source Monitoring & Anomaly Analysis API',
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

    dataMode: process.env.FIRMS_API_KEY
      ? 'LIVE_MODE'
      : 'DEMO_MODE',

    disclaimer:
      'SYNTHETIC DEMO DATA — NOT REAL NASA OBSERVATIONS',
  });
});

// ================================
// API Routes
// ================================

app.use('/api', hotspotRoutes);

// ================================
// Error Handling
// ================================

app.use(notFoundHandler);
app.use(errorHandler);

// ================================
// Start Server
// ================================

// IMPORTANT FOR RAILWAY:
// Listen on 0.0.0.0 and use Railway's PORT.
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(65));
  console.log(
    '🛰️ SATELLITE THERMAL SOURCE MONITORING BACKEND'
  );
  console.log(`📡 Server listening on port: ${PORT}`);
  console.log(
    `🌍 Health Check: http://localhost:${PORT}/api/health`
  );
  console.log(
    `📊 Statistics:   http://localhost:${PORT}/api/statistics`
  );
  console.log(
    `🔥 Hotspots API: http://localhost:${PORT}/api/hotspots`
  );
  console.log(
    `⚙️  Data Mode:    ${
      process.env.FIRMS_API_KEY
        ? '🟢 LIVE'
        : '🟡 DEMO MODE'
    }`
  );
  console.log('='.repeat(65));
});

// ================================
// Export
// ================================

module.exports = {
  app,
  server,
};
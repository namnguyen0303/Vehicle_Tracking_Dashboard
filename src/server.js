require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');

const env = require('./config/env');
const db = require('./config/db');
const { createWebSocketServer } = require('./ws/websocketServer');
const { startVehiclePoller } = require('./services/vehiclePoller');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/zones', require('./routes/zones'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api', require('./routes/auth')); // POST /api/login

// Serve static dashboard (OpenLayers frontend will live in /public)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server and attach WebSocket server
const server = http.createServer(app);
const { broadcast } = createWebSocketServer(server);

startVehiclePoller({ broadcast });

async function cleanupOldVehiclePositions() {
  if (env.disableDb) return;
  try {
    const result = await db.query(
      `DELETE FROM vehicle_positions WHERE recorded_at < NOW() - INTERVAL '30 days';`
    );
    if (result?.rowCount != null) {
      console.log(`Vehicle history retention: deleted ${result.rowCount} rows older than 30 days`);
    }
  } catch (err) {
    console.warn('Vehicle history retention cleanup failed:', err.message);
  }
}

// Run once shortly after start, then daily.
setTimeout(() => {
  cleanupOldVehiclePositions().catch(() => {});
}, 5000);
setInterval(() => {
  cleanupOldVehiclePositions().catch(() => {});
}, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`HTTP & WebSocket server listening on port ${PORT}`);
});


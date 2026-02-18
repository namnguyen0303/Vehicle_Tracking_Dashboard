require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');

const { createWebSocketServer } = require('./ws/websocketServer');
const { startSimulatedPoller } = require('./services/rideCircuitPoller');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/zones', require('./routes/zones'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api', require('./routes/auth')); // exposes POST /api/login

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

// Start simulated polling of vehicle data.
// This will later be swapped to call the real RideCircuit API when available.
startSimulatedPoller({ broadcast });

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`HTTP & WebSocket server listening on port ${PORT}`);
});


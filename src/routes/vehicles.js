const express = require('express');
const vehicleModel = require('../models/vehicle');
const vehiclePositionModel = require('../models/vehiclePosition');

const router = express.Router();

// GET /api/vehicles
// Returns the latest known position and status for all vehicles.
router.get('/', async (req, res) => {
  try {
    const vehicles = await vehicleModel.listAll();
    res.json(vehicles);
  } catch (err) {
    console.error('Failed to list vehicles', err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET /api/vehicles/:vehicleId/history?date=YYYY-MM-DD&tz=America/New_York
// Returns breadcrumb positions for the given vehicle on the selected local calendar day.
router.get('/:vehicleId/history', async (req, res) => {
  const { vehicleId } = req.params;
  const date = String(req.query.date || '').trim();
  const tz = String(req.query.tz || 'America/New_York').trim();

  if (!date) return res.status(400).json({ error: 'Missing required query param: date (YYYY-MM-DD)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }

  try {
    const rows = await vehiclePositionModel.listPositionsForDay({ vehicleId, date, tz });
    res.json({
      vehicleId,
      date,
      tz,
      count: rows.length,
      points: rows.map((r) => ({
        recordedAt: r.recorded_at,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        speedKph: r.speed_kph != null ? Number(r.speed_kph) : null,
        headingDeg: r.heading_deg != null ? Number(r.heading_deg) : null,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch vehicle history', err);
    res.status(500).json({ error: 'Failed to fetch vehicle history' });
  }
});

module.exports = router;


const express = require('express');
const vehicleModel = require('../models/vehicle');
const vehiclePositionModel = require('../models/vehiclePosition');

const router = express.Router();

function escapeCsvField(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeFilenamePart(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'vehicle';
}

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

// GET /api/vehicles/:vehicleId/history?date=YYYY-MM-DD&tz=America/New_York[&format=csv]
// JSON (default) or CSV (format=csv) for Excel — breadcrumb positions for the selected local day.
router.get('/:vehicleId/history', async (req, res) => {
  const { vehicleId } = req.params;
  const date = String(req.query.date || '').trim();
  const tz = String(req.query.tz || 'America/New_York').trim();
  const format = String(req.query.format || 'json').toLowerCase();

  if (!date) return res.status(400).json({ error: 'Missing required query param: date (YYYY-MM-DD)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }

  try {
    const rows = await vehiclePositionModel.listPositionsForDay({ vehicleId, date, tz });

    if (format === 'csv') {
      const header = [
        'vehicleId',
        'selectedDate',
        'timezone',
        'recordedAtUtc',
        'latitude',
        'longitude',
        'headingDeg',
      ];
      const lines = [header.map(escapeCsvField).join(',')];
      rows.forEach((r) => {
        const iso =
          r.recorded_at instanceof Date
            ? r.recorded_at.toISOString()
            : new Date(r.recorded_at).toISOString();
        lines.push(
          [
            escapeCsvField(vehicleId),
            escapeCsvField(date),
            escapeCsvField(tz),
            escapeCsvField(iso),
            escapeCsvField(r.latitude),
            escapeCsvField(r.longitude),
            escapeCsvField(r.heading_deg),
          ].join(',')
        );
      });
      const filename = `breadcrumb-${safeFilenamePart(vehicleId)}-${date}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(`\uFEFF${lines.join('\n')}`);
      return;
    }

    res.json({
      vehicleId,
      date,
      tz,
      count: rows.length,
      points: rows.map((r) => ({
        recordedAt: r.recorded_at,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        headingDeg: r.heading_deg != null ? Number(r.heading_deg) : null,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch vehicle history', err);
    res.status(500).json({ error: 'Failed to fetch vehicle history' });
  }
});

module.exports = router;


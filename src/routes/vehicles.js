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

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function localTimeFromUtcDate(d, tz) {
  const dt = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(dt.getTime())) return '';
  return dt.toLocaleString('en-US', {
    timeZone: tz,
    hour12: true,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

// GET /api/vehicles/utilization?date=YYYY-MM-DD&tz=America/New_York[&format=csv]
// Daily all-vehicle active/inactive report for ops/billing review.
router.get('/utilization', async (req, res) => {
  const date = String(req.query.date || '').trim();
  const tz = String(req.query.tz || 'America/New_York').trim();
  const format = String(req.query.format || 'json').toLowerCase();

  if (!date) return res.status(400).json({ error: 'Missing required query param: date (YYYY-MM-DD)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
  }

  const MOVE_THRESHOLD_M = 25;
  const INACTIVITY_MS = 60 * 60 * 1000;
  const dayTotalMinutes = 24 * 60;

  try {
    const rows = await vehiclePositionModel.listAllPositionsForDay({ date, tz });
    const byVehicle = new Map();
    rows.forEach((r) => {
      const id = String(r.vehicle_id);
      if (!byVehicle.has(id)) byVehicle.set(id, []);
      byVehicle.get(id).push(r);
    });

    const report = Array.from(byVehicle.entries())
      .map(([vehicleId, samples]) => {
        if (!samples.length) return null;

        let lastMovedAtMs = new Date(samples[0].recorded_at).getTime();
        let inactiveMs = 0;

        for (let i = 1; i < samples.length; i += 1) {
          const prev = samples[i - 1];
          const cur = samples[i];
          const prevTs = new Date(prev.recorded_at).getTime();
          const curTs = new Date(cur.recorded_at).getTime();
          if (!Number.isFinite(prevTs) || !Number.isFinite(curTs) || curTs <= prevTs) continue;

          const d = haversineMeters(
            Number(prev.latitude),
            Number(prev.longitude),
            Number(cur.latitude),
            Number(cur.longitude)
          );
          if (d >= MOVE_THRESHOLD_M) lastMovedAtMs = curTs;
          if (curTs - lastMovedAtMs >= INACTIVITY_MS) {
            inactiveMs += curTs - prevTs;
          }
        }

        const inactiveMinutes = Math.max(0, Math.min(dayTotalMinutes, inactiveMs / 60000));
        const activeMinutes = Math.max(0, dayTotalMinutes - inactiveMinutes);
        const activePercent = dayTotalMinutes > 0 ? (activeMinutes / dayTotalMinutes) * 100 : 0;
        const firstPingLocal = localTimeFromUtcDate(samples[0].recorded_at, tz);
        const lastPingLocal = localTimeFromUtcDate(samples[samples.length - 1].recorded_at, tz);

        return {
          date,
          vehicleId,
          activeMinutes: Number(activeMinutes.toFixed(2)),
          inactiveMinutes: Number(inactiveMinutes.toFixed(2)),
          activePercent: Number(activePercent.toFixed(2)),
          firstPingLocal,
          lastPingLocal,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));

    if (format === 'csv') {
      const header = [
        'date',
        'vehicle_id',
        'active_minutes',
        'inactive_minutes',
        'active_percent',
        'first_ping_local',
        'last_ping_local',
      ];
      const lines = [header.join(',')];
      report.forEach((r) => {
        lines.push(
          [
            escapeCsvField(r.date),
            escapeCsvField(r.vehicleId),
            escapeCsvField(r.activeMinutes),
            escapeCsvField(r.inactiveMinutes),
            escapeCsvField(r.activePercent),
            escapeCsvField(r.firstPingLocal),
            escapeCsvField(r.lastPingLocal),
          ].join(',')
        );
      });
      const filename = `utilization-all-vehicles-${date}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(`\uFEFF${lines.join('\n')}`);
      return;
    }

    res.json({ date, tz, count: report.length, vehicles: report });
  } catch (err) {
    console.error('Failed to build utilization report', err);
    res.status(500).json({ error: 'Failed to build utilization report' });
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


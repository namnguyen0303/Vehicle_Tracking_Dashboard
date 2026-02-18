const db = require('../config/db');

/**
 * Alert model
 *
 * We use this to record when a vehicle exits an authorized zone
 * (or other compliance issues in the future).
 */

async function createAlert({
  vehicleId,
  zoneId,
  alertType,
  message,
  latitude,
  longitude,
  createdAt = new Date(),
}) {
  const sql = `
    INSERT INTO alerts (vehicle_id, zone_id, alert_type, message, created_at, position)
    VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
    RETURNING *;
  `;

  const params = [
    vehicleId,
    zoneId || null,
    alertType,
    message,
    createdAt,
    longitude,
    latitude,
  ];

  const result = await db.query(sql, params);
  return result.rows[0];
}

async function listRecent({ limit = 50 } = {}) {
  const sql = `
    SELECT
      id,
      vehicle_id,
      zone_id,
      alert_type,
      message,
      created_at,
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude
    FROM alerts
    ORDER BY created_at DESC
    LIMIT $1;
  `;

  const result = await db.query(sql, [limit]);
  return result.rows;
}

module.exports = {
  createAlert,
  listRecent,
};


const db = require('../config/db');

/**
 * Vehicle model
 *
 * For this project we keep it intentionally minimal:
 * - upsertLatest: store the latest known vehicle position and status
 * - listAll: get all vehicles with their latest known positions
 */

async function upsertLatest({
  vehicleId,
  routeId,
  status,
  latitude,
  longitude,
  headingDeg,
  lastSeenAt = new Date(),
}) {
  // PostGIS: ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  const sql = `
    INSERT INTO vehicles (vehicle_id, route_id, status, last_seen_at, position, heading_deg)
    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7)
    ON CONFLICT (vehicle_id)
    DO UPDATE SET
      route_id = EXCLUDED.route_id,
      status = EXCLUDED.status,
      last_seen_at = EXCLUDED.last_seen_at,
      position = EXCLUDED.position,
      heading_deg = EXCLUDED.heading_deg
    RETURNING *;
  `;

  const params = [
    vehicleId,
    routeId || null,
    status || null,
    lastSeenAt,
    longitude,
    latitude,
    headingDeg != null ? headingDeg : null,
  ];

  const result = await db.query(sql, params);
  return result.rows[0];
}

async function listAll() {
  // Return GeoJSON-ish structure so the API / WebSocket layer
  // can easily convert this into map features later.
  const sql = `
    SELECT
      vehicle_id,
      route_id,
      status,
      last_seen_at,
      heading_deg,
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude
    FROM vehicles
    ORDER BY vehicle_id;
  `;

  const result = await db.query(sql);
  return result.rows;
}

module.exports = {
  upsertLatest,
  listAll,
};


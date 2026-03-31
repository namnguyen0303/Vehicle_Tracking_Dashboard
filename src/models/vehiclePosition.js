const db = require('../config/db');

/**
 * Vehicle position history model (breadcrumbs)
 *
 * Stores a time-series of vehicle positions for playback / reporting.
 */

async function insertPosition({
  vehicleId,
  latitude,
  longitude,
  headingDeg,
  recordedAt = new Date(),
}) {
  const sql = `
    INSERT INTO vehicle_positions (vehicle_id, recorded_at, position, heading_deg)
    VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
    RETURNING id;
  `;

  const params = [
    String(vehicleId),
    recordedAt,
    longitude,
    latitude,
    headingDeg != null ? headingDeg : null,
  ];

  const result = await db.query(sql, params);
  return result.rows[0];
}

/**
 * List positions for a vehicle for a given local calendar day (timezone-aware).
 * @param {string} vehicleId
 * @param {string} date - YYYY-MM-DD
 * @param {string} tz - IANA tz, e.g. America/New_York
 */
async function listPositionsForDay({ vehicleId, date, tz = 'America/New_York' }) {
  const sql = `
    SELECT
      recorded_at,
      ST_Y(position) AS latitude,
      ST_X(position) AS longitude,
      heading_deg
    FROM vehicle_positions
    WHERE vehicle_id = $1
      AND recorded_at >= (($2::date)::timestamp AT TIME ZONE $3)
      AND recorded_at <  ((($2::date + 1))::timestamp AT TIME ZONE $3)
    ORDER BY recorded_at ASC;
  `;

  const result = await db.query(sql, [String(vehicleId), date, tz]);
  return result.rows;
}

module.exports = {
  insertPosition,
  listPositionsForDay,
};


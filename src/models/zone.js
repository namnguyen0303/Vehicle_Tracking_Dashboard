const db = require('../config/db');

/**
 * Zone model
 *
 * For now, we focus on:
 * - listAll: get all active zones with their polygons
 * - isPointInAnyZone: check which zones a point belongs to (used by poller)
 *
 * More CRUD (create/update/delete zones) can be added later for admin tools.
 */

async function listAll() {
  const sql = `
    SELECT
      zone_id,
      name,
      is_active,
      ST_AsGeoJSON(area) AS geojson
    FROM zones
    WHERE is_active = TRUE
    ORDER BY name;
  `;

  const result = await db.query(sql);
  return result.rows.map((row) => ({
    zoneId: row.zone_id,
    name: row.name,
    isActive: row.is_active,
    geometry: JSON.parse(row.geojson),
  }));
}

/**
 * Given a latitude/longitude, return the IDs of any zones that contain it.
 * This is where PostGIS does the heavy lifting.
 */
async function findZonesContainingPoint(latitude, longitude) {
  const sql = `
    SELECT zone_id
    FROM zones
    WHERE is_active = TRUE
      AND ST_Contains(
            area,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
          );
  `;

  const params = [longitude, latitude];
  const result = await db.query(sql, params);
  return result.rows.map((row) => row.zone_id);
}

module.exports = {
  listAll,
  findZonesContainingPoint,
};


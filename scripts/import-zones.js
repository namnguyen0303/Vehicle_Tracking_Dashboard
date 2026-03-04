#!/usr/bin/env node
/**
 * Import zones from a GeoJSON file into the PostgreSQL zones table.
 *
 * Usage: node scripts/import-zones.js path/to/zones.geojson
 *
 * GeoJSON should be a FeatureCollection with features that have:
 * - geometry: Polygon or MultiPolygon
 * - properties: name (required), id or zone_id (optional - used as zone_id)
 *
 * Run the geometry migration first if your zones table has Polygon-only:
 *   psql -U postgres -d hollywood_microtransit -f sql/migrate-zones-geometry.sql
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const env = require('../src/config/env');

// Migration must be run as postgres (see sql/migrate-zones-geometry.sql)

async function importZones(geojsonPath) {
  const fullPath = path.resolve(process.cwd(), geojsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  let geojson;
  try {
    geojson = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
  });

  try {
    let features = [];
    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
      features = geojson.features;
    } else if (geojson.type === 'Feature') {
      features = [geojson];
    } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      features = [{ type: 'Feature', properties: {}, geometry: geojson }];
    } else {
      console.error('Unsupported GeoJSON type. Expected FeatureCollection, Feature, or Polygon/MultiPolygon.');
      process.exit(1);
    }

    let imported = 0;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) {
        console.warn('Skipping feature', i, '- geometry must be Polygon or MultiPolygon');
        continue;
      }

      const props = f.properties || {};
      const name = props.name || props.NAME || `Zone ${i + 1}`;
      const zoneId = props.id || props.zone_id || props.zone || props.ZONE_ID || `zone-${i + 1}`;

      const geomJson = JSON.stringify(f.geometry);

      await pool.query(
        `INSERT INTO zones (zone_id, name, area, is_active)
         VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), TRUE)
         ON CONFLICT (zone_id) DO UPDATE SET
           name = EXCLUDED.name,
           area = EXCLUDED.area,
           is_active = EXCLUDED.is_active`,
        [zoneId, name, geomJson]
      );
      imported++;
      console.log('Imported:', zoneId, '-', name);
    }

    console.log('\nDone. Imported', imported, 'zone(s).');
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const geojsonPath = process.argv[2];
if (!geojsonPath) {
  console.log('Usage: node scripts/import-zones.js <path-to-geojson>');
  console.log('Example: node scripts/import-zones.js data/hollywood-service-area.geojson');
  process.exit(1);
}

importZones(geojsonPath);

-- Allow Polygon OR MultiPolygon in zones (city boundaries are often MultiPolygon)
-- Run this once before importing GeoJSON: psql -U postgres -d hollywood_microtransit -f sql/migrate-zones-geometry.sql

ALTER TABLE zones
  ALTER COLUMN area TYPE geometry(Geometry, 4326)
  USING area::geometry;

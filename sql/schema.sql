-- PostgreSQL + PostGIS schema for Hollywood microtransit monitoring
-- Run this AFTER installed PostgreSQL and PostGIS.
--
-- Suggested setup steps:
--   CREATE DATABASE hollywood_microtransit;
--   \c hollywood_microtransit;
--   CREATE EXTENSION IF NOT EXISTS postgis;
--   CREATE USER hollywood_user WITH PASSWORD 'change-me';
--   GRANT ALL PRIVILEGES ON DATABASE hollywood_microtransit TO hollywood_user;
--   GRANT ALL ON SCHEMA public TO hollywood_user;
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO hollywood_user;

-- Vehicles: stores latest known position per vehicle
CREATE TABLE IF NOT EXISTS vehicles (
  id              SERIAL PRIMARY KEY,
  vehicle_id      TEXT NOT NULL UNIQUE,
  route_id        TEXT,
  status          TEXT, -- e.g. 'in_service', 'out_of_service', 'offline'
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Geographic point in WGS 84 (lat/lon)
  position        geometry(Point, 4326),
  speed_kph       NUMERIC,
  heading_deg     NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_vehicles_position
  ON vehicles
  USING GIST (position);

-- Zones: authorized geographic polygons
CREATE TABLE IF NOT EXISTS zones (
  id              SERIAL PRIMARY KEY,
  zone_id         TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  -- Authorized polygon area
  area            geometry(Polygon, 4326),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_zones_area
  ON zones
  USING GIST (area);

-- Alerts: zone compliance issues, especially leaving authorized zones
CREATE TABLE IF NOT EXISTS alerts (
  id              SERIAL PRIMARY KEY,
  vehicle_id      TEXT NOT NULL,
  zone_id         TEXT,
  alert_type      TEXT NOT NULL, -- e.g. 'left_authorized_zone'
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Snapshot of where the vehicle was when the alert was created
  position        geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_id
  ON alerts (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at
  ON alerts (created_at DESC);


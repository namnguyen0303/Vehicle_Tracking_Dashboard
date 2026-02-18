const env = require('../config/env');
const vehicleModel = require('../models/vehicle');
const zoneModel = require('../models/zone');
const alertModel = require('../models/alert');

/**
 * Simulated RideCircuit poller
 *
 * Until we have the real RideCircuit API, this service:
 * - Maintains an in-memory list of ~50 vehicles
 * - On each tick, slightly moves each vehicle around Hollywood, FL
 * - Writes the latest position to PostgreSQL
 * - Checks if the vehicle is inside any authorized zone
 * - If outside all zones, creates an alert
 * - Broadcasts vehicle and alert updates over WebSocket
 *
 * This keeps the rest of the architecture identical to production:
 *   Custom REST API -> WebSocket -> Render -> OpenLayers dashboard
 */

// Rough bounding box around central Hollywood, FL (lat/lon), kept strictly on land
const BOUNDS = {
  minLat: 26.0,
  maxLat: 26.04,
  minLon: -80.15,
  maxLon: -80.12,
};

// Number of simulated vehicles (keep it simple)
const VEHICLE_COUNT = 20;

// In-memory store of simulated vehicles (not persisted)
let vehicles = [];

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function initializeVehiclesIfNeeded() {
  if (vehicles.length > 0) return;

  const list = [];
  for (let i = 0; i < VEHICLE_COUNT; i += 1) {
    list.push({
      vehicleId: `VH-${String(i + 1).padStart(3, '0')}`,
      routeId: null,
      status: 'in_service',
      latitude: randomInRange(BOUNDS.minLat, BOUNDS.maxLat),
      longitude: randomInRange(BOUNDS.minLon, BOUNDS.maxLon),
      speedKph: randomInRange(0, 40),
      headingDeg: randomInRange(0, 360),
    });
  }
  vehicles = list;
}

function moveVehicle(v) {
  // Small random walk to simulate movement
  const deltaLat = randomInRange(-0.0005, 0.0005); // slightly smaller steps
  const deltaLon = randomInRange(-0.0005, 0.0005);

  let latitude = clamp(v.latitude + deltaLat, BOUNDS.minLat, BOUNDS.maxLat);
  let longitude = clamp(v.longitude + deltaLon, BOUNDS.minLon, BOUNDS.maxLon);

  const speedKph = randomInRange(0, 40);
  const headingDeg = randomInRange(0, 360);

  return {
    ...v,
    latitude,
    longitude,
    speedKph,
    headingDeg,
  };
}

async function tick({ broadcast }) {
  initializeVehiclesIfNeeded();

  const now = new Date();

  for (let i = 0; i < vehicles.length; i += 1) {
    const moved = moveVehicle(vehicles[i]);

    // Save back the moved state into our in-memory list
    vehicles[i] = moved;

    // If DB usage is disabled, just broadcast simulated data and skip all SQL calls.
    if (env.disableDb) {
      if (broadcast) {
        broadcast({
          type: 'vehicle_update',
          payload: {
            vehicleId: moved.vehicleId,
            routeId: moved.routeId,
            status: moved.status,
            latitude: moved.latitude,
            longitude: moved.longitude,
            speedKph: moved.speedKph,
            headingDeg: moved.headingDeg,
            lastSeenAt: now,
            inAnyZone: true,
            zones: ['authorized'],
          },
        });
      }
      continue;
    }

    try {
      // 1) Upsert latest vehicle position into DB
      const savedVehicle = await vehicleModel.upsertLatest({
        vehicleId: moved.vehicleId,
        routeId: moved.routeId,
        status: moved.status,
        latitude: moved.latitude,
        longitude: moved.longitude,
        speedKph: moved.speedKph,
        headingDeg: moved.headingDeg,
        lastSeenAt: now,
      });

      // 2) Determine if vehicle is inside any active authorized zone(s)
      let containingZones = [];
      try {
        containingZones = await zoneModel.findZonesContainingPoint(
          moved.latitude,
          moved.longitude
        );
      } catch (zoneErr) {
        // If PostGIS isn't set up yet or zones table is empty,
        // we log but continue so the whole system keeps running.
        console.warn('Zone check failed (likely before DB is ready):', zoneErr.message);
      }

      const inAnyZone = containingZones.length > 0;

      // 3) Broadcast vehicle update over WebSocket
      if (broadcast) {
        broadcast({
          type: 'vehicle_update',
          payload: {
            vehicleId: savedVehicle.vehicle_id,
            routeId: savedVehicle.route_id,
            status: savedVehicle.status,
            latitude: moved.latitude,
            longitude: moved.longitude,
            speedKph: moved.speedKph,
            headingDeg: moved.headingDeg,
            lastSeenAt: savedVehicle.last_seen_at,
            inAnyZone,
            zones: containingZones,
          },
        });
      }

      // 4) If vehicle is outside all zones, create and broadcast alert
      if (!inAnyZone) {
        try {
          const alert = await alertModel.createAlert({
            vehicleId: moved.vehicleId,
            zoneId: null,
            alertType: 'left_authorized_zone',
            message: `Vehicle ${moved.vehicleId} is outside all authorized zones`,
            latitude: moved.latitude,
            longitude: moved.longitude,
            createdAt: now,
          });

          if (broadcast) {
            broadcast({
              type: 'alert',
              payload: {
                id: alert.id,
                vehicleId: alert.vehicle_id,
                zoneId: alert.zone_id,
                alertType: alert.alert_type,
                message: alert.message,
                createdAt: alert.created_at,
                latitude: moved.latitude,
                longitude: moved.longitude,
              },
            });
          }
        } catch (alertErr) {
          console.warn(
            'Failed to create alert (likely before alerts table exists):',
            alertErr.message
          );
        }
      }
    } catch (err) {
      // Common case early on: PostgreSQL or PostGIS not installed yet.
      console.warn(
        `Poller failed to update vehicle ${vehicles[i].vehicleId}. ` +
          'This is expected until PostgreSQL/PostGIS and schema are set up.',
        err.message
      );
    }
  }
}

function startSimulatedPoller({ broadcast }) {
  const intervalMs = env.rideCircuit.pollIntervalMs || 10000;

  console.log(
    `Starting simulated RideCircuit poller with interval ${intervalMs}ms for ${VEHICLE_COUNT} vehicles.`
  );

  // Run one tick a few seconds after startup, then at fixed interval
  setTimeout(() => {
    tick({ broadcast }).catch((err) => {
      console.error('Initial poller tick failed:', err);
    });
  }, 3000);

  setInterval(() => {
    tick({ broadcast }).catch((err) => {
      console.error('Poller tick failed:', err);
    });
  }, intervalMs);
}

module.exports = {
  startSimulatedPoller,
};


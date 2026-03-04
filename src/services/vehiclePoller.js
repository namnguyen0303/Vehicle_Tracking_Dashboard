const env = require('../config/env');
const vehicleModel = require('../models/vehicle');
const zoneModel = require('../models/zone');
const alertModel = require('../models/alert');

/**
 * Vehicle poller – fetches vehicle GPS data from Samsara API and broadcasts updates.
 * Requires SAMSARA_API_TOKEN. No simulated data.
 *
 * Samsara docs: https://developers.samsara.com/docs/vehicle-stats-feed
 */

/**
 * Fetch vehicle locations from Samsara API.
 * Uses /fleet/vehicles/stats?types=gps for GPS data (not /fleet/vehicles which has no locations).
 * Docs: https://developers.samsara.com/docs/vehicle-stats-feed
 * Returns array of { vehicleId, latitude, longitude, speedKph, headingDeg, ... } or null on error.
 */
async function fetchFromSamsara() {
  const apiToken = (env.samsara.apiToken || '').trim();
  if (!apiToken) return null;

  const { baseUrl } = env.samsara;
  const url = `${baseUrl}/fleet/vehicles/stats?types=gps`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await res.text();

    if (!res.ok) {
      console.warn('Samsara API error:', res.status, body.slice(0, 500));
      return null;
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch {
      console.warn('Samsara API: invalid JSON response');
      return null;
    }

    const data = json.data || json;
    if (!Array.isArray(data)) {
      console.warn('Samsara API: unexpected response shape, data is not array');
      return null;
    }

    // Stats response: { name, gps: { latitude, longitude, speedMph?, headingDeg? } }
    // Or: { name, location: { latitude, longitude, headingDegrees } }
    // Or: { asset: { id }, location: { latitude, longitude, headingDegrees } }
    const withLocation = data.filter((v) => {
      const loc = v.gps || v.location;
      return loc && loc.latitude != null && loc.longitude != null;
    });

    if (withLocation.length === 0) {
      console.warn('Samsara API: no vehicles with GPS in response (got', data.length, 'vehicles)');
      return null;
    }

    return withLocation.map((v) => {
      const loc = v.gps || v.location || {};
      const vehicleId = v.name || v.asset?.id || v.id || 'unknown';
      const speedMph = loc.speedMph ?? loc.speed;
      const headingDeg = loc.headingDeg ?? loc.headingDegrees ?? 0;
      return {
        vehicleId: String(vehicleId),
        routeId: v.routeId || null,
        status: v.engineStates?.value || 'in_service',
        latitude: loc.latitude,
        longitude: loc.longitude,
        speedKph: speedMph != null ? speedMph * 1.60934 : 0,
        headingDeg,
      };
    });
  } catch (err) {
    console.warn('Samsara fetch failed:', err.message);
    return null;
  }
}

// Track which vehicles were in a zone last tick (alert only on transition out)
const lastInZone = new Map();

async function tick({ broadcast }) {
  const vehicles = await fetchFromSamsara();
  if (!vehicles || vehicles.length === 0) return;

  const now = new Date();

  for (let i = 0; i < vehicles.length; i += 1) {
    const v = vehicles[i];

    if (env.disableDb) {
      if (broadcast) {
        broadcast({
          type: 'vehicle_update',
          payload: {
            vehicleId: v.vehicleId,
            routeId: v.routeId,
            status: v.status,
            latitude: v.latitude,
            longitude: v.longitude,
            speedKph: v.speedKph ?? 0,
            headingDeg: v.headingDeg ?? 0,
            lastSeenAt: now,
            inAnyZone: true,
            zones: ['authorized'],
          },
        });
      }
      continue;
    }

    try {
      const savedVehicle = await vehicleModel.upsertLatest({
        vehicleId: v.vehicleId,
        routeId: v.routeId,
        status: v.status,
        latitude: v.latitude,
        longitude: v.longitude,
        speedKph: v.speedKph,
        headingDeg: v.headingDeg,
        lastSeenAt: now,
      });

      let containingZones = [];
      try {
        containingZones = await zoneModel.findZonesContainingPoint(v.latitude, v.longitude);
      } catch (zoneErr) {
        console.warn('Zone check failed:', zoneErr.message);
      }

      const inAnyZone = containingZones.length > 0;
      const wasInZone = lastInZone.get(v.vehicleId) ?? false;
      lastInZone.set(v.vehicleId, inAnyZone);

      if (broadcast) {
        broadcast({
          type: 'vehicle_update',
          payload: {
            vehicleId: savedVehicle.vehicle_id,
            routeId: savedVehicle.route_id,
            status: savedVehicle.status,
            latitude: v.latitude,
            longitude: v.longitude,
            speedKph: v.speedKph ?? 0,
            headingDeg: v.headingDeg ?? 0,
            lastSeenAt: savedVehicle.last_seen_at,
            inAnyZone,
            zones: containingZones,
          },
        });
      }

      // Only alert when vehicle just left a zone (transition in -> out)
      if (wasInZone && !inAnyZone) {
        try {
          const alert = await alertModel.createAlert({
            vehicleId: v.vehicleId,
            zoneId: null,
            alertType: 'left_authorized_zone',
            message: `Vehicle ${v.vehicleId} left the authorized zone`,
            latitude: v.latitude,
            longitude: v.longitude,
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
                latitude: v.latitude,
                longitude: v.longitude,
              },
            });
          }
        } catch (alertErr) {
          console.warn('Failed to create alert:', alertErr.message);
        }
      }
    } catch (err) {
      console.warn(`Poller failed for ${v.vehicleId}:`, err.message);
    }
  }
}

function startVehiclePoller({ broadcast }) {
  const apiToken = (env.samsara.apiToken || '').trim();
  const intervalMs = env.samsara.pollIntervalMs || 10000;

  if (!apiToken) {
    console.warn('Vehicle poller: SAMSARA_API_TOKEN not set, poller disabled');
    return;
  }

  console.log(`Starting vehicle poller (Samsara API) with interval ${intervalMs}ms`);

  setTimeout(() => {
    tick({ broadcast }).catch((err) => console.error('Initial poller tick failed:', err));
  }, 3000);

  setInterval(() => {
    tick({ broadcast }).catch((err) => console.error('Poller tick failed:', err));
  }, intervalMs);
}

module.exports = {
  startVehiclePoller,
};

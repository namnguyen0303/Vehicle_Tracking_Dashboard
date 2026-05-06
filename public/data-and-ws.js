/* global ol */

// Vehicle state, activity rules, and WebSocket connection.
// Calls UI and map functions exposed on `window`.

(function () {
  // Track vehicle state for fleet list and map
  const vehicleStateById = {};
  window.vehicleStateById = vehicleStateById;

  // Current selected vehicle (shared across UI + map)
  window.selectedVehicleId = null;

  /** No meaningful movement for this long → shown as inactive (billing / ops). */
  const INACTIVITY_MS = 60 * 60 * 1000;
  /** Ignore GPS jitter under this distance when updating "last moved" time. */
  const MOVE_THRESHOLD_M = 25;

  let activityRefreshTimer = null;

  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function notifyVehicleInactive(vehicleId) {
    if (typeof window.addAlertItem === 'function') window.addAlertItem('Vehicle is inactive.', vehicleId);
  }

  function notifyVehicleActive(vehicleId) {
    if (typeof window.addAlertItem === 'function')
      window.addAlertItem('Vehicle is active again.', vehicleId);
  }

  function mergeVehicleStateFromPayload(p) {
    const prev = vehicleStateById[p.vehicleId];
    const wasInactive = !!prev?.inactive;
    const now = Date.now();
    let lastMovedAt;

    if (
      prev &&
      typeof prev.latitude === 'number' &&
      typeof prev.longitude === 'number' &&
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number'
    ) {
      const d = haversineMeters(prev.latitude, prev.longitude, p.latitude, p.longitude);
      lastMovedAt = d >= MOVE_THRESHOLD_M ? now : prev.lastMovedAt ?? prev.lastUpdatedAt ?? now;
    } else {
      lastMovedAt = now;
    }

    const inactive = now - lastMovedAt >= INACTIVITY_MS;
    if (!wasInactive && inactive) {
      notifyVehicleInactive(p.vehicleId);
    } else if (wasInactive && !inactive) {
      notifyVehicleActive(p.vehicleId);
    }

    vehicleStateById[p.vehicleId] = {
      inAnyZone: p.inAnyZone,
      latitude: p.latitude,
      longitude: p.longitude,
      status: p.status,
      lastUpdatedAt: now,
      lastMovedAt,
      inactive,
    };
  }

  function tickActivityFromClock() {
    const now = Date.now();
    let changed = false;
    Object.keys(vehicleStateById).forEach((id) => {
      const s = vehicleStateById[id];
      const ref = s.lastMovedAt ?? s.lastUpdatedAt;
      const inactive = now - ref >= INACTIVITY_MS;
      if (s.inactive !== inactive) {
        s.inactive = inactive;
        if (inactive) notifyVehicleInactive(id);
        else notifyVehicleActive(id);
        changed = true;
      }
    });
    if (!changed) return;
    if (typeof window.updateVehiclesList === 'function') window.updateVehiclesList();
    if (typeof window.refreshSelectedVehicleStyles === 'function') window.refreshSelectedVehicleStyles();
    if (window.selectedVehicleId && typeof window.updateVehicleDrawerUI === 'function')
      window.updateVehicleDrawerUI();
  }

  function startActivityRefreshTimer() {
    if (activityRefreshTimer) clearInterval(activityRefreshTimer);
    activityRefreshTimer = setInterval(tickActivityFromClock, 60 * 1000);
  }

  function stopActivityRefreshTimer() {
    if (activityRefreshTimer) {
      clearInterval(activityRefreshTimer);
      activityRefreshTimer = null;
    }
  }

  function setConnectionStatus(connected, reconnecting = false) {
    const connectionStatus = document.getElementById('connection-status');
    if (!connectionStatus) return;
    const dot = connectionStatus.querySelector('.status-dot');
    const text = connectionStatus.querySelector('.status-text');
    if (dot) dot.className = 'status-dot' + (connected ? ' status-dot--connected' : '');
    if (text) text.textContent = reconnecting ? 'Reconnecting…' : connected ? 'Live' : 'Connecting…';
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      console.log('Connected to WebSocket server:', wsUrl);
      setConnectionStatus(true);
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'welcome') {
          if (typeof window.addAlertItem === 'function') window.addAlertItem(data.message);
          return;
        }

        if (data.type === 'vehicle_update' && data.payload) {
          const p = data.payload;
          mergeVehicleStateFromPayload(p);
          if (typeof window.updateVehiclesList === 'function') window.updateVehiclesList();
          if (typeof window.updateBreadcrumbVehicleOptions === 'function') window.updateBreadcrumbVehicleOptions();
          if (typeof window.upsertVehicleFeature === 'function') window.upsertVehicleFeature(p);
          if (window.selectedVehicleId && p.vehicleId === window.selectedVehicleId) {
            if (typeof window.updateVehicleDrawerUI === 'function') window.updateVehicleDrawerUI();
          }
          return;
        }

        if (data.type === 'alert' && data.payload) {
          const alert = data.payload;
          if (typeof window.addAlertItem === 'function') window.addAlertItem(alert.message, alert.vehicleId);
          if (typeof window.addAlertFeature === 'function') window.addAlertFeature(alert);
          return;
        }
      } catch (err) {
        console.warn('Non-JSON WebSocket message:', event.data);
      }
    });

    socket.addEventListener('close', () => {
      setConnectionStatus(false, true);
      console.warn('WebSocket disconnected – attempting to reconnect in 5s');
      setTimeout(connectWebSocket, 5000);
    });

    socket.addEventListener('error', () => {
      setConnectionStatus(false);
      console.error('WebSocket error');
    });
  }

  function startDashboard() {
    if (typeof window.createMap === 'function') window.createMap();
    if (typeof window.loadZones === 'function') window.loadZones(); // safe even if DB is not yet ready
    if (typeof window.loadServiceHours === 'function') window.loadServiceHours();
    if (typeof window.updateAlertsUI === 'function') window.updateAlertsUI();
    if (typeof window.updateVehiclesList === 'function') window.updateVehiclesList();
    if (typeof window.updateBreadcrumbVehicleOptions === 'function') window.updateBreadcrumbVehicleOptions();
    connectWebSocket();
    startActivityRefreshTimer();
  }

  function resetDashboardState() {
    stopActivityRefreshTimer();
    Object.keys(vehicleStateById).forEach((k) => delete vehicleStateById[k]);
    window.selectedVehicleId = null;
    if (typeof window.clearBreadcrumbTrail === 'function') window.clearBreadcrumbTrail();
    if (typeof window.closeVehicleDrawer === 'function') window.closeVehicleDrawer();
    if (typeof window.updateSelectedVehicleUI === 'function') window.updateSelectedVehicleUI();
    if (typeof window.refreshSelectedVehicleStyles === 'function') window.refreshSelectedVehicleStyles();
  }

  // Expose for UI script
  window.startDashboard = startDashboard;
  window.resetDashboardState = resetDashboardState;
})();


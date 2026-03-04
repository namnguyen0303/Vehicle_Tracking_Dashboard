// Frontend script: initializes OpenLayers map and connects WebSocket
// to render vehicles and alerts in real time.

/* global ol */

const alertsList = document.getElementById('alerts-list');
const alertsCount = document.getElementById('alerts-count');
const alertsEmpty = document.getElementById('alerts-empty');
const vehiclesList = document.getElementById('vehicles-list');
const vehiclesEmpty = document.getElementById('vehicles-empty');
const statVehicles = document.getElementById('stat-vehicles');
const statInZone = document.getElementById('stat-in-zone');
const statOutZone = document.getElementById('stat-out-zone');
const connectionStatus = document.getElementById('connection-status');

// Track vehicle state for stats and fleet list
const vehicleStateById = {};
const mapRoot = document.getElementById('map-root');
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

// --- Alert list helpers ----------------------------------------------------

const MAX_ALERTS_DISPLAYED = 50;

function setConnectionStatus(connected, reconnecting = false) {
  if (!connectionStatus) return;
  const dot = connectionStatus.querySelector('.status-dot');
  const text = connectionStatus.querySelector('.status-text');
  if (dot) dot.className = 'status-dot' + (connected ? ' status-dot--connected' : '');
  if (text) text.textContent = reconnecting ? 'Reconnecting…' : connected ? 'Live' : 'Connecting…';
}

function updateAlertsUI() {
  const count = alertsList ? alertsList.children.length : 0;
  if (alertsCount) alertsCount.textContent = count;
  if (alertsEmpty) alertsEmpty.classList.toggle('hidden', count > 0);
}

function updateVehicleStats() {
  const ids = Object.keys(vehicleStateById);
  const total = ids.length;
  let inZone = 0;
  ids.forEach((id) => {
    if (vehicleStateById[id]?.inAnyZone) inZone++;
  });
  const outZone = total - inZone;
  if (statVehicles) statVehicles.textContent = total;
  if (statInZone) statInZone.textContent = inZone;
  if (statOutZone) statOutZone.textContent = outZone;
}

function updateVehiclesList() {
  if (!vehiclesList) return;
  const ids = Object.keys(vehicleStateById);
  vehiclesList.innerHTML = '';
  if (ids.length === 0) {
    if (vehiclesEmpty) vehiclesEmpty.classList.remove('hidden');
    return;
  }
  if (vehiclesEmpty) vehiclesEmpty.classList.add('hidden');
  ids.sort().forEach((vehicleId) => {
    const state = vehicleStateById[vehicleId];
    const inZone = state?.inAnyZone ?? false;
    const li = document.createElement('li');
    li.className = 'vehicle-item';
    li.innerHTML = `
      <span class="vehicle-dot vehicle-dot--${inZone ? 'green' : 'red'}"></span>
      <span class="vehicle-id">${escapeHtml(vehicleId)}</span>
      <span class="vehicle-status">${inZone ? 'In zone' : 'Out of zone'}</span>
    `;
    vehiclesList.appendChild(li);
  });
}

function addAlertItem(text, vehicleId = null) {
  if (!alertsList) return;
  const li = document.createElement('li');
  li.className = 'alert-item';
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  li.innerHTML = vehicleId
    ? `<span class="alert-time">${time}</span><span class="alert-text">${escapeHtml(text)}</span><span class="alert-vehicle">${escapeHtml(vehicleId)}</span>`
    : `<span class="alert-time">${time}</span><span class="alert-text">${escapeHtml(text)}</span>`;
  alertsList.prepend(li);
  while (alertsList.children.length > MAX_ALERTS_DISPLAYED) {
    alertsList.lastChild.remove();
  }
  updateAlertsUI();
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// --- OpenLayers map setup --------------------------------------------------

let map;
let vehicleLayer;
let alertLayer;
let zoneLayer;

// Stores current vehicle features by vehicleId for easy updates
const vehicleFeaturesById = {};

function createMap() {
  if (!mapRoot || !window.ol) {
    console.error('OpenLayers not available');
    return;
  }

  // Dispose existing map before creating a new one (e.g. after logout/login)
  if (map) {
    map.setTarget(null);
    map = null;
    Object.keys(vehicleFeaturesById).forEach((k) => delete vehicleFeaturesById[k]);
  }

  const View = ol.View;
  const Map = ol.Map;
  const TileLayer = ol.layer.Tile;
  const XYZ = ol.source.XYZ;
  const VectorLayer = ol.layer.Vector;
  const VectorSource = ol.source.Vector;

  // Base map (OpenStreetMap tiles)
  const baseLayer = new TileLayer({
    source: new XYZ({
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
    }),
  });

  vehicleLayer = new VectorLayer({
    source: new VectorSource(),
  });

  alertLayer = new VectorLayer({
    source: new VectorSource(),
  });

  zoneLayer = new VectorLayer({
    source: new VectorSource(),
    style: createZoneStyle(),
  });

  map = new Map({
    target: mapRoot,
    layers: [baseLayer, zoneLayer, vehicleLayer, alertLayer],
    view: new View({
      // Center around Hollywood, FL in Web Mercator
      center: ol.proj.fromLonLat([-80.13, 26.01]),
      zoom: 13,
    }),
  });

  // Ensure map dimensions match container (fixes split view when container resizes)
  requestAnimationFrame(() => {
    if (map && mapRoot) map.updateSize();
  });
}

// --- Feature styling helpers ----------------------------------------------

function createVehicleStyle({ inAnyZone }) {
  const Style = ol.style.Style;
  const Circle = ol.style.Circle;
  const Fill = ol.style.Fill;
  const Stroke = ol.style.Stroke;

  const fillColor = inAnyZone ? 'rgba(16,185,129,0.92)' : 'rgba(244,63,94,0.92)';

  return new Style({
    image: new Circle({
      radius: 7,
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: 'rgba(12,15,20,0.9)', width: 1.5 }),
    }),
  });
}

function createZoneStyle() {
  const Style = ol.style.Style;
  const Fill = ol.style.Fill;
  const Stroke = ol.style.Stroke;

  return new Style({
    fill: new Fill({
      color: 'rgba(20, 184, 166, 0.12)',
    }),
    stroke: new Stroke({
      color: 'rgba(20, 184, 166, 0.5)',
      width: 2,
    }),
  });
}

function createAlertStyle() {
  const Style = ol.style.Style;
  const Circle = ol.style.Circle;
  const Fill = ol.style.Fill;
  const Stroke = ol.style.Stroke;

  return new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color: 'rgba(245,158,11,0.9)' }),
      stroke: new Stroke({ color: 'rgba(12,15,20,0.9)', width: 1.5 }),
    }),
  });
}

// --- Vehicle and alert feature management ----------------------------------

function upsertVehicleFeature(update) {
  const Feature = ol.Feature;
  const Point = ol.geom.Point;

  const { vehicleId, latitude, longitude, inAnyZone } = update;
  const coords = ol.proj.fromLonLat([longitude, latitude]);

  let feature = vehicleFeaturesById[vehicleId];
  if (!feature) {
    feature = new Feature({
      geometry: new Point(coords),
      vehicleId,
    });
    feature.setStyle(createVehicleStyle({ inAnyZone }));
    vehicleLayer.getSource().addFeature(feature);
    vehicleFeaturesById[vehicleId] = feature;
  } else {
    feature.getGeometry().setCoordinates(coords);
    feature.setStyle(createVehicleStyle({ inAnyZone }));
  }
}

function addAlertFeature(alert) {
  const Feature = ol.Feature;
  const Point = ol.geom.Point;

  const coords = ol.proj.fromLonLat([alert.longitude, alert.latitude]);

  const feature = new Feature({
    geometry: new Point(coords),
    alertId: alert.id,
  });
  feature.setStyle(createAlertStyle());
  alertLayer.getSource().addFeature(feature);
}

async function loadZones() {
  if (!zoneLayer) return;

  try {
    const res = await fetch('/api/zones');
    if (!res.ok) {
      console.warn('Failed to load zones', await res.text());
      return;
    }

    const zones = await res.json();
    const VectorSource = ol.source.Vector;
    const Feature = ol.Feature;
    const GeoJSON = ol.format.GeoJSON;

    const source = new VectorSource();
    const geoJsonFormat = new GeoJSON();

    zones.forEach((zone) => {
      if (!zone.geometry) return;
      const feature = geoJsonFormat.readFeature(
        {
          type: 'Feature',
          properties: { zoneId: zone.zoneId, name: zone.name },
          geometry: zone.geometry,
        },
        {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }
      );
      source.addFeature(feature);
    });

    zoneLayer.setSource(source);
  } catch (err) {
    console.warn('Error loading zones', err);
  }
}

// --- WebSocket connection ---------------------------------------------------

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
        addAlertItem(data.message);
        return;
      }

      if (data.type === 'vehicle_update' && data.payload) {
        const p = data.payload;
        vehicleStateById[p.vehicleId] = {
          inAnyZone: p.inAnyZone,
          latitude: p.latitude,
          longitude: p.longitude,
          status: p.status,
        };
        updateVehicleStats();
        updateVehiclesList();
        upsertVehicleFeature(p);
        return;
      }

      if (data.type === 'alert' && data.payload) {
        const alert = data.payload;
        addAlertItem(alert.message, alert.vehicleId);
        addAlertFeature(alert);
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

// --- Bootstrap --------------------------------------------------------------

function startDashboard() {
  createMap();
  loadZones(); // safe even if DB is not yet ready
  updateAlertsUI();
  updateVehicleStats();
  updateVehiclesList();
  connectWebSocket();
}

function handleLoginSubmit(event) {
  event.preventDefault();
  if (!loginUsernameInput || !loginPasswordInput) return;

  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  loginError.textContent = '';

  fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Login failed');
      }
      return res.json();
    })
    .then((data) => {
      if (!data || !data.success) {
        throw new Error('Invalid credentials');
      }
      if (loginOverlay) {
        loginOverlay.classList.add('hidden');
      }
      startDashboard();
    })
    .catch((err) => {
      console.error('Login error', err);
      loginError.textContent = 'Login failed. Check username and password.';
    });
}

function logout() {
  Object.keys(vehicleStateById).forEach((k) => delete vehicleStateById[k]);
  if (loginOverlay) loginOverlay.classList.remove('hidden');
  if (loginUsernameInput) loginUsernameInput.value = '';
  if (loginPasswordInput) loginPasswordInput.value = '';
  if (loginError) loginError.textContent = '';
}

function bootstrap() {
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

window.addEventListener('load', bootstrap);


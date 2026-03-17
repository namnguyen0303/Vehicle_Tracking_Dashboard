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

// Vehicle details drawer
const vehicleDrawer = document.getElementById('vehicle-drawer');
const drawerCloseBtn = document.getElementById('drawer-close');
const drawerClearBtn = document.getElementById('drawer-clear');
const drawerZoomBtn = document.getElementById('drawer-zoom');
const drawerVehicleId = document.getElementById('drawer-vehicle-id');
const drawerZoneBadge = document.getElementById('drawer-zone-badge');
const drawerStatusBadge = document.getElementById('drawer-status-badge');
const drawerLastUpdate = document.getElementById('drawer-last-update');
const drawerLat = document.getElementById('drawer-lat');
const drawerLon = document.getElementById('drawer-lon');

let selectedVehicleId = null;

// --- Alert list helpers ----------------------------------------------------

const MAX_ALERTS_DISPLAYED = 50;

function formatTimeAgo(ms) {
  if (!ms) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

function formatCoord(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(6);
}

function openVehicleDrawer(vehicleId) {
  selectedVehicleId = vehicleId;
  if (vehicleDrawer) vehicleDrawer.classList.remove('hidden');
  updateSelectedVehicleUI();
  updateVehicleDrawerUI();
  refreshSelectedVehicleStyles();
}

function closeVehicleDrawer() {
  if (vehicleDrawer) vehicleDrawer.classList.add('hidden');
}

function clearVehicleSelection() {
  selectedVehicleId = null;
  closeVehicleDrawer();
  updateSelectedVehicleUI();
  refreshSelectedVehicleStyles();
}

function updateVehicleDrawerUI() {
  if (!selectedVehicleId) return;

  const state = vehicleStateById[selectedVehicleId];
  if (!state) return;

  if (drawerVehicleId) drawerVehicleId.textContent = selectedVehicleId;

  const inZone = state?.inAnyZone ?? false;
  if (drawerZoneBadge) {
    drawerZoneBadge.className = `pill ${inZone ? 'pill--green' : 'pill--red'}`;
    drawerZoneBadge.textContent = inZone ? 'Inside zone' : 'Outside zone';
  }

  if (drawerStatusBadge) {
    drawerStatusBadge.className = 'pill pill--muted';
    drawerStatusBadge.textContent = state?.status ? String(state.status) : '—';
  }

  if (drawerLastUpdate) drawerLastUpdate.textContent = formatTimeAgo(state?.lastUpdatedAt);
  if (drawerLat) drawerLat.textContent = formatCoord(state?.latitude);
  if (drawerLon) drawerLon.textContent = formatCoord(state?.longitude);
}

function updateSelectedVehicleUI() {
  if (!vehiclesList) return;
  const items = vehiclesList.querySelectorAll('.vehicle-item');
  items.forEach((el) => {
    const id = el.getAttribute('data-vehicle-id');
    el.classList.toggle('is-selected', !!selectedVehicleId && id === selectedVehicleId);
  });
}

function refreshSelectedVehicleStyles() {
  if (!selectedVehicleId) {
    Object.keys(vehicleFeaturesById).forEach((id) => {
      const feature = vehicleFeaturesById[id];
      const state = vehicleStateById[id];
      if (!feature || !state) return;
      feature.setStyle(createVehicleStyle({ inAnyZone: !!state.inAnyZone, selected: false }));
    });
    return;
  }

  Object.keys(vehicleFeaturesById).forEach((id) => {
    const feature = vehicleFeaturesById[id];
    const state = vehicleStateById[id];
    if (!feature || !state) return;
    feature.setStyle(createVehicleStyle({ inAnyZone: !!state.inAnyZone, selected: id === selectedVehicleId }));
  });
}

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
    li.setAttribute('data-vehicle-id', vehicleId);
    li.classList.toggle('is-selected', !!selectedVehicleId && vehicleId === selectedVehicleId);
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

  map.on('singleclick', (evt) => {
    const hit = map.forEachFeatureAtPixel(
      evt.pixel,
      (feature, layer) => {
        if (layer !== vehicleLayer) return null;
        const id = feature?.get?.('vehicleId');
        return id ? { id } : null;
      },
      { hitTolerance: 6 }
    );
    if (hit?.id) {
      const id = String(hit.id);
      if (selectedVehicleId && id === selectedVehicleId) {
        clearVehicleSelection();
      } else {
        openVehicleDrawer(id);
      }
    }
  });

  // Ensure map dimensions match container (fixes split view when container resizes)
  requestAnimationFrame(() => {
    if (map && mapRoot) map.updateSize();
  });
}

// --- Feature styling helpers ----------------------------------------------

let vehicleStyleCache = null;

function getVehicleStyleCache() {
  if (vehicleStyleCache) return vehicleStyleCache;
  if (!window.ol) return null;

  const Style = ol.style.Style;
  const Icon = ol.style.Icon;

  vehicleStyleCache = {
    inZone: new Style({
      image: new Icon({
        src: '/car-green.svg',
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        scale: 0.62,
      }),
    }),
    inZoneSelected: new Style({
      image: new Icon({
        src: '/car-green.svg',
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        scale: 0.78,
      }),
    }),
    outZone: new Style({
      image: new Icon({
        src: '/car-red.svg',
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        scale: 0.62,
      }),
    }),
    outZoneSelected: new Style({
      image: new Icon({
        src: '/car-red.svg',
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        scale: 0.78,
      }),
    }),
  };

  return vehicleStyleCache;
}

function createVehicleStyle({ inAnyZone, selected = false }) {
  const cache = getVehicleStyleCache();
  if (cache) {
    if (inAnyZone) return selected ? cache.inZoneSelected : cache.inZone;
    return selected ? cache.outZoneSelected : cache.outZone;
  }

  // Fallback: render a dot if OpenLayers isn't ready for some reason.
  const Style = ol.style.Style;
  const Circle = ol.style.Circle;
  const Fill = ol.style.Fill;
  const Stroke = ol.style.Stroke;
  const fillColor = inAnyZone ? 'rgba(22,163,74,0.9)' : 'rgba(225,29,72,0.9)';

  return new Style({
    image: new Circle({
      radius: 7,
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: 'rgba(255,255,255,0.95)', width: 1.5 }),
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
      stroke: new Stroke({ color: 'rgba(255,255,255,0.95)', width: 1.5 }),
    }),
  });
}

// --- Vehicle and alert feature management ----------------------------------

function upsertVehicleFeature(update) {
  const Feature = ol.Feature;
  const Point = ol.geom.Point;

  const { vehicleId, latitude, longitude, inAnyZone } = update;
  const coords = ol.proj.fromLonLat([longitude, latitude]);
  const isSelected = !!selectedVehicleId && vehicleId === selectedVehicleId;

  let feature = vehicleFeaturesById[vehicleId];
  if (!feature) {
    feature = new Feature({
      geometry: new Point(coords),
      vehicleId,
    });
    feature.setStyle(createVehicleStyle({ inAnyZone, selected: isSelected }));
    vehicleLayer.getSource().addFeature(feature);
    vehicleFeaturesById[vehicleId] = feature;
  } else {
    feature.getGeometry().setCoordinates(coords);
    feature.setStyle(createVehicleStyle({ inAnyZone, selected: isSelected }));
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
          lastUpdatedAt: Date.now(),
        };
        updateVehicleStats();
        updateVehiclesList();
        upsertVehicleFeature(p);
        if (selectedVehicleId && p.vehicleId === selectedVehicleId) updateVehicleDrawerUI();
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
  Object.keys(vehicleFeaturesById).forEach((k) => delete vehicleFeaturesById[k]);
  selectedVehicleId = null;
  closeVehicleDrawer();
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

  if (vehiclesList) {
    vehiclesList.addEventListener('click', (e) => {
      const li = e.target?.closest?.('.vehicle-item');
      if (!li) return;
      const id = li.getAttribute('data-vehicle-id');
      if (!id) return;
      const vehicleId = String(id);
      if (selectedVehicleId && vehicleId === selectedVehicleId) {
        clearVehicleSelection();
      } else {
        openVehicleDrawer(vehicleId);
      }
    });
  }

  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeVehicleDrawer);
  if (drawerClearBtn) drawerClearBtn.addEventListener('click', clearVehicleSelection);
  if (drawerZoomBtn) {
    drawerZoomBtn.addEventListener('click', () => {
      if (!selectedVehicleId || !map) return;
      const state = vehicleStateById[selectedVehicleId];
      if (!state || typeof state.longitude !== 'number' || typeof state.latitude !== 'number') return;
      const center = ol.proj.fromLonLat([state.longitude, state.latitude]);
      map.getView().animate({ center, zoom: Math.max(map.getView().getZoom() ?? 13, 16), duration: 450 });
    });
  }
}

window.addEventListener('load', bootstrap);


/* global ol */

// Map setup, styling, and feature/layer management for the dashboard.
// Exposes a small API on `window` so it can be used from other scripts.

(function () {
  // --- OpenLayers map setup --------------------------------------------------

  let map;
  let vehicleLayer;
  let alertLayer;
  let zoneLayer;
  let breadcrumbLayer;

  const baseLayers = { street: null, satellite: null, terrain: null };

  // Stores current vehicle features by vehicleId for easy updates
  const vehicleFeaturesById = {};
  let breadcrumbFeature = null;

  // --- Base layer switching -------------------------------------------------

  function setActiveBaseLayer(mode) {
    const keys = ['street', 'satellite', 'terrain'];
    if (!keys.includes(mode)) return;
    keys.forEach((k) => {
      if (baseLayers[k]) baseLayers[k].setVisible(k === mode);
    });
    const mapBaseSelect = document.getElementById('map-base-select');
    if (mapBaseSelect && mapBaseSelect.value !== mode) mapBaseSelect.value = mode;
  }

  function syncBaseLayerFromSelect() {
    const mapBaseSelect = document.getElementById('map-base-select');
    if (!mapBaseSelect) return;
    setActiveBaseLayer(mapBaseSelect.value || 'street');
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
          src: '/assets/svg/car-green.svg',
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          scale: 0.62,
        }),
      }),
      inZoneSelected: new Style({
        image: new Icon({
          src: '/assets/svg/car-green.svg',
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          scale: 0.78,
        }),
      }),
      outZone: new Style({
        image: new Icon({
          src: '/assets/svg/car-red.svg',
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          scale: 0.62,
        }),
      }),
      outZoneSelected: new Style({
        image: new Icon({
          src: '/assets/svg/car-red.svg',
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          scale: 0.78,
        }),
      }),
    };

    return vehicleStyleCache;
  }

  function createVehicleStyle({ inAnyZone, selected = false, inactive = false }) {
    const cache = getVehicleStyleCache();
    if (cache) {
      const base = inAnyZone
        ? selected
          ? cache.inZoneSelected
          : cache.inZone
        : selected
          ? cache.outZoneSelected
          : cache.outZone;
      if (!inactive) return base;
      return new ol.style.Style({
        image: base.getImage(),
        opacity: 0.52,
      });
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
      opacity: inactive ? 0.52 : 1,
    });
  }

  function createZoneStyle() {
    const Style = ol.style.Style;
    const Fill = ol.style.Fill;
    const Stroke = ol.style.Stroke;

    return new Style({
      fill: new Fill({
        color: 'rgba(5, 120, 105, 0.28)',
      }),
      stroke: new Stroke({
        color: 'rgba(4, 94, 82, 0.9)',
        width: 2.5,
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

  function createBreadcrumbStyle() {
    const Style = ol.style.Style;
    const Stroke = ol.style.Stroke;

    // Two-stroke style: a light "halo" for contrast + a bold colored line on top.
    return [
      new Style({
        stroke: new Stroke({
          color: 'rgba(255, 255, 255, 0.95)',
          width: 8,
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: 'rgba(14, 165, 233, 0.98)',
          width: 4.5,
        }),
      }),
    ];
  }

  // --- Vehicle and alert feature management ---------------------------------

  function upsertVehicleFeature(update) {
    const Feature = ol.Feature;
    const Point = ol.geom.Point;

    const { vehicleId, latitude, longitude, inAnyZone } = update;
    const coords = ol.proj.fromLonLat([longitude, latitude]);
    const isSelected = !!window.selectedVehicleId && vehicleId === window.selectedVehicleId;
    const state = window.vehicleStateById?.[vehicleId];
    const inactive = !!state?.inactive;

    let feature = vehicleFeaturesById[vehicleId];
    if (!feature) {
      feature = new Feature({
        geometry: new Point(coords),
        vehicleId,
      });
      feature.setStyle(createVehicleStyle({ inAnyZone, selected: isSelected, inactive }));
      vehicleLayer.getSource().addFeature(feature);
      vehicleFeaturesById[vehicleId] = feature;
    } else {
      feature.getGeometry().setCoordinates(coords);
      feature.setStyle(createVehicleStyle({ inAnyZone, selected: isSelected, inactive }));
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

  function clearBreadcrumbTrail() {
    if (!breadcrumbLayer) return;
    breadcrumbLayer.getSource().clear();
    breadcrumbFeature = null;
    if (typeof window.setBreadcrumbStatus === 'function') window.setBreadcrumbStatus('');
  }

  function getDefaultTimezone() {
    return Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'America/New_York';
  }

  async function showBreadcrumbTrail() {
    const breadcrumbVehicleSelect = document.getElementById('breadcrumb-vehicle');
    const breadcrumbDateInput = document.getElementById('breadcrumb-date');
    if (!breadcrumbVehicleSelect || !breadcrumbDateInput) return;
    if (!breadcrumbLayer) return;

    const vehicleId = String(breadcrumbVehicleSelect.value || '').trim();
    const date = String(breadcrumbDateInput.value || '').trim();
    const tz = getDefaultTimezone();

    if (!vehicleId) {
      if (typeof window.setBreadcrumbStatus === 'function')
        window.setBreadcrumbStatus('Select a vehicle first.');
      return;
    }
    if (!date) {
      if (typeof window.setBreadcrumbStatus === 'function')
        window.setBreadcrumbStatus('Select a day first.');
      return;
    }

    if (typeof window.setBreadcrumbStatus === 'function') window.setBreadcrumbStatus('Loading history…');

    try {
      const url = `/api/vehicles/${encodeURIComponent(vehicleId)}/history?date=${encodeURIComponent(
        date
      )}&tz=${encodeURIComponent(tz)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load history');
      }
      const data = await res.json();
      const points = Array.isArray(data?.points) ? data.points : [];

      if (points.length < 2) {
        clearBreadcrumbTrail();
        if (typeof window.setBreadcrumbStatus === 'function')
          window.setBreadcrumbStatus(`No trail data for ${vehicleId} on ${date}.`);
        return;
      }

      const maxDrawPoints = 5000;
      const step = points.length > maxDrawPoints ? Math.ceil(points.length / maxDrawPoints) : 1;
      const coords = [];
      for (let i = 0; i < points.length; i += step) {
        const p = points[i];
        if (typeof p.longitude !== 'number' || typeof p.latitude !== 'number') continue;
        coords.push(ol.proj.fromLonLat([p.longitude, p.latitude]));
      }

      if (coords.length < 2) {
        clearBreadcrumbTrail();
        if (typeof window.setBreadcrumbStatus === 'function')
          window.setBreadcrumbStatus(`No usable GPS points for ${vehicleId} on ${date}.`);
        return;
      }

      breadcrumbLayer.getSource().clear();
      const Feature = ol.Feature;
      const LineString = ol.geom.LineString;
      breadcrumbFeature = new Feature({
        geometry: new LineString(coords),
        vehicleId,
        date,
      });
      breadcrumbLayer.getSource().addFeature(breadcrumbFeature);

      const extent = breadcrumbFeature.getGeometry().getExtent();
      map.getView().fit(extent, { padding: [60, 30, 60, 30], duration: 450, maxZoom: 17 });

      if (typeof window.setBreadcrumbStatus === 'function')
        window.setBreadcrumbStatus(`Showing ${vehicleId} trail for ${date}.`);
    } catch (err) {
      console.error('Breadcrumb history error', err);
      if (typeof window.setBreadcrumbStatus === 'function')
        window.setBreadcrumbStatus('Failed to load history. Check server logs and DB.');
    }
  }

  async function downloadBreadcrumbCsv() {
    const breadcrumbVehicleSelect = document.getElementById('breadcrumb-vehicle');
    const breadcrumbDateInput = document.getElementById('breadcrumb-date');
    if (!breadcrumbVehicleSelect || !breadcrumbDateInput) return;

    const vehicleId = String(breadcrumbVehicleSelect.value || '').trim();
    const date = String(breadcrumbDateInput.value || '').trim();
    const tz = getDefaultTimezone();

    if (!vehicleId) {
      if (typeof window.setBreadcrumbStatus === 'function')
        window.setBreadcrumbStatus('Select a vehicle first.');
      return;
    }
    if (!date) {
      if (typeof window.setBreadcrumbStatus === 'function') window.setBreadcrumbStatus('Select a day first.');
      return;
    }

    const url = `/api/vehicles/${encodeURIComponent(vehicleId)}/history?date=${encodeURIComponent(
      date
    )}&tz=${encodeURIComponent(tz)}&format=csv`;
    if (typeof window.setBreadcrumbStatus === 'function') window.setBreadcrumbStatus('Preparing CSV…');

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Download failed');
      }
      const blob = await res.blob();
      let filename = `breadcrumb-${vehicleId}-${date}.csv`.replace(/[/\\?%*:|"<>]/g, '_');
      const dispo = res.headers.get('Content-Disposition');
      if (dispo) {
        const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(dispo);
        if (m) filename = decodeURIComponent(m[1].trim());
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      if (typeof window.setBreadcrumbStatus === 'function') window.setBreadcrumbStatus(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Breadcrumb CSV export error', err);
      if (typeof window.setBreadcrumbStatus === 'function')
        window.setBreadcrumbStatus('CSV download failed. Is the database enabled?');
    }
  }

  async function downloadUtilizationCsv() {
    const breadcrumbDateInput = document.getElementById('breadcrumb-date');
    if (!breadcrumbDateInput) return;
    const date = String(breadcrumbDateInput.value || '').trim();
    const tz = getDefaultTimezone();
    if (!date) {
      if (typeof window.setUtilizationStatus === 'function') window.setUtilizationStatus('Select a day first.');
      return;
    }

    const url = `/api/vehicles/utilization?date=${encodeURIComponent(date)}&tz=${encodeURIComponent(
      tz
    )}&format=csv`;
    if (typeof window.setUtilizationStatus === 'function')
      window.setUtilizationStatus('Preparing utilization CSV…');

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Download failed');
      }
      const blob = await res.blob();
      let filename = `utilization-all-vehicles-${date}.csv`.replace(/[/\\?%*:|"<>]/g, '_');
      const dispo = res.headers.get('Content-Disposition');
      if (dispo) {
        const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(dispo);
        if (m) filename = decodeURIComponent(m[1].trim());
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      if (typeof window.setUtilizationStatus === 'function')
        window.setUtilizationStatus(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Utilization CSV export error', err);
      if (typeof window.setUtilizationStatus === 'function')
        window.setUtilizationStatus('Utilization CSV download failed.');
    }
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

  function refreshSelectedVehicleStyles() {
    const selectedVehicleId = window.selectedVehicleId;
    const stateById = window.vehicleStateById || {};

    if (!selectedVehicleId) {
      Object.keys(vehicleFeaturesById).forEach((id) => {
        const feature = vehicleFeaturesById[id];
        const state = stateById[id];
        if (!feature || !state) return;
        feature.setStyle(
          createVehicleStyle({
            inAnyZone: !!state.inAnyZone,
            selected: false,
            inactive: !!state.inactive,
          })
        );
      });
      return;
    }

    Object.keys(vehicleFeaturesById).forEach((id) => {
      const feature = vehicleFeaturesById[id];
      const state = stateById[id];
      if (!feature || !state) return;
      feature.setStyle(
        createVehicleStyle({
          inAnyZone: !!state.inAnyZone,
          selected: id === selectedVehicleId,
          inactive: !!state.inactive,
        })
      );
    });
  }

  function createMap() {
    const mapRoot = document.getElementById('map-root');
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

    // Base maps (only one visible; toggled via #map-base-select)
    baseLayers.street = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        maxZoom: 19,
        attributions: '© OpenStreetMap contributors',
      }),
      visible: true,
    });
    baseLayers.satellite = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        attributions: 'Tiles © Esri',
      }),
      visible: false,
    });
    baseLayers.terrain = new TileLayer({
      source: new XYZ({
        url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
        maxZoom: 17,
        attributions: '© OpenStreetMap contributors, © OpenTopoMap',
      }),
      visible: false,
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

    breadcrumbLayer = new VectorLayer({
      source: new VectorSource(),
      style: createBreadcrumbStyle(),
    });

    map = new Map({
      target: mapRoot,
      layers: [
        baseLayers.street,
        baseLayers.satellite,
        baseLayers.terrain,
        zoneLayer,
        breadcrumbLayer,
        vehicleLayer,
        alertLayer,
      ],
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
        if (typeof window.toggleVehicleSelection === 'function') {
          window.toggleVehicleSelection(id);
        }
      }
    });

    // Ensure map dimensions match container (fixes split view when container resizes)
    requestAnimationFrame(() => {
      if (map && mapRoot) map.updateSize();
    });

    syncBaseLayerFromSelect();
  }

  // --- Exports --------------------------------------------------------------

  window.createMap = createMap;
  window.setActiveBaseLayer = setActiveBaseLayer;
  window.syncBaseLayerFromSelect = syncBaseLayerFromSelect;
  window.upsertVehicleFeature = upsertVehicleFeature;
  window.addAlertFeature = addAlertFeature;
  window.loadZones = loadZones;
  window.showBreadcrumbTrail = showBreadcrumbTrail;
  window.clearBreadcrumbTrail = clearBreadcrumbTrail;
  window.downloadBreadcrumbCsv = downloadBreadcrumbCsv;
  window.downloadUtilizationCsv = downloadUtilizationCsv;
  window.refreshSelectedVehicleStyles = refreshSelectedVehicleStyles;

  window.getMap = () => map;
})();


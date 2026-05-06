// UI rendering, login/logout flow, and service-hours widget.
// Exposes functions on `window` used by the WebSocket/data script.

(function () {
  const alertsList = document.getElementById('alerts-list');
  const alertsCount = document.getElementById('alerts-count');
  const alertsEmpty = document.getElementById('alerts-empty');
  const vehiclesList = document.getElementById('vehicles-list');
  const vehiclesEmpty = document.getElementById('vehicles-empty');

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
  const drawerActivityBadge = document.getElementById('drawer-activity-badge');
  const drawerLastUpdate = document.getElementById('drawer-last-update');
  const drawerLat = document.getElementById('drawer-lat');
  const drawerLon = document.getElementById('drawer-lon');

  // Breadcrumb history controls
  const breadcrumbVehicleSelect = document.getElementById('breadcrumb-vehicle');
  const breadcrumbDateInput = document.getElementById('breadcrumb-date');
  const breadcrumbShowBtn = document.getElementById('breadcrumb-show');
  const breadcrumbClearBtn = document.getElementById('breadcrumb-clear');
  const breadcrumbExportCsvBtn = document.getElementById('breadcrumb-export-csv');
  const utilizationExportCsvBtn = document.getElementById('utilization-export-csv');
  const breadcrumbStatus = document.getElementById('breadcrumb-status');
  const utilizationStatus = document.getElementById('utilization-status');
  const mapBaseSelect = document.getElementById('map-base-select');

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

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function updateAlertsUI() {
    const count = alertsList ? alertsList.children.length : 0;
    if (alertsCount) alertsCount.textContent = count;
    if (alertsEmpty) alertsEmpty.classList.toggle('hidden', count > 0);
  }

  function addAlertItem(text, vehicleId = null) {
    if (!alertsList) return;
    const li = document.createElement('li');
    li.className = 'alert-item';
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    li.innerHTML = vehicleId
      ? `<span class="alert-time">${time}</span><span class="alert-text">${escapeHtml(text)}</span><span class="alert-vehicle">${escapeHtml(vehicleId)}</span>`
      : `<span class="alert-time">${time}</span><span class="alert-text">${escapeHtml(text)}</span>`;
    alertsList.prepend(li);
    while (alertsList.children.length > MAX_ALERTS_DISPLAYED) {
      alertsList.lastChild.remove();
    }
    updateAlertsUI();
  }

  // --- Fleet list + selection ------------------------------------------------

  function updateVehiclesList() {
    if (!vehiclesList) return;
    const ids = Object.keys(window.vehicleStateById || {});
    vehiclesList.innerHTML = '';
    if (ids.length === 0) {
      if (vehiclesEmpty) vehiclesEmpty.classList.remove('hidden');
      return;
    }
    if (vehiclesEmpty) vehiclesEmpty.classList.add('hidden');

    ids.sort().forEach((vehicleId) => {
      const state = window.vehicleStateById[vehicleId];
      const inZone = state?.inAnyZone ?? false;
      const li = document.createElement('li');
      li.className = 'vehicle-item';
      li.setAttribute('data-vehicle-id', vehicleId);
      li.classList.toggle('is-selected', !!window.selectedVehicleId && vehicleId === window.selectedVehicleId);
      const inactive = !!state?.inactive;
      li.innerHTML = `
        <span class="vehicle-dot vehicle-dot--${inZone ? 'green' : 'red'}"></span>
        <span class="vehicle-id">${escapeHtml(vehicleId)}</span>
        <span class="vehicle-activity-label ${inactive ? 'vehicle-activity-label--inactive' : ''}">${inactive ? 'Inactive' : 'Active'}</span>
        <span class="vehicle-status">${inZone ? 'In zone' : 'Out of zone'}</span>
      `;
      vehiclesList.appendChild(li);
    });
  }

  function updateSelectedVehicleUI() {
    if (!vehiclesList) return;
    const items = vehiclesList.querySelectorAll('.vehicle-item');
    items.forEach((el) => {
      const id = el.getAttribute('data-vehicle-id');
      el.classList.toggle('is-selected', !!window.selectedVehicleId && id === window.selectedVehicleId);
    });
  }

  function openVehicleDrawer(vehicleId) {
    window.selectedVehicleId = vehicleId;
    if (vehicleDrawer) vehicleDrawer.classList.remove('hidden');
    updateSelectedVehicleUI();
    updateVehicleDrawerUI();
    if (typeof window.refreshSelectedVehicleStyles === 'function') window.refreshSelectedVehicleStyles();
  }

  function closeVehicleDrawer() {
    if (vehicleDrawer) vehicleDrawer.classList.add('hidden');
  }

  function clearVehicleSelection() {
    window.selectedVehicleId = null;
    closeVehicleDrawer();
    updateSelectedVehicleUI();
    if (typeof window.refreshSelectedVehicleStyles === 'function') window.refreshSelectedVehicleStyles();
  }

  function toggleVehicleSelection(vehicleId) {
    if (window.selectedVehicleId && vehicleId === window.selectedVehicleId) clearVehicleSelection();
    else openVehicleDrawer(vehicleId);
  }

  function updateVehicleDrawerUI() {
    if (!window.selectedVehicleId) return;
    const state = window.vehicleStateById?.[window.selectedVehicleId];
    if (!state) return;

    if (drawerVehicleId) drawerVehicleId.textContent = window.selectedVehicleId;

    const inZone = state?.inAnyZone ?? false;
    if (drawerZoneBadge) {
      drawerZoneBadge.className = `pill ${inZone ? 'pill--green' : 'pill--red'}`;
      drawerZoneBadge.textContent = inZone ? 'Inside zone' : 'Outside zone';
    }

    if (drawerStatusBadge) {
      drawerStatusBadge.className = 'pill pill--muted';
      drawerStatusBadge.textContent = state?.status ? String(state.status) : '—';
    }

    if (drawerActivityBadge) {
      const inactive = !!state?.inactive;
      drawerActivityBadge.className = inactive ? 'pill pill--amber' : 'pill pill--green';
      drawerActivityBadge.textContent = inactive ? 'Inactive' : 'Active';
    }

    if (drawerLastUpdate) drawerLastUpdate.textContent = formatTimeAgo(state?.lastUpdatedAt);
    if (drawerLat) drawerLat.textContent = formatCoord(state?.latitude);
    if (drawerLon) drawerLon.textContent = formatCoord(state?.longitude);
  }

  // --- Breadcrumb UI helpers -------------------------------------------------

  function setBreadcrumbStatus(text) {
    if (!breadcrumbStatus) return;
    breadcrumbStatus.textContent = text || '';
  }

  function setUtilizationStatus(text) {
    if (!utilizationStatus) return;
    utilizationStatus.textContent = text || '';
  }

  function updateBreadcrumbVehicleOptions() {
    if (!breadcrumbVehicleSelect) return;
    const ids = Object.keys(window.vehicleStateById || {}).sort();
    const current = breadcrumbVehicleSelect.value;

    breadcrumbVehicleSelect.innerHTML = '<option value="">Select a vehicle…</option>';
    ids.forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      breadcrumbVehicleSelect.appendChild(opt);
    });

    if (current && ids.includes(current)) breadcrumbVehicleSelect.value = current;
  }

  // --- Service hours widget --------------------------------------------------

  const SERVICE_HOURS_URL = '/service-hours.json';

  function setServiceHoursLoading() {
    const root = document.getElementById('service-hours-root');
    if (!root) return;
    root.className = 'service-hours';
    root.innerHTML = '<p class="service-hours-status">Loading schedule…</p>';
    root.setAttribute('aria-busy', 'true');
  }

  function renderServiceHoursIntoRoot(data) {
    const root = document.getElementById('service-hours-root');
    if (!root) return;

    if (!data || !Array.isArray(data.zones) || data.zones.length === 0) {
      root.innerHTML =
        '<p class="service-hours-status service-hours-status--error">Schedule data is missing or invalid.</p>';
      root.setAttribute('aria-busy', 'false');
      return;
    }

    const html = data.zones
      .map((zone) => {
        const name = escapeHtml(String(zone.name ?? '').trim() || 'Zone');
        const subtitle = escapeHtml(String(zone.subtitle ?? 'Service hours').trim());
        const rows = Array.isArray(zone.rows) ? zone.rows : [];
        const lis = rows
          .map((row) => {
            const days = escapeHtml(String(row.days ?? '').trim());
            const hours = escapeHtml(String(row.hours ?? '').trim());
            const closed = !!row.closed;
            const timeClass = closed ? 'service-hours-time service-hours-time--closed' : 'service-hours-time';
            return `<li class="service-hours-row"><span class="service-hours-days">${days}</span><span class="${timeClass}">${hours}</span></li>`;
          })
          .join('');

        return `<div class="service-hours-zone"><div class="service-hours-zone-head"><h3 class="service-hours-zone-name">${name}</h3><p class="service-hours-zone-label">${subtitle}</p></div><ul class="service-hours-list">${lis}</ul></div>`;
      })
      .join('');

    root.className = 'service-hours';
    root.innerHTML = html;
    root.setAttribute('aria-busy', 'false');
  }

  function loadServiceHours() {
    const root = document.getElementById('service-hours-root');
    if (!root) return;
    setServiceHoursLoading();

    fetch(SERVICE_HOURS_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(renderServiceHoursIntoRoot)
      .catch((err) => {
        console.warn('Service hours load failed', err);
        root.innerHTML =
          '<p class="service-hours-status service-hours-status--error">Could not load schedule. Check <code>service-hours.json</code> and try again.</p>';
        root.setAttribute('aria-busy', 'false');
      });
  }

  // --- Login / Logout --------------------------------------------------------

  function handleLoginSubmit(event) {
    event.preventDefault();
    if (!loginUsernameInput || !loginPasswordInput) return;

    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;

    if (loginError) loginError.textContent = '';

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
        if (loginOverlay) loginOverlay.classList.add('hidden');
        if (typeof window.startDashboard === 'function') window.startDashboard();
      })
      .catch((err) => {
        console.error('Login error', err);
        if (loginError) loginError.textContent = 'Login failed. Check username and password.';
      });
  }

  function logout() {
    if (typeof window.resetDashboardState === 'function') window.resetDashboardState();
    if (loginOverlay) loginOverlay.classList.remove('hidden');
    if (loginUsernameInput) loginUsernameInput.value = '';
    if (loginPasswordInput) loginPasswordInput.value = '';
    if (loginError) loginError.textContent = '';
  }

  // --- Bootstrap -------------------------------------------------------------

  function bootstrap() {
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    if (vehiclesList) {
      vehiclesList.addEventListener('click', (e) => {
        const li = e.target?.closest?.('.vehicle-item');
        if (!li) return;
        const id = li.getAttribute('data-vehicle-id');
        if (!id) return;
        toggleVehicleSelection(String(id));
      });
    }

    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeVehicleDrawer);
    if (drawerClearBtn) drawerClearBtn.addEventListener('click', clearVehicleSelection);
    if (drawerZoomBtn) {
      drawerZoomBtn.addEventListener('click', () => {
        if (!window.selectedVehicleId) return;
        const map = typeof window.getMap === 'function' ? window.getMap() : null;
        if (!map || !window.ol) return;
        const state = window.vehicleStateById?.[window.selectedVehicleId];
        if (!state || typeof state.longitude !== 'number' || typeof state.latitude !== 'number') return;
        const center = ol.proj.fromLonLat([state.longitude, state.latitude]);
        map.getView().animate({
          center,
          zoom: Math.max(map.getView().getZoom() ?? 13, 16),
          duration: 450,
        });
      });
    }

    if (breadcrumbDateInput) {
      // Default to today's date in the user's locale (YYYY-MM-DD)
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      breadcrumbDateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    if (breadcrumbShowBtn && typeof window.showBreadcrumbTrail === 'function')
      breadcrumbShowBtn.addEventListener('click', window.showBreadcrumbTrail);
    if (breadcrumbExportCsvBtn && typeof window.downloadBreadcrumbCsv === 'function')
      breadcrumbExportCsvBtn.addEventListener('click', window.downloadBreadcrumbCsv);
    if (utilizationExportCsvBtn && typeof window.downloadUtilizationCsv === 'function')
      utilizationExportCsvBtn.addEventListener('click', window.downloadUtilizationCsv);
    if (breadcrumbClearBtn && typeof window.clearBreadcrumbTrail === 'function')
      breadcrumbClearBtn.addEventListener('click', window.clearBreadcrumbTrail);

    if (mapBaseSelect && typeof window.setActiveBaseLayer === 'function') {
      mapBaseSelect.addEventListener('change', () => {
        window.setActiveBaseLayer(mapBaseSelect.value || 'street');
      });
    }
  }

  // --- Exports --------------------------------------------------------------

  window.escapeHtml = escapeHtml;
  window.addAlertItem = addAlertItem;
  window.updateAlertsUI = updateAlertsUI;
  window.updateVehiclesList = updateVehiclesList;
  window.updateSelectedVehicleUI = updateSelectedVehicleUI;
  window.updateVehicleDrawerUI = updateVehicleDrawerUI;
  window.openVehicleDrawer = openVehicleDrawer;
  window.closeVehicleDrawer = closeVehicleDrawer;
  window.clearVehicleSelection = clearVehicleSelection;
  window.toggleVehicleSelection = toggleVehicleSelection;

  window.setBreadcrumbStatus = setBreadcrumbStatus;
  window.setUtilizationStatus = setUtilizationStatus;
  window.updateBreadcrumbVehicleOptions = updateBreadcrumbVehicleOptions;

  window.loadServiceHours = loadServiceHours;

  window.addEventListener('load', bootstrap);
})();


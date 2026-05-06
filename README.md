# Hollywood Microtransit Monitoring Dashboard

A real-time web-based monitoring system for the City of Hollywood's microtransit fleet. Built for 50–100 vehicles with zone compliance tracking and live alerts.

## Architecture

```
Samsara API → Vehicle Poller → PostgreSQL+PostGIS
                                    ↓
Custom REST API (Express) ←─────────┘
        ↓
WebSocket Server (Node.js)
        ↓
OpenLayers Dashboard (staff-only)
        (local or on-premise deployment)
```

- **Backend:** Node.js, Express, WebSocket, PostgreSQL + PostGIS
- **Frontend:** OpenLayers, vanilla JS
- **Real-time:** WebSocket broadcasts vehicle positions and zone breach alerts

## Prerequisites

- Node.js 18+
- (Optional) PostgreSQL 14+ with PostGIS for production mode

## Local Setup

### 1. Clone and install

```bash
cd Hollywood-app
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable                                                 | Description                       | Default                    |
| -------------------------------------------------------- | --------------------------------- | -------------------------- |
| `PORT`                                                   | HTTP server port                  | `3001`                     |
| `DISABLE_DB`                                             | Skip PostgreSQL (simulation mode) | `false`                    |
| `SAMSARA_BASE_URL`                                       | Samsara API base URL              | `https://api.samsara.com`  |
| `SAMSARA_API_TOKEN`                                      | Samsara API token (Bearer)        | _(required for real data)_ |
| `SAMSARA_POLL_INTERVAL_MS`                               | Polling interval (ms)             | `10000`                    |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | PostgreSQL connection             | see `.env.example`         |

**For demo or development without PostgreSQL:** set `DISABLE_DB=true` in `.env`.

### 3. Run

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 4. Open the dashboard

- **URL:** http://localhost:3001
- **Login:** `staff` / `password` (placeholder credentials)
- **Map:** small **Map** control (top-right) switches Street (OpenStreetMap), Satellite (Esri World Imagery), or Terrain (OpenTopoMap). Legend stays bottom-left.

## Dashboard features (frontend)

### Vehicle activity: Active / Inactive

Implemented in the frontend scripts (**`public/data-and-ws.js`**, **`public/map-and-styles.js`**, **`public/ui.js`**) (no extra API or database fields). Used for ops/billing-style visibility when a vehicle has not moved meaningfully for a while.

- **Inactive** means: no **meaningful** GPS movement for **1 hour** (`INACTIVITY_MS`).
- **Meaningful movement** is when the reported position moves at least **25 meters** from the previous point (`MOVE_THRESHOLD_M`), using a Haversine distance check. Smaller jumps (noise, drift, idling) do not reset the clock.
- Each WebSocket `vehicle_update` merges state (`lastMovedAt`, `lastUpdatedAt`, `inactive`). A **60-second timer** re-evaluates `inactive` so the status can flip without waiting for another message.
- **UI:** fleet list label, vehicle drawer pill, map marker uses reduced **opacity** when inactive.

To change thresholds or the refresh interval, edit the constants in `public/data-and-ws.js` (`INACTIVITY_MS`, `MOVE_THRESHOLD_M`, and `startActivityRefreshTimer`).

### Service hours (Hollywood West / East)

- Shown under **Hours** in the **footer** (opens upward). Content is loaded from **`public/service-hours.json`** on dashboard start (`GET /service-hours.json`). The footer panel only has a placeholder in **`public/index.html`**; **`public/ui.js`** fetches JSON and renders the same layout as before (with `escapeHtml` on all strings).
- **Editing:** follow `docs/city-handover/change-service-hours.md` for step-by-step instructions and JSON examples.

## Project Structure

```
Hollywood-app/
├── data/
│   └── service_areas_*.geojson         # Source GIS files used for zone import/update
│
├── docs/
│   └── city-handover/                  # Operations handoff docs for City staff
│       ├── README.md                   # Handover index + quick links
│       ├── setup.md                    # PostgreSQL/PostGIS setup (CLI + mixed)
│       ├── setup-pgadmin.md            # PostgreSQL/PostGIS setup (pgAdmin-only)
│       ├── change-service-hours.md     # How to update footer service hours
│       ├── change-service-zones.md     # How to import/update service zones
│       └── change-login-credentials.md # How to update demo login credentials
│
├── public/                             # Static frontend assets served by Express
│   ├── index.html                      # Dashboard shell (login modal, layout, placeholders)
│   ├── map-and-styles.js               # Frontend logic: OpenLayers map, layers, styles, history/export actions
│   ├── data-and-ws.js                  # Frontend logic: vehicle state, inactivity logic, WebSocket client
│   ├── ui.js                           # Frontend logic: login/logout, lists, drawer UI, service hours widget
│   ├── styles.css                      # Dashboard styling and responsive layout
│   ├── service-hours.json              # Footer Hours content (safe to edit for schedule updates)
│   └── site.webmanifest                # PWA/browser metadata
│
├── scripts/
│   └── import-zones.js                 # CLI importer: GeoJSON -> PostGIS `zones` table (upsert by `zone_id`)
│
├── sql/
│   ├── schema.sql                      # Core PostgreSQL + PostGIS schema
│   ├── migrate-zones-geometry.sql      # Migration helper for zone geometry compatibility
│   ├── setup.md                        # SQL setup notes (CLI)
│   └── setup-pgadmin.md                # SQL setup notes (pgAdmin)
│
├── src/
│   ├── server.js                       # App entry point: Express API, static hosting, WebSocket attach, retention cleanup
│   │
│   ├── config/
│   │   ├── env.js                      # Centralized env parsing/defaults (PORT, DB, Samsara, DISABLE_DB)
│   │   └── db.js                       # PostgreSQL pool + shared query helper
│   │
│   ├── models/                         # Data-access layer (SQL per domain)
│   │   ├── vehicle.js                  # Latest vehicle state upsert/list
│   │   ├── vehiclePosition.js          # Breadcrumb history insert/query (timezone-aware day filters)
│   │   ├── zone.js                     # Active zones + point-in-zone lookup
│   │   └── alert.js                    # Alert create/list
│   │
│   ├── routes/                         # HTTP API endpoints (mounted under `/api`)
│   │   ├── auth.js                     # POST /api/login (demo hardcoded users)
│   │   ├── vehicles.js                 # Vehicle list, history JSON/CSV, utilization CSV
│   │   ├── zones.js                    # Authorized service zones API
│   │   └── alerts.js                   # Recent alerts API
│   │
│   ├── services/
│   │   └── vehiclePoller.js            # Samsara polling loop, DB writes, zone checks, alert generation, broadcasts
│   │
│   └── ws/
│       └── websocketServer.js          # `/ws` server, heartbeats, and broadcast helper
│
├── package.json                        # Scripts + dependencies
├── README.md                           # Main project guide (this file)
└── .env.example                        # Environment variable template
```

### How responsibilities are split

- `public/` is the client app and should contain no secrets.
- `src/routes/` handles request/response validation and formatting.
- `src/models/` contains SQL/data-access logic only.
- `src/services/` runs background business workflows (polling, compliance checks).
- `src/ws/` pushes real-time updates to connected dashboards.
- `scripts/` holds one-off operational tooling (safe to run from terminal).
- `docs/city-handover/` is the non-developer operations handbook.

## API Endpoints

| Method | Path                                                                       | Description                                                                                                                              |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/login`                                                               | Staff login                                                                                                                              |
| GET    | `/api/vehicles`                                                            | List vehicles with latest positions                                                                                                      |
| GET    | `/api/vehicles/:vehicleId/history?date=YYYY-MM-DD&tz=America/New_York`     | Breadcrumb history (JSON) for one vehicle/day                                                                                            |
| GET    | same + `&format=csv`                                                       | Same data as **CSV** download (Excel-friendly)                                                                                           |
| GET    | `/api/vehicles/utilization?date=YYYY-MM-DD&tz=America/New_York&format=csv` | Daily all-vehicle utilization report CSV (`active_minutes`, `inactive_minutes`, `active_percent`, `first_ping_local`, `last_ping_local`) |
| GET    | `/api/zones`                                                               | List authorized zones                                                                                                                    |
| GET    | `/api/alerts`                                                              | List recent alerts                                                                                                                       |
| GET    | `/health`                                                                  | Health check                                                                                                                             |

## WebSocket

- **Path:** `/ws`
- **Messages:** `vehicle_update`, `alert`, `welcome`

## Database Setup (when ready)

1. Install PostgreSQL and PostGIS
2. Create database and user (see comments in `sql/schema.sql`)
3. Run schema:

```bash
psql -d hollywood_microtransit -f sql/schema.sql
```

4. Set `DISABLE_DB=false` in `.env`

If you already created the database with an older schema that included `speed_kph`, run once:

```bash
psql -d hollywood_microtransit -f sql/migrate-remove-speed-kph.sql
```

## History (breadcrumb trail)

- The server stores vehicle position history in `vehicle_positions` when the database is enabled.
- The side panel **History** section (collapsed by default) provides **Vehicle + Day**, trail on the map, **Download CSV**, **Download Utilization CSV** (all vehicles/day), and **Clear**.
- Retention: the server periodically deletes history rows older than **30 days**.

### API example

```bash
curl "http://localhost:3001/api/vehicles/VEHICLE_123/history?date=2026-03-30&tz=America/New_York"
curl -o trail.csv "http://localhost:3001/api/vehicles/VEHICLE_123/history?date=2026-03-30&tz=America/New_York&format=csv"
```

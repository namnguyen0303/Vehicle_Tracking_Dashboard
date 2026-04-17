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

| Variable                                                 | Description                       | Default            |
| -------------------------------------------------------- | --------------------------------- | ------------------ |
| `PORT`                                                   | HTTP server port                  | `3000`             |
| `DISABLE_DB`                                             | Skip PostgreSQL (simulation mode) | `false`            |
| `SAMSARA_BASE_URL`                                      | Samsara API base URL              | `https://api.samsara.com` |
| `SAMSARA_API_TOKEN`                                      | Samsara API token (Bearer)       | _(required for real data)_ |
| `SAMSARA_POLL_INTERVAL_MS`                               | Polling interval (ms)             | `10000`            |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | PostgreSQL connection             | see `.env.example` |

**For demo or development without PostgreSQL:** set `DISABLE_DB=true` in `.env`.

### 3. Run

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 4. Open the dashboard

- **URL:** http://localhost:3000
- **Login:** `staff` / `password` (placeholder credentials)
- **Map:** small **Map** control (top-right) switches Street (OpenStreetMap), Satellite (Esri World Imagery), or Terrain (OpenTopoMap). Legend stays bottom-left.

## Dashboard features (frontend)

### Vehicle activity: Active / Inactive

Implemented in **`public/app.js`** (no extra API or database fields). Used for ops/billing-style visibility when a vehicle has not moved meaningfully for a while.

- **Inactive** means: no **meaningful** GPS movement for **1 hour** (`INACTIVITY_MS`).
- **Meaningful movement** is when the reported position moves at least **25 meters** from the previous point (`MOVE_THRESHOLD_M`), using a Haversine distance check. Smaller jumps (noise, drift, idling) do not reset the clock.
- Each WebSocket `vehicle_update` merges state (`lastMovedAt`, `lastUpdatedAt`, `inactive`). A **60-second timer** re-evaluates `inactive` so the status can flip without waiting for another message.
- **UI:** fleet list label, vehicle drawer pill, map marker uses reduced **opacity** when inactive.

To change thresholds or the refresh interval, edit the constants at the top of `public/app.js` (`INACTIVITY_MS`, `MOVE_THRESHOLD_M`, and `startActivityRefreshTimer`).

### Service hours (Hollywood West / East)

- Shown under **Hours** in the **footer** (opens upward). Content is loaded from **`public/service-hours.json`** on dashboard start (`GET /service-hours.json`). The footer panel only has a placeholder in **`public/index.html`**; **`public/app.js`** fetches JSON and renders the same layout as before (with `escapeHtml` on all strings).
- **Editing:** change zones, day ranges, or times in `service-hours.json`, commit the diff, redeploy. Set `"closed": true` on a row to apply the muted “closed” style for that line’s hours text.
- Keep wording aligned with official published service hours.

**`service-hours.json` shape:**

| Field | Meaning |
| ----- | ------- |
| `zones` | Array of service areas. |
| `zones[].name` | Heading (e.g. Hollywood West). |
| `zones[].subtitle` | Optional; defaults to `Service hours` if omitted. |
| `zones[].rows` | Array of `{ "days": "…", "hours": "…", "closed": optional boolean }`. |

## Project Structure

```
Hollywood-app/
├── public/           # Frontend (HTML, CSS, JS)
│   ├── index.html         # UI shell (footer Hours placeholder)
│   ├── service-hours.json # Footer Hours schedule (edit here)
│   ├── app.js             # Map, WebSocket, Active/Inactive, service hours fetch
│   ├── styles.css
│   └── icon-clock.svg
├── src/
│   ├── config/       # Env and DB config
│   ├── models/       # Vehicle, zone, alert models
│   ├── routes/       # REST API routes
│   ├── services/     # Samsara vehicle poller
│   ├── ws/           # WebSocket server
│   └── server.js     # Entry point
├── sql/
│   └── schema.sql    # PostgreSQL + PostGIS schema
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

| Method | Path            | Description                         |
| ------ | --------------- | ----------------------------------- |
| POST   | `/api/login`    | Staff login                         |
| GET    | `/api/vehicles` | List vehicles with latest positions |
| GET    | `/api/vehicles/:vehicleId/history?date=YYYY-MM-DD&tz=America/New_York` | Breadcrumb history (JSON) for one vehicle/day |
| GET    | same + `&format=csv` | Same data as **CSV** download (Excel-friendly) |
| GET    | `/api/vehicles/utilization?date=YYYY-MM-DD&tz=America/New_York&format=csv` | Daily all-vehicle utilization report CSV (`active_minutes`, `inactive_minutes`, `active_percent`, `first_ping_local`, `last_ping_local`) |
| GET    | `/api/zones`    | List authorized zones               |
| GET    | `/api/alerts`   | List recent alerts                  |
| GET    | `/health`       | Health check                        |

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
curl "http://localhost:3000/api/vehicles/VEHICLE_123/history?date=2026-03-30&tz=America/New_York"
curl -o trail.csv "http://localhost:3000/api/vehicles/VEHICLE_123/history?date=2026-03-30&tz=America/New_York&format=csv"
```

### Screenshot evidence checklist (for reports)

- **History** controls visible in the side panel (Vehicle + Day).
- A breadcrumb line displayed on the map for a selected vehicle/day.
- Optional: console/network panel showing the `GET /api/vehicles/:vehicleId/history` request.

## Roadmap

- [x] Samsara API integration
- [ ] PostgreSQL + PostGIS production setup
- [ ] On-premise deployment (city GIS infrastructure)
- [ ] Authorized zone CRUD for admins

## License

ISC

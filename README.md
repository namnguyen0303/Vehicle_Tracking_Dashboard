# Hollywood Microtransit Monitoring Dashboard

#update

A real-time web-based monitoring system for the City of Hollywood's microtransit fleet. Built for 50–100 vehicles with zone compliance tracking and live alerts.

## Architecture

```
RideCircuit API (future) → Poller → PostgreSQL+PostGIS
                                    ↓
Custom REST API (Express) ←─────────┘
        ↓
WebSocket Server (Node.js)
        ↓
Render (cloud hosting)
        ↓
OpenLayers Dashboard (staff-only)
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
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | PostgreSQL connection             | see `.env.example` |
| `RIDECIRCUIT_POLL_INTERVAL_MS`                           | Polling interval (ms)             | `10000`            |

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

## Project Structure

```
Hollywood-app/
├── public/           # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── src/
│   ├── config/       # Env and DB config
│   ├── models/       # Vehicle, zone, alert models
│   ├── routes/       # REST API routes
│   ├── services/     # RideCircuit poller (simulated)
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

## Roadmap

- [ ] RideCircuit API integration (when key is available)
- [ ] PostgreSQL + PostGIS production setup
- [ ] Deploy to Render
- [ ] Authorized zone CRUD for admins

## License

ISC

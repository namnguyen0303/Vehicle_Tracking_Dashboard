# Hollywood Microtransit Monitoring Dashboard

A real-time monitoring dashboard for microtransit vehicle locations, service-zone compliance, and operational alerts.

The application combines a Node.js/Express API, a WebSocket stream for live updates, PostgreSQL/PostGIS storage, and an OpenLayers browser dashboard.

## Features

- Live vehicle positions and status updates from the Samsara API
- Map-based monitoring with service-zone overlays
- Alerts for vehicles leaving authorized zones
- Vehicle position history and CSV export
- Daily vehicle utilization reports
- PostgreSQL/PostGIS persistence with automatic position-history cleanup
- Responsive browser dashboard served by the Node.js application

## Technology

- Node.js and Express
- WebSocket (`ws`)
- PostgreSQL with PostGIS
- OpenLayers and vanilla JavaScript
- `dotenv` for local environment configuration

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer with PostGIS for database-backed operation
- A Samsara API token for live vehicle data

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file from the safe template:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item .env.example .env
   ```

3. For a UI/API smoke test without PostgreSQL, set this in `.env`:

   ```env
   DISABLE_DB=true
   SAMSARA_API_TOKEN=
   ```

   For live operation, configure the Samsara and PostgreSQL variables in `.env`. Never commit `.env` or real credentials.

4. Start the application:

   ```bash
   npm start
   ```

   For development with automatic restarts:

   ```bash
   npm run dev
   ```

5. Open <http://localhost:3001>.

## Environment variables

| Variable                             | Purpose                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `PORT`                               | HTTP server port; defaults to `3001`                      |
| `DISABLE_DB`                         | Set to `true` to skip PostgreSQL access                   |
| `SAMSARA_BASE_URL`                   | Samsara API base URL                                      |
| `SAMSARA_API_TOKEN`                  | Samsara bearer token; keep private                        |
| `SAMSARA_POLL_INTERVAL_MS`           | Vehicle polling interval in milliseconds                  |
| `PGHOST`, `PGPORT`                   | PostgreSQL host and port                                  |
| `PGDATABASE`, `PGUSER`, `PGPASSWORD` | PostgreSQL connection settings; keep the password private |

## API and real-time endpoints

- `GET /health` - application health check
- `POST /api/login` - demo login endpoint
- `GET /api/vehicles` - latest vehicle state
- `GET /api/vehicles/:vehicleId/history` - vehicle position history
- `GET /api/vehicles/utilization` - daily utilization report, with optional CSV output
- `GET /api/zones` - active authorized zones
- `GET /api/alerts` - recent operational alerts
- `WS /ws` - live vehicle and alert updates

## Database setup

The database schema and geometry migration are in [`sql/`](sql/). The application expects PostGIS to be enabled when database-backed operation is used.

Zone import tooling is available in [`scripts/import-zones.js`](scripts/import-zones.js). The source service-zone data is intentionally excluded from this public repository and must be supplied through an approved private deployment process.

## Project structure

```text
public/       Browser dashboard and static assets
scripts/      Operational import tooling
sql/          PostgreSQL/PostGIS schema and migrations
src/          Express server, routes, models, polling, and WebSocket code
.env.example  Safe environment template
```

## Security notes

The current authentication route uses hardcoded demo users and is suitable only for local evaluation. Before any real deployment, replace it with production authentication using hashed passwords, secure sessions or tokens, authorization controls, and secret management.

Do not commit API tokens, database passwords, private keys, service-zone exports, or other operational data. The repository ignore rules are configured to exclude these files, but always review the staged diff before pushing.

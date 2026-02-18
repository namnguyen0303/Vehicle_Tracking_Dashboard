const dotenv = require('dotenv');

dotenv.config();

// Central place to read all environment variables.
// This keeps the rest of the codebase clean and makes it easy
// to see what needs to be configured in Render or locally.

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',

  port: Number(process.env.PORT || 3000),

  // When true, the app will skip all PostgreSQL calls in the poller.
  // Useful while you are still setting up PostgreSQL/PostGIS.
  disableDb: process.env.DISABLE_DB === 'true',

  // PostgreSQL connection (used by pg client)
  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'hollywood_microtransit',
    user: process.env.PGUSER || 'hollywood_user',
    password: process.env.PGPASSWORD || '',
  },

  // Poller configuration – when we later plug in the real RideCircuit API
  rideCircuit: {
    baseUrl: process.env.RIDECIRCUIT_BASE_URL || '',
    apiKey: process.env.RIDECIRCUIT_API_KEY || '',
    pollIntervalMs: Number(process.env.RIDECIRCUIT_POLL_INTERVAL_MS || 10000),
  },
};

module.exports = env;


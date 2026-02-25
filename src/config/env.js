const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',

  port: Number(process.env.PORT || 3000),

  disableDb: process.env.DISABLE_DB === 'true',

  // Samsara API – https://developers.samsara.com/docs/getting-started
  samsara: {
    baseUrl: process.env.SAMSARA_BASE_URL || 'https://api.samsara.com',
    apiToken: (process.env.SAMSARA_API_TOKEN || '').trim(),
    pollIntervalMs: Number(process.env.SAMSARA_POLL_INTERVAL_MS || 10000),
  },

  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'hollywood_microtransit',
    user: process.env.PGUSER || 'hollywood_user',
    password: process.env.PGPASSWORD || '',
  },
};

module.exports = env;

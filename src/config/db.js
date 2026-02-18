const { Pool } = require('pg');
const env = require('./env');

// Simple PostgreSQL connection pool.
// PostGIS is enabled at the database level; from Node we just treat
// geometry columns as regular columns in SQL.

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  max: 10, // enough for this scale (50–100 vehicles, modest staff usage)
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
});

/**
 * Helper to run a query with automatic client checkout / release.
 * Usage:
 *   const result = await db.query('SELECT * FROM vehicles WHERE id = $1', [id]);
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn('Slow query', { text, duration });
  }
  return res;
}

module.exports = {
  pool,
  query,
};


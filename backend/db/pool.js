const { Pool, types } = require('pg');
require('dotenv').config();

// PostgreSQL OID 1082 = DATE. By default node-postgres parses this into a
// JS Date at UTC midnight, which JSON.stringify then renders via
// toISOString() — that can silently shift the calendar date by a day
// depending on the server's timezone. Since work_date is edited and
// round-tripped through the API (admin corrections), keep it as the raw
// 'YYYY-MM-DD' string PostgreSQL already gives us.
types.setTypeParser(1082, (val) => val);

// pg automatically picks up PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
// from process.env, but we pass them explicitly for clarity and so a single
// DATABASE_URL can override everything in hosted environments.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'attendance_fine_db',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(1);
});

module.exports = pool;
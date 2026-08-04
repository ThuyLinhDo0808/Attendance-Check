const pool = require('../db/pool');

/**
 * Fallback values, only used if the settings table is somehow empty
 * (e.g. schema.sql wasn't fully applied). The real source of truth is
 * the CURRENT version row per key in the `settings` table (is_current
 * = TRUE), editable from the admin UI's Settings tab. Every change
 * creates a new version instead of overwriting — see routes/settings.js.
 */
const DEFAULTS = {
  workday_start_time: '08:30',
  block_minutes: '15',
  fine_per_block_vnd: '10000',
};

const ALLOWED_KEYS = Object.keys(DEFAULTS);

// Single-admin, single-process app: a simple module-level cache is enough.
// It's invalidated explicitly whenever PUT /api/settings writes a new
// version, so it never serves stale values across requests.
let cache = null;

async function loadCurrentFromDb() {
  const { rows } = await pool.query('SELECT key, value FROM settings WHERE is_current = TRUE');
  const map = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

/**
 * Returns the settings CURRENTLY in effect, parsed to the types the fine
 * calculator needs.
 */
async function getSettings() {
  if (!cache) {
    cache = await loadCurrentFromDb();
  }
  return {
    workday_start_time: cache.workday_start_time,
    block_minutes: Number(cache.block_minutes),
    fine_per_block_vnd: Number(cache.fine_per_block_vnd),
  };
}

/**
 * Audit/reporting helper: returns the settings that were in effect at a
 * specific point in time (e.g. reconstructing "what was the fine rate 3
 * years ago"). Never touches the cache — this is a point-in-time lookup,
 * not the live config.
 */
async function getSettingsAt(timestamp) {
  const { rows } = await pool.query(
    `SELECT key, value FROM settings
     WHERE effective_start_date <= $1
       AND (effective_end_date IS NULL OR effective_end_date > $1)`,
    [timestamp]
  );
  const map = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    workday_start_time: map.workday_start_time,
    block_minutes: Number(map.block_minutes),
    fine_per_block_vnd: Number(map.fine_per_block_vnd),
  };
}

function invalidate() {
  cache = null;
}

module.exports = { getSettings, getSettingsAt, invalidate, DEFAULTS, ALLOWED_KEYS };

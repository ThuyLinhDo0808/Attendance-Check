const pool = require('../db/pool');

/**
 * Fallback values, only used if the settings table is somehow empty
 * (e.g. schema.sql wasn't fully applied). The real source of truth is
 * the `settings` table, editable from the admin UI's Settings tab.
 */
const DEFAULTS = {
  workday_start_time: '08:30',
  block_minutes: '15',
  fine_per_block_vnd: '5000',
};

const ALLOWED_KEYS = Object.keys(DEFAULTS);

// Single-admin, single-process app: a simple module-level cache is enough.
// It's invalidated explicitly whenever PUT /api/settings writes a change,
// so it never serves stale values across requests.
let cache = null;

async function loadFromDb() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const map = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

/**
 * Returns the current settings, parsed to the types the fine calculator
 * needs: { workday_start_time: string, block_minutes: number, fine_per_block_vnd: number }
 */
async function getSettings() {
  if (!cache) {
    cache = await loadFromDb();
  }
  return {
    workday_start_time: cache.workday_start_time,
    block_minutes: Number(cache.block_minutes),
    fine_per_block_vnd: Number(cache.fine_per_block_vnd),
  };
}

function invalidate() {
  cache = null;
}

module.exports = { getSettings, invalidate, DEFAULTS, ALLOWED_KEYS };

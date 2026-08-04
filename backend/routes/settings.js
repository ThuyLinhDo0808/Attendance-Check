const express = require('express');
const pool = require('../db/pool');
const { invalidate, DEFAULTS, ALLOWED_KEYS } = require('../utils/settingsCache');

const router = express.Router();

function validate(key, value) {
  if (key === 'workday_start_time') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      return 'workday_start_time must be a 24-hour HH:MM value, e.g. 08:30';
    }
  }
  if (key === 'block_minutes') {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      return 'block_minutes must be a positive number';
    }
  }
  if (key === 'fine_per_block_vnd') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return 'fine_per_block_vnd must be zero or a positive number';
    }
  }
  return null;
}

/**
 * GET /api/settings
 * Returns the CURRENT version of every business-rule setting.
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT key, value, description, effective_start_date AS updated_at FROM settings WHERE is_current = TRUE ORDER BY key'
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    const result = ALLOWED_KEYS.map(
      (key) => byKey[key] || { key, value: DEFAULTS[key], description: null, updated_at: null }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/settings/history?key=fine_per_block_vnd
 * Full SCD2 version timeline for one key (or every key if omitted) —
 * this is the audit trail: "what was this rate, and for how long".
 */
router.get('/history', async (req, res, next) => {
  try {
    const { key } = req.query;
    const params = [];
    let whereClause = '';
    if (key) {
      params.push(key);
      whereClause = 'WHERE key = $1';
    }
    const { rows } = await pool.query(
      `SELECT id, key, value, description, effective_start_date, effective_end_date, is_current, created_at
       FROM settings
       ${whereClause}
       ORDER BY key ASC, effective_start_date ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/settings/at?date=YYYY-MM-DD (or a full ISO timestamp)
 * Reconstructs the full settings snapshot that was in effect on a given
 * date — the direct answer to "what was the fine rate 3 years ago".
 */
router.get('/at', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD or ISO timestamp)' });
    }
    const { rows } = await pool.query(
      `SELECT key, value, description, effective_start_date, effective_end_date
       FROM settings
       WHERE effective_start_date <= $1::timestamp
         AND (effective_end_date IS NULL OR effective_end_date > $1::timestamp)
       ORDER BY key`,
      [date]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Body: { workday_start_time?, block_minutes?, fine_per_block_vnd? }
 *
 * SCD2 write: for each key whose value actually changes, the CURRENT
 * row is closed (is_current = FALSE, effective_end_date = NOW()) and a
 * brand new row is inserted as the new current version. Nothing is
 * ever UPDATEd in place — the old rate/value stays queryable forever
 * via GET /api/settings/history. Existing attendance_logs are NOT
 * recalculated; they already stored the fine computed under the rate
 * that applied when they were logged.
 */
router.put('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { rows: currentRows } = await client.query(
      'SELECT key, value, description FROM settings WHERE is_current = TRUE'
    );
    const currentByKey = Object.fromEntries(currentRows.map((r) => [r.key, r]));

    const changes = [];
    for (const key of ALLOWED_KEYS) {
      const raw = req.body[key];
      if (raw === undefined || raw === null || raw === '') continue;
      const value = String(raw).trim();

      const error = validate(key, value);
      if (error) {
        client.release();
        return res.status(400).json({ error });
      }

      const current = currentByKey[key];
      if (current && current.value === value) continue; // no-op: skip creating a pointless version

      changes.push({ key, value, description: current ? current.description : null });
    }

    if (changes.length === 0) {
      client.release();
      return res.status(400).json({ error: 'No changed settings provided.' });
    }

    await client.query('BEGIN');
    for (const change of changes) {
      await client.query(
        'UPDATE settings SET is_current = FALSE, effective_end_date = NOW() WHERE key = $1 AND is_current = TRUE',
        [change.key]
      );
      await client.query(
        `INSERT INTO settings (key, value, description, effective_start_date, effective_end_date, is_current)
         VALUES ($1, $2, $3, NOW(), NULL, TRUE)`,
        [change.key, change.value, change.description]
      );
    }
    await client.query('COMMIT');
    invalidate();

    const { rows } = await pool.query(
      'SELECT key, value, description, effective_start_date AS updated_at FROM settings WHERE is_current = TRUE ORDER BY key'
    );
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;

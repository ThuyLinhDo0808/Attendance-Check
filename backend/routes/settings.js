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
 * Returns all business-rule settings currently in effect.
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT key, value, description, effective_start_date AS updated_at FROM settings WHERE is_current = TRUE ORDER BY key'
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    // Guarantee all known keys are present in the response even if a row
    // is missing for some reason (e.g. partial migration).
    const result = ALLOWED_KEYS.map(
      (key) => byKey[key] || { key, value: DEFAULTS[key], description: null, updated_at: null }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Body: { workday_start_time?, block_minutes?, fine_per_block_vnd? }
 * Updates only the keys provided. Existing attendance_logs are NOT
 * recalculated — they keep the fine that applied when they were saved,
 * by design (see README). Only new logs / edits use the new settings.
 */
router.put('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const updates = [];
    for (const key of ALLOWED_KEYS) {
      const raw = req.body[key];
      if (raw === undefined || raw === null || raw === '') continue;
      const value = String(raw).trim();
      const error = validate(key, value);
      if (error) {
        client.release();
        return res.status(400).json({ error });
      }
      updates.push([key, value]);
    }

    if (updates.length === 0) {
      client.release();
      return res.status(400).json({ error: 'No valid settings provided.' });
    }

    await client.query('BEGIN');
    
    for (const [key, value] of updates) {
      // BƯỚC 1: Tìm bản ghi hiện tại đang active
      const currentRes = await client.query(
        'SELECT value, description FROM settings WHERE key = $1 AND is_current = TRUE',
        [key]
      );
      
      // Nếu giá trị không thay đổi, bỏ qua để tránh rác database
      if (currentRes.rows.length > 0 && currentRes.rows[0].value === value) {
        continue;
      }
      
      const description = currentRes.rows.length > 0 ? currentRes.rows[0].description : null;

      // BƯỚC 2: "Đóng" bản ghi cũ
      await client.query(
        'UPDATE settings SET effective_end_date = NOW(), is_current = FALSE WHERE key = $1 AND is_current = TRUE',
        [key]
      );

      // BƯỚC 3: "Mở" bản ghi mới
      await client.query(
        `INSERT INTO settings (key, value, description, effective_start_date, is_current) 
         VALUES ($1, $2, $3, NOW(), TRUE)`,
        [key, value, description]
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

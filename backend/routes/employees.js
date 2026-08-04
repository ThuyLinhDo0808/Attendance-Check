const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

/**
 * GET /api/employees
 * Lists the CURRENT version of every employee (is_current = TRUE).
 * Optional ?status=ACTIVE|INACTIVE filter.
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, as_of } = req.query;
    const params = [];
    let query;

    if (as_of) {
      params.push(as_of);
      query = `SELECT id, employee_code, name, status, effective_start_date, effective_end_date
                FROM employees
                WHERE effective_start_date <= $1::date
                  AND (effective_end_date IS NULL OR effective_end_date > $1::date)`;
    } else {
      query = `SELECT id, employee_code, name, status, effective_start_date, effective_end_date, created_at
                FROM employees
                WHERE is_current = TRUE`;
    }

    if (status) {
      params.push(status.toUpperCase());
      query += ` AND status = $${params.length}`;
    }
    query += ' ORDER BY name ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/employees/:code/history
 * Full SCD2 version timeline for one employee_code — every department/
 * name/status version they've ever had, in order. This is the audit
 * trail a 3-year-old report reconstructs itself from.
 */
router.get('/:code/history', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_code, name, status, effective_start_date, effective_end_date, is_current, created_at
       FROM employees
       WHERE employee_code = $1
       ORDER BY effective_start_date ASC`,
      [req.params.code]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees
 * Creates a brand-new employee — the FIRST version for a new
 * employee_code. Body: { name, employee_code, status? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, employee_code, status } = req.body;

    if (!name || !employee_code) {
      return res.status(400).json({ error: 'name and employee_code are required' });
    }

    const existing = await pool.query('SELECT 1 FROM employees WHERE employee_code = $1 LIMIT 1', [
      employee_code,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'employee_code already exists' });
    }

    const { rows } = await pool.query(
      `INSERT INTO employees (employee_code, name, status, effective_start_date, is_current)
       VALUES ($1, $2, $3, COALESCE($4, 'ACTIVE'), CURRENT_DATE, TRUE)
       RETURNING id, employee_code, name, status, effective_start_date, effective_end_date, created_at`,
      [employee_code, name, status ? status.toUpperCase() : null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'employee_code already exists' });
    }
    next(err);
  }
});

/**
 * PATCH /api/employees/:code
 * Body: { name?, status?, effective_date? }
 *
 * SCD2 write: this NEVER updates the current row in place. It closes
 * the current version (is_current = FALSE, effective_end_date = the
 * change date) and inserts a brand new version carrying the updated
 * field(s) plus whatever wasn't provided, carried over unchanged. The
 * old version keeps existing in the table forever, so any attendance
 * log already bound to it (see attendance_logs.employee_id) keeps
 * pointing at the department/name that was true when it was logged.
 *
 * If none of the provided fields actually differ from the current
 * version, no new version is created (no-op edits shouldn't spam the
 * history).
 */
router.patch('/:code', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { code } = req.params;
    const { name, status, effective_date } = req.body;

    const { rows: currentRows } = await client.query(
      'SELECT * FROM employees WHERE employee_code = $1 AND is_current = TRUE',
      [code]
    );
    if (currentRows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Employee not found' });
    }
    const current = currentRows[0];

    const nextName = name !== undefined ? name : current.name;
    const nextStatus = status !== undefined ? status.toUpperCase() : current.status;
    const changeDate = effective_date || new Date().toISOString().slice(0, 10);

    const unchanged =
      nextName === current.name &&
      nextStatus === current.status;

    if (unchanged) {
      client.release();
      return res.json(current);
    }

    if (changeDate < current.effective_start_date) {
      client.release();
      return res
        .status(400)
        .json({ error: 'effective_date cannot be earlier than the current version\'s start date' });
    }

    await client.query('BEGIN');
    await client.query(
      'UPDATE employees SET is_current = FALSE, effective_end_date = $1 WHERE id = $2',
      [changeDate, current.id]
    );
    const { rows: newRows } = await client.query(
      `INSERT INTO employees (employee_code, name, status, effective_start_date, effective_end_date, is_current)
       VALUES ($1, $2, $3, $4, NULL, TRUE)
       RETURNING id, employee_code, name, status, effective_start_date, effective_end_date, created_at`,
      [code, nextName, nextStatus, changeDate]
    );
    await client.query('COMMIT');

    res.status(201).json(newRows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

/**
 * GET /api/employees
 * List all employees. Optional ?status=ACTIVE|INACTIVE filter.
 */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let query = 'SELECT id, name, employee_code, status, created_at FROM employees';

    if (status) {
      params.push(status.toUpperCase());
      query += ' WHERE status = $1';
    }
    query += ' ORDER BY name ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/employees
 * Create a new employee. Body: { name, employee_code, status? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, employee_code, status } = req.body;

    if (!name || !employee_code) {
      return res.status(400).json({ error: 'name and employee_code are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO employees (name, employee_code, status)
       VALUES ($1, $2, COALESCE($3, 'ACTIVE'))
       RETURNING id, name, employee_code, status, created_at`,
      [name, employee_code, status ? status.toUpperCase() : null]
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
 * PATCH /api/employees/:id
 * Update an employee's name/status.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    const { rows } = await pool.query(
      `UPDATE employees
       SET name = COALESCE($1, name),
           status = COALESCE($2, status)
       WHERE id = $3
       RETURNING id, name, employee_code, status, created_at`,
      [name || null, status ? status.toUpperCase() : null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

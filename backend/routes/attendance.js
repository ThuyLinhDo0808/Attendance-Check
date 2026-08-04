const express = require('express');
const pool = require('../db/pool');
const { calculateLateness } = require('../utils/fineCalculator');
const { getSettings } = require('../utils/settingsCache');
const { triggerAutoSync } = require('../utils/googleSheetsSync');

const router = express.Router();

/**
 * POST /api/attendance/log
 * Admin manually logs or UPDATES an employee's attendance for a given date.
 * Body: { employee_code, work_date (YYYY-MM-DD), check_in_time (HH:MM[:SS])?,
 *         check_out_time?, note?, is_exempt? }
 *
 * employee_code (the stable SCD2 business key) is required — NOT
 * employee_id. The backend resolves employee_code to whichever employee
 * VERSION is currently active and uses THAT version's numeric id as the
 * FK. That id is only ever set at INSERT time: editing an existing log
 * (the ON CONFLICT branch below) deliberately does NOT touch employee_id,
 * so a later department transfer can never retroactively rewrite which
 * version an already-logged day points to.
 *
 * is_exempt marks a day as exempt from lateness rules entirely (approved
 * leave, business trip, etc.) — check_in_time becomes optional and
 * minutes_late/fine_blocks/total_fine are forced to 0.
 *
 * minutes_late / fine_blocks / total_fine are always (re)computed here —
 * never trusted from the client — so the fine logic lives in exactly one
 * place (utils/fineCalculator.js).
 *
 * Uses an UPSERT on (employee_code, work_date) so re-submitting the same
 * day for the same employee updates the existing row instead of erroring,
 * even if their current employee version has since changed.
 */
router.post('/log', async (req, res, next) => {
  try {
    const { employee_code, work_date, check_in_time, check_out_time, note, is_exempt } = req.body;

    if (!employee_code || !work_date) {
      return res.status(400).json({ error: 'employee_code and work_date are required' });
    }
    if (!is_exempt && !check_in_time) {
      return res.status(400).json({ error: 'check_in_time is required unless is_exempt is true' });
    }

    const empCheck = await pool.query(
      'SELECT id FROM employees WHERE employee_code = $1 AND is_current = TRUE',
      [employee_code]
    );
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employeeId = empCheck.rows[0].id;

    let minutes_late = 0;
    let fine_blocks = 0;
    let total_fine = 0;

    if (!is_exempt && check_in_time) {
      const settings = await getSettings();
      const computed = calculateLateness(check_in_time, settings);
      minutes_late = computed.minutes_late;
      fine_blocks = computed.fine_blocks;
      total_fine = computed.total_fine;
    }

    // NOTE: employee_id is intentionally absent from the DO UPDATE SET
    // list below — on conflict (i.e. editing an existing log), it keeps
    // whatever version it was originally bound to at INSERT time.
    const { rows } = await pool.query(
      `INSERT INTO attendance_logs
         (employee_id, employee_code, work_date, check_in_time, check_out_time,
          minutes_late, fine_blocks, total_fine, is_exempt, note, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (employee_code, work_date)
       DO UPDATE SET
         check_in_time = EXCLUDED.check_in_time,
         check_out_time = EXCLUDED.check_out_time,
         minutes_late = EXCLUDED.minutes_late,
         fine_blocks = EXCLUDED.fine_blocks,
         total_fine = EXCLUDED.total_fine,
         is_exempt = EXCLUDED.is_exempt,
         note = EXCLUDED.note,
         updated_at = NOW()
       RETURNING *`,
      [
        employeeId,
        employee_code,
        work_date,
        check_in_time || null,
        check_out_time || null,
        minutes_late,
        fine_blocks,
        total_fine,
        is_exempt || false,
        note || null,
      ]
    );

    const saved = rows[0];
    triggerAutoSync(work_date.slice(0, 7)); // fire-and-forget: push this month to Google Sheets
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance
 * List attendance logs. Optional filters: ?employee_code=&month=YYYY-MM
 * &date=YYYY-MM-DD&late_only=true
 */
router.get('/', async (req, res, next) => {
  try {
    const { employee_code, month, date, late_only } = req.query;
    const conditions = [];
    const params = [];

    if (employee_code) {
      params.push(employee_code);
      conditions.push(`al.employee_code = $${params.length}`);
    }
    if (month) {
      params.push(`${month}-01`);
      conditions.push(`date_trunc('month', al.work_date) = date_trunc('month', $${params.length}::date)`);
    }
    if (date) {
      params.push(date);
      conditions.push(`al.work_date = $${params.length}::date`);
    }
    if (late_only === 'true') {
      conditions.push(`al.minutes_late > 0`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT al.*, e.name AS employee_name
       FROM attendance_logs al
       JOIN employees e ON e.id = al.employee_id
       ${whereClause}
       ORDER BY al.minutes_late DESC, al.work_date DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/attendance/:id
 * Removes a single log entry (e.g. correcting an admin mistake).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM attendance_logs WHERE id = $1 RETURNING id, work_date',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    triggerAutoSync(rows[0].work_date.toString().slice(0, 7));
    res.json({ deleted: true, id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

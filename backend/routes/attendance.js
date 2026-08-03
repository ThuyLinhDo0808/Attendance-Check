const express = require('express');
const pool = require('../db/pool');
const { calculateLateness } = require('../utils/fineCalculator');
const { getSettings } = require('../utils/settingsCache');

const router = express.Router();

/**
 * POST /api/attendance/log
 * Admin manually logs or UPDATES an employee's attendance for a given date.
 * Body: { employee_id, work_date (YYYY-MM-DD), check_in_time (HH:MM[:SS]),
 *         check_out_time?, note? }
 *
 * minutes_late / fine_blocks / total_fine are always (re)computed here from
 * check_in_time — never trusted from the client — so the fine logic lives
 * in exactly one place (utils/fineCalculator.js).
 *
 * Uses an UPSERT on (employee_id, work_date) so re-submitting the same day
 * for the same employee updates the existing row instead of erroring.
 */
router.post('/log', async (req, res, next) => {
  try {
    const { employee_id, work_date, check_in_time, check_out_time, note, is_exempt } = req.body;

    if (!employee_id || !work_date) {
      return res.status(400).json({ error: 'employee_id and work_date are required' });
    }
    
    // Nếu KHÔNG được miễn trừ, thì bắt buộc phải có giờ check-in
    if (!is_exempt && !check_in_time) {
      return res.status(400).json({ error: 'check_in_time is required unless exempted' });
    }

    const empCheck = await pool.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Khởi tạo các giá trị mặc định là 0 (Dùng cho trường hợp Miễn trừ)
    let minutes_late = 0;
    let fine_blocks = 0;
    let total_fine = 0;

    // Chỉ tính phạt nếu KHÔNG được miễn trừ và CÓ nhập giờ check-in
    if (!is_exempt && check_in_time) {
      const settings = await getSettings();
      const computed = calculateLateness(check_in_time, settings);
      minutes_late = computed.minutes_late;
      fine_blocks = computed.fine_blocks;
      total_fine = computed.total_fine;
    }

    const { rows } = await pool.query(
      `INSERT INTO attendance_logs
         (employee_id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note, is_exempt, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (employee_id, work_date)
       DO UPDATE SET
         check_in_time = EXCLUDED.check_in_time,
         check_out_time = EXCLUDED.check_out_time,
         minutes_late = EXCLUDED.minutes_late,
         fine_blocks = EXCLUDED.fine_blocks,
         total_fine = EXCLUDED.total_fine,
         note = EXCLUDED.note,
         is_exempt = EXCLUDED.is_exempt,
         updated_at = NOW()
       RETURNING *`,
      [
        employee_id, 
        work_date, 
        check_in_time || null, 
        check_out_time || null, 
        minutes_late, 
        fine_blocks, 
        total_fine, 
        note || null, 
        is_exempt || false
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendance
 * List attendance logs. Optional filters: ?employee_id=&month=YYYY-MM
 * Used to populate the "late history" modal on the frontend.
 */
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, month, date, late_only } = req.query;
    const conditions = [];
    const params = [];

    if (employee_id) {
      params.push(employee_id);
      conditions.push(`al.employee_id = $${params.length}`);
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
      `SELECT al.*, e.name AS employee_name, e.employee_code
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
      'DELETE FROM attendance_logs WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json({ deleted: true, id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

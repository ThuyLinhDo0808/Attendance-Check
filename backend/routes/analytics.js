const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

/**
 * GET /api/analytics/monthly?month=YYYY-MM
 * Company-wide aggregate stats for one calendar month.
 * Defaults to the current month if ?month is omitted.
 */
router.get('/monthly', async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthDate = `${month}-01`;

    const summaryPromise = pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE minutes_late > 0)           AS total_late_checkins,
         COALESCE(SUM(total_fine), 0)                        AS total_fine_collected,
         COUNT(*)                                             AS total_logs,
         COALESCE(SUM(minutes_late), 0)                      AS total_minutes_late
       FROM attendance_logs
       WHERE date_trunc('month', work_date) = date_trunc('month', $1::date)`,
      [monthDate]
    );

    const leaderboardPromise = pool.query(
      `SELECT
         e.id,
         e.name,
         e.employee_code,
         COUNT(*) FILTER (WHERE al.minutes_late > 0)  AS times_late,
         COALESCE(SUM(al.minutes_late), 0)             AS total_minutes_late,
         COALESCE(SUM(al.fine_blocks), 0)              AS total_fine_blocks,
         COALESCE(SUM(al.total_fine), 0)               AS total_fine
       FROM attendance_logs al
       JOIN employees e ON e.id = al.employee_id
       WHERE date_trunc('month', al.work_date) = date_trunc('month', $1::date)
       GROUP BY e.id, e.name, e.employee_code
       HAVING COUNT(*) FILTER (WHERE al.minutes_late > 0) > 0
       ORDER BY times_late DESC, total_minutes_late DESC`,
      [monthDate]
    );

    const [summaryResult, leaderboardResult] = await Promise.all([
      summaryPromise,
      leaderboardPromise,
    ]);

    res.json({
      month,
      total_late_checkins: Number(summaryResult.rows[0].total_late_checkins),
      total_fine_collected: Number(summaryResult.rows[0].total_fine_collected),
      total_logs: Number(summaryResult.rows[0].total_logs),
      total_minutes_late: Number(summaryResult.rows[0].total_minutes_late),
      leaderboard: leaderboardResult.rows.map((r) => ({
        ...r,
        times_late: Number(r.times_late),
        total_minutes_late: Number(r.total_minutes_late),
        total_fine_blocks: Number(r.total_fine_blocks),
        total_fine: Number(r.total_fine),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/employee/:id
 * Detailed lifetime stats for one employee, plus their full log history
 * (used to populate the "late history" modal in the Employee Fine Sheet).
 * Optional ?month=YYYY-MM narrows both stats and history to one month.
 */
router.get('/employee/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month } = req.query;

    const empResult = await pool.query(
      'SELECT id, name, employee_code, status FROM employees WHERE id = $1',
      [id]
    );
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const params = [id];
    let monthFilter = '';
    if (month) {
      params.push(`${month}-01`);
      monthFilter = `AND date_trunc('month', work_date) = date_trunc('month', $2::date)`;
    }

    const statsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE minutes_late > 0)  AS times_late,
         COALESCE(SUM(minutes_late), 0)              AS total_minutes_late,
         COALESCE(SUM(fine_blocks), 0)                AS total_fine_blocks,
         COALESCE(SUM(total_fine), 0)                 AS total_fine
       FROM attendance_logs
       WHERE employee_id = $1 ${monthFilter}`,
      params
    );

    const historyResult = await pool.query(
      `SELECT id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note
       FROM attendance_logs
       WHERE employee_id = $1 ${monthFilter}
       ORDER BY work_date DESC`,
      params
    );

    const stats = statsResult.rows[0];

    res.json({
      employee: empResult.rows[0],
      stats: {
        times_late: Number(stats.times_late),
        total_minutes_late: Number(stats.total_minutes_late),
        total_fine_blocks: Number(stats.total_fine_blocks),
        total_fine: Number(stats.total_fine),
      },
      history: historyResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/fine-sheet
 * Convenience endpoint powering Tab 3 in one call: every employee with
 * their aggregate lateness/fine totals across all recorded history.
 * Optional ?month=YYYY-MM to scope totals to one month.
 */
router.get('/fine-sheet', async (req, res, next) => {
  try {
    const { month } = req.query;
    const params = [];
    let monthFilter = '';
    if (month) {
      params.push(`${month}-01`);
      monthFilter = `AND date_trunc('month', al.work_date) = date_trunc('month', $1::date)`;
    }

    const { rows } = await pool.query(
      `SELECT
         e.id,
         e.name,
         e.employee_code,
         e.status,
         COUNT(al.id) FILTER (WHERE al.minutes_late > 0)   AS times_late,
         COALESCE(SUM(al.minutes_late), 0)                  AS total_minutes_late,
         COALESCE(SUM(al.fine_blocks), 0)                   AS total_fine_blocks,
         COALESCE(SUM(al.total_fine), 0)                    AS total_fine
       FROM employees e
       LEFT JOIN attendance_logs al
         ON al.employee_id = e.id ${monthFilter}
       GROUP BY e.id, e.name, e.employee_code, e.status
       ORDER BY e.name ASC`,
      params
    );

    res.json(
      rows.map((r) => ({
        ...r,
        times_late: Number(r.times_late),
        total_minutes_late: Number(r.total_minutes_late),
        total_fine_blocks: Number(r.total_fine_blocks),
        total_fine: Number(r.total_fine),
      }))
    );
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/trends?months=6
 * Zero-filled monthly series for the last N months (default 6, max 24),
 * including the current month. Powers the lateness-trend line chart —
 * "did the new regulations reduce lateness" needs a continuous series,
 * not just months that happen to have logs.
 */
router.get('/trends', async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, Number(req.query.months) || 6));

    const { rows } = await pool.query(
      `WITH months AS (
         SELECT to_char(gs, 'YYYY-MM') AS month
         FROM generate_series(
           date_trunc('month', CURRENT_DATE) - ($1 || ' months')::interval,
           date_trunc('month', CURRENT_DATE),
           interval '1 month'
         ) AS gs
       )
       SELECT
         m.month,
         COALESCE(COUNT(al.id) FILTER (WHERE al.minutes_late > 0), 0) AS total_late_checkins,
         COALESCE(SUM(al.minutes_late), 0)                             AS total_minutes_late,
         COALESCE(SUM(al.total_fine), 0)                               AS total_fine_collected,
         COALESCE(COUNT(al.id), 0)                                     AS total_logs
       FROM months m
       LEFT JOIN attendance_logs al
         ON to_char(date_trunc('month', al.work_date), 'YYYY-MM') = m.month
       GROUP BY m.month
       ORDER BY m.month ASC`,
      [months - 1]
    );

    res.json(
      rows.map((r) => ({
        month: r.month,
        total_late_checkins: Number(r.total_late_checkins),
        total_minutes_late: Number(r.total_minutes_late),
        total_fine_collected: Number(r.total_fine_collected),
        total_logs: Number(r.total_logs),
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;

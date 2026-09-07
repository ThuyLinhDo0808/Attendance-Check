/**
 * Shared report queries — reused by routes/export.js, routes/analytics.js,
 * and utils/googleSheetsSync.js so the SQL that defines "what a monthly
 * report contains" lives in exactly one place.
 *
 * All queries join on employee_code (the stable SCD2 business key), not
 * employee_id (a specific historical version) — otherwise a department
 * transfer mid-period would silently split one person's rows into two.
 * Detail rows join via al.employee_id = e.id specifically so that the
 * department/name shown is the one that was true ON THAT DATE (the
 * point-in-time audit guarantee); summary rows join via the CURRENT
 * employee version, since a summary is a present-day rollup.
 */
const pool = require('../db/pool');

const fetchDetailRows = async (month) => {
  const { rows } = await pool.query(
    `SELECT
       e.employee_code,
       e.name AS employee_name,
       al.work_date,
       al.check_in_time,
       al.check_out_time,
       al.minutes_late,
       al.fine_blocks,
       al.total_fine,
       al.is_exempt,
       al.note
     FROM employees e
     JOIN attendance_logs al
       ON al.employee_code = e.employee_code
       AND date_trunc('month', al.work_date) = date_trunc('month', $1::date)
     WHERE e.is_current = TRUE
       AND (e.status = 'ACTIVE' OR (e.status = 'INACTIVE' AND e.effective_start_date >= $1::date))
     ORDER BY e.name ASC, al.work_date ASC`,
    [`${month}-01`]
  );
  return rows;
};

const fetchSummaryRows = async (month) => {
  const { rows } = await pool.query(
    `SELECT
       e.employee_code,
       e.name AS employee_name,
       COUNT(al.id) FILTER (WHERE al.minutes_late > 0) AS times_late,
       COALESCE(SUM(al.minutes_late), 0) AS total_minutes_late,
       COALESCE(SUM(al.fine_blocks), 0) AS total_fine_blocks,
       COALESCE(SUM(al.total_fine), 0) AS total_fine
     FROM employees e
     LEFT JOIN attendance_logs al
       ON al.employee_code = e.employee_code
       AND date_trunc('month', al.work_date) = date_trunc('month', $1::date)
     WHERE e.is_current = TRUE
       AND (e.status = 'ACTIVE' OR (e.status = 'INACTIVE' AND e.effective_start_date >= $1::date))
     GROUP BY e.employee_code, e.name
     ORDER BY e.name ASC`,
    [`${month}-01`]
  );
  return rows;
};

const fetchRangeLateRows = async (startDate, endDate) => {
  const { rows } = await pool.query(
    `SELECT
       e.employee_code,
       e.name AS employee_name,
       al.work_date,
       al.check_in_time,
       al.minutes_late,
       al.total_fine,
       al.note
     FROM employees e
     JOIN attendance_logs al
       ON al.employee_code = e.employee_code
       AND al.work_date >= $1::date AND al.work_date <= $2::date
       AND al.minutes_late > 0
     WHERE e.is_current = TRUE
       AND (e.status = 'ACTIVE' OR (e.status = 'INACTIVE' AND e.effective_start_date >= date_trunc('month', $1::date)))
     ORDER BY al.work_date ASC, e.name ASC`,
    [startDate, endDate]
  );
  return rows;
};

module.exports = { fetchDetailRows, fetchSummaryRows, fetchRangeLateRows };

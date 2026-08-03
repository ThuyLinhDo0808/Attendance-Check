const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');

const router = express.Router();

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function fetchDetailRows(month) {
  const { rows } = await pool.query(
    `SELECT e.employee_code, e.name AS employee_name, al.work_date, al.check_in_time,
            al.check_out_time, al.minutes_late, al.fine_blocks, al.total_fine, al.note
     FROM attendance_logs al
     JOIN employees e ON e.id = al.employee_id
     WHERE date_trunc('month', al.work_date) = date_trunc('month', $1::date)
     ORDER BY e.name ASC, al.work_date ASC`,
    [`${month}-01`]
  );
  return rows;
}

async function fetchSummaryRows(month) {
  const { rows } = await pool.query(
    `SELECT e.employee_code, e.name AS employee_name,
            COUNT(al.id) FILTER (WHERE al.minutes_late > 0) AS times_late,
            COALESCE(SUM(al.minutes_late), 0)                AS total_minutes_late,
            COALESCE(SUM(al.fine_blocks), 0)                 AS total_fine_blocks,
            COALESCE(SUM(al.total_fine), 0)                  AS total_fine
     FROM employees e
     LEFT JOIN attendance_logs al
       ON al.employee_id = e.id
       AND date_trunc('month', al.work_date) = date_trunc('month', $1::date)
     GROUP BY e.id, e.employee_code, e.name
     ORDER BY e.name ASC`,
    [`${month}-01`]
  );
  return rows;
}

/**
 * GET /api/export/monthly?month=YYYY-MM&format=csv|xlsx&report=detail|summary
 *
 * - format=csv (default): a flat, plain-numeric file — one row per
 *   attendance log (report=detail, the default) or one row per employee
 *   totals (report=summary). No thousands separators or currency symbols
 *   in numeric columns, and dates are ISO (YYYY-MM-DD), so the file drops
 *   straight into accounting/ERP imports without reformatting.
 * - format=xlsx: a workbook with both a "Summary" and a "Detail" sheet,
 *   for month-end review/filing.
 */
router.get('/monthly', async (req, res, next) => {
  try {
    const { month } = req.query;
    const format = (req.query.format || 'csv').toLowerCase();
    const report = (req.query.report || 'detail').toLowerCase();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month is required in YYYY-MM format' });
    }

    if (format === 'xlsx') {
      const [detail, summary] = await Promise.all([
        fetchDetailRows(month),
        fetchSummaryRows(month),
      ]);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Attendance & Fine Ledger';
      workbook.created = new Date();

      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Employee Code', key: 'employee_code', width: 14 },
        { header: 'Employee Name', key: 'employee_name', width: 28 },
        { header: 'Times Late', key: 'times_late', width: 12 },
        { header: 'Total Minutes Late', key: 'total_minutes_late', width: 18 },
        { header: 'Total Fine Blocks', key: 'total_fine_blocks', width: 16 },
        { header: 'Total Fine (VND)', key: 'total_fine', width: 16 },
      ];
      summary.forEach((row) =>
        summarySheet.addRow({
          employee_code: row.employee_code,
          employee_name: row.employee_name,
          times_late: Number(row.times_late),
          total_minutes_late: Number(row.total_minutes_late),
          total_fine_blocks: Number(row.total_fine_blocks),
          total_fine: Number(row.total_fine),
        })
      );
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getColumn('total_fine_blocks').numFmt = '0.00';
      summarySheet.getColumn('total_fine').numFmt = '#,##0';

      const detailSheet = workbook.addWorksheet('Detail');
      detailSheet.columns = [
        { header: 'Employee Code', key: 'employee_code', width: 14 },
        { header: 'Employee Name', key: 'employee_name', width: 28 },
        { header: 'Work Date', key: 'work_date', width: 12 },
        { header: 'Check-in', key: 'check_in_time', width: 10 },
        { header: 'Check-out', key: 'check_out_time', width: 10 },
        { header: 'Minutes Late', key: 'minutes_late', width: 12 },
        { header: 'Fine Blocks', key: 'fine_blocks', width: 12 },
        { header: 'Total Fine (VND)', key: 'total_fine', width: 16 },
        { header: 'Note', key: 'note', width: 30 },
      ];
      detail.forEach((row) =>
        detailSheet.addRow({
          employee_code: row.employee_code,
          employee_name: row.employee_name,
          work_date: row.work_date,
          check_in_time: row.check_in_time ? String(row.check_in_time).slice(0, 5) : '',
          check_out_time: row.check_out_time ? String(row.check_out_time).slice(0, 5) : '',
          minutes_late: Number(row.minutes_late),
          fine_blocks: Number(row.fine_blocks),
          total_fine: Number(row.total_fine),
          note: row.note || '',
        })
      );
      detailSheet.getRow(1).font = { bold: true };
      detailSheet.getColumn('fine_blocks').numFmt = '0.00';
      detailSheet.getColumn('total_fine').numFmt = '#,##0';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance-report-${month}.xlsx"`
      );
      await workbook.xlsx.write(res);
      return res.end();
    }

    // CSV
    const lines = [];
    if (report === 'summary') {
      const summary = await fetchSummaryRows(month);
      lines.push(
        ['employee_code', 'employee_name', 'times_late', 'total_minutes_late', 'total_fine_blocks', 'total_fine_vnd'].join(',')
      );
      for (const row of summary) {
        lines.push(
          [
            csvEscape(row.employee_code),
            csvEscape(row.employee_name),
            csvEscape(row.times_late),
            csvEscape(row.total_minutes_late),
            csvEscape(Number(row.total_fine_blocks).toFixed(2)),
            csvEscape(Number(row.total_fine).toFixed(2)),
          ].join(',')
        );
      }
    } else {
      const detail = await fetchDetailRows(month);
      lines.push(
        [
          'employee_code',
          'employee_name',
          'work_date',
          'check_in_time',
          'check_out_time',
          'minutes_late',
          'fine_blocks',
          'total_fine_vnd',
          'note',
        ].join(',')
      );
      for (const row of detail) {
        lines.push(
          [
            csvEscape(row.employee_code),
            csvEscape(row.employee_name),
            csvEscape(row.work_date),
            csvEscape(row.check_in_time ? String(row.check_in_time).slice(0, 5) : ''),
            csvEscape(row.check_out_time ? String(row.check_out_time).slice(0, 5) : ''),
            csvEscape(row.minutes_late),
            csvEscape(Number(row.fine_blocks).toFixed(2)),
            csvEscape(Number(row.total_fine).toFixed(2)),
            csvEscape(row.note || ''),
          ].join(',')
        );
      }
    }

    const csvBody = lines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-report-${month}-${report}.csv"`
    );
    // Leading BOM so Excel opens the UTF-8 file correctly (Vietnamese names).
    res.send('\uFEFF' + csvBody);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

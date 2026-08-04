const express = require('express');
const ExcelJS = require('exceljs');
const { fetchDetailRows, fetchSummaryRows, fetchRangeLateRows } = require('../utils/reportQueries');

const router = express.Router();

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/export/monthly?month=YYYY-MM&format=csv|xlsx&report=detail|summary
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
      const [detail, summary] = await Promise.all([fetchDetailRows(month), fetchSummaryRows(month)]);

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
        { header: 'Exempt', key: 'is_exempt', width: 10 },
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
          is_exempt: row.is_exempt ? 'Yes' : '',
          note: row.note || '',
        })
      );
      detailSheet.getRow(1).font = { bold: true };
      detailSheet.getColumn('fine_blocks').numFmt = '0.00';
      detailSheet.getColumn('total_fine').numFmt = '#,##0';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${month}.xlsx"`);
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
          'employee_code', 'employee_name', 'work_date', 'check_in_time',
          'check_out_time', 'minutes_late', 'fine_blocks', 'total_fine_vnd', 'is_exempt', 'note',
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
            csvEscape(row.is_exempt ? 'Yes' : ''),
            csvEscape(row.note || ''),
          ].join(',')
        );
      }
    }

    const csvBody = lines.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${month}-${report}.csv"`);
    res.send('\uFEFF' + csvBody); // BOM so Excel opens UTF-8 (Vietnamese names) correctly
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/range?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&format=csv|xlsx
 * Late-only detail report over an arbitrary range (e.g. a weekly report).
 */
router.get('/range', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const format = (req.query.format || 'csv').toLowerCase();

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const detail = await fetchRangeLateRows(start_date, end_date);

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Attendance & Fine Ledger';
      const sheet = workbook.addWorksheet('Late Report');
      sheet.columns = [
        { header: 'Date', key: 'work_date', width: 12 },
        { header: 'Employee Code', key: 'employee_code', width: 14 },
        { header: 'Employee Name', key: 'employee_name', width: 25 },
        { header: 'Check-in', key: 'check_in_time', width: 10 },
        { header: 'Minutes Late', key: 'minutes_late', width: 12 },
        { header: 'Total Fine (VND)', key: 'total_fine', width: 16 },
        { header: 'Note', key: 'note', width: 30 },
      ];
      detail.forEach((row) =>
        sheet.addRow({
          work_date: row.work_date,
          employee_code: row.employee_code,
          employee_name: row.employee_name,
          check_in_time: row.check_in_time ? String(row.check_in_time).slice(0, 5) : '',
          minutes_late: Number(row.minutes_late),
          total_fine: Number(row.total_fine),
          note: row.note || '',
        })
      );
      sheet.getRow(1).font = { bold: true };
      sheet.getColumn('total_fine').numFmt = '#,##0';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="late-report-${start_date}-to-${end_date}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    const lines = ['work_date,employee_code,employee_name,check_in_time,minutes_late,total_fine_vnd,note'];
    for (const row of detail) {
      lines.push(
        [
          csvEscape(row.work_date),
          csvEscape(row.employee_code),
          csvEscape(row.employee_name),
          csvEscape(row.check_in_time ? String(row.check_in_time).slice(0, 5) : ''),
          csvEscape(row.minutes_late),
          csvEscape(Number(row.total_fine).toFixed(2)),
          csvEscape(row.note || ''),
        ].join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="late-report-${start_date}-to-${end_date}.csv"`);
    res.send('\uFEFF' + lines.join('\r\n') + '\r\n');
  } catch (err) {
    next(err);
  }
});

module.exports = router;

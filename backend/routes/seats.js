const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// Lấy sơ đồ ghế (Hỗ trợ Time-Travel qua query ?as_of=)
router.get('/', async (req, res, next) => {
  try {
    const { as_of } = req.query;
    let query = '';
    const params = [];

    if (as_of) {
      params.push(as_of);
      query = `
        SELECT sa.seat_id, sa.employee_code, e.name 
        FROM seat_assignments sa
        JOIN employees e ON sa.employee_code = e.employee_code 
          AND e.effective_start_date <= $1::date 
          AND (e.effective_end_date IS NULL OR e.effective_end_date > $1::date)
        WHERE sa.effective_start_date <= $1::date 
          AND (sa.effective_end_date IS NULL OR sa.effective_end_date > $1::date)
          AND sa.employee_code IS NOT NULL
      `;
    } else {
      query = `
        SELECT sa.seat_id, sa.employee_code, e.name 
        FROM seat_assignments sa
        JOIN employees e ON sa.employee_code = e.employee_code AND e.is_current = TRUE
        WHERE sa.is_current = TRUE AND sa.employee_code IS NOT NULL
      `;
    }
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Cập nhật ghế chuẩn SCD2
router.post('/assign', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { seat_id, employee_code } = req.body;
    await client.query('BEGIN');

    // Đóng phiên bản cũ của ghế này
    await client.query(
      `UPDATE seat_assignments SET is_current = FALSE, effective_end_date = CURRENT_DATE 
       WHERE seat_id = $1 AND is_current = TRUE`,
      [seat_id]
    );

    if (employee_code) {
       // Đóng phiên bản ghế cũ của nhân viên này (nếu họ đang ngồi chỗ khác)
       await client.query(
          `UPDATE seat_assignments SET is_current = FALSE, effective_end_date = CURRENT_DATE 
           WHERE employee_code = $1 AND is_current = TRUE`,
          [employee_code]
       );
       
       // Thêm phiên bản mới
       await client.query(
          `INSERT INTO seat_assignments (seat_id, employee_code, effective_start_date, is_current) 
           VALUES ($1, $2, CURRENT_DATE, TRUE)`,
          [seat_id, employee_code]
       );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
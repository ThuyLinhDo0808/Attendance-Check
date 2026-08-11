const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// Lấy toàn bộ sơ đồ ghế đang được gán
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sa.seat_id, sa.employee_code, e.name 
       FROM seat_assignments sa
       JOIN employees e ON sa.employee_code = e.employee_code 
       WHERE e.is_current = TRUE`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Cập nhật vị trí ghế (Gán mới, đổi chỗ, hoặc xóa)
router.post('/assign', async (req, res, next) => {
  const { seat_id, employee_code } = req.body;
  
  try {
    // Nếu employee_code là null -> Có người nghỉ/xóa khỏi ghế
    if (!employee_code) {
      await pool.query('DELETE FROM seat_assignments WHERE seat_id = $1', [seat_id]);
      return res.json({ success: true, message: 'Seat cleared' });
    }

    // Upsert: Cập nhật người ngồi vào ghế (nếu nhân viên này đã có ghế khác, ghế cũ sẽ bị bỏ trống do logic quản lý ở client hoặc trigger DB)
    // Để đơn giản, ta xóa ghế cũ của nhân viên này (nếu có) trước khi gán ghế mới
    await pool.query('DELETE FROM seat_assignments WHERE employee_code = $1', [employee_code]);
    
    await pool.query(
      `INSERT INTO seat_assignments (seat_id, employee_code, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (seat_id) 
       DO UPDATE SET employee_code = EXCLUDED.employee_code, updated_at = NOW()`,
      [seat_id, employee_code]
    );
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
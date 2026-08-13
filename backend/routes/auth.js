const express = require('express');
const pool = require('../db/pool'); // Import kết nối DB của bạn
const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Truy vấn trực tiếp vào bảng employees trong PostgreSQL
    // Lấy thông tin nhân viên đang Active (is_current = TRUE)
    const { rows } = await pool.query(
      'SELECT employee_code, name FROM employees WHERE employee_code = $1 AND is_current = TRUE',
      [username.toUpperCase()]
    );
    
    if (rows.length > 0) {
      // Do schema chưa có cột password, ta tạm thời cho phép đăng nhập nếu đúng mã nhân viên
      // (Sau này bạn có thể ALTER TABLE thêm cột password nếu cần bảo mật hơn)
      res.json({ 
        success: true, 
        data: { 
          employee_code: rows[0].employee_code, 
          name: rows[0].name 
        } 
      });
    } else {
      res.status(401).json({ success: false, message: 'Sai tài khoản hoặc nhân viên không tồn tại' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
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

/**
 * GET /api/attendance/audit/:log_id
 * Xem lịch sử thay đổi (Audit Trail) của một record điểm danh
 */
router.get('/audit/:log_id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM attendance_audits WHERE log_id = $1 ORDER BY changed_at DESC`,
      [req.params.log_id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendance/checkin
 * Endpoint dành cho App Mobile quét mã QR.
 */
router.post('/checkin', async (req, res, next) => {
  try {
    const { employee_code, qr_data } = req.body;

    if (!employee_code) {
      return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên' });
    }

    // 1. Lấy ngày giờ hiện tại
    const now = new Date();
    // Chuyển múi giờ về giờ Việt Nam (hoặc local timezone)
    const work_date = now.toLocaleDateString('en-CA'); // Trả ra định dạng YYYY-MM-DD
    const check_in_time = now.toTimeString().slice(0, 8); // Trả ra định dạng HH:MM:SS

    console.log(`📌 App Check-in - Mã NV: ${employee_code}, Dữ liệu QR: ${qr_data}, Lúc: ${check_in_time}`);

    // 2. Tìm ID nhân viên hiện tại (is_current = TRUE)
    const empCheck = await pool.query(
      'SELECT id FROM employees WHERE employee_code = $1 AND is_current = TRUE',
      [employee_code]
    );
    
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }
    const employeeId = empCheck.rows[0].id;

    // 3. Tính toán tiền phạt tự động bằng hàm có sẵn của bạn
    const settings = await getSettings();
    const computed = calculateLateness(check_in_time, settings);

    // 4. Lưu vào Database (Sử dụng UPSERT để tránh lỗi nếu check-in 2 lần 1 ngày)
    await pool.query(
      `INSERT INTO attendance_logs
         (employee_id, employee_code, work_date, check_in_time,
          minutes_late, fine_blocks, total_fine, is_exempt, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
       ON CONFLICT (employee_code, work_date)
       DO UPDATE SET
         -- Nếu đã check-in rồi mà quét lại, hệ thống sẽ giữ lại giờ đến sớm nhất
         check_in_time = LEAST(attendance_logs.check_in_time, EXCLUDED.check_in_time),
         
         -- Cập nhật lại số tiền phạt dựa trên giờ sớm nhất đó
         minutes_late = CASE WHEN EXCLUDED.check_in_time < attendance_logs.check_in_time THEN EXCLUDED.minutes_late ELSE attendance_logs.minutes_late END,
         fine_blocks = CASE WHEN EXCLUDED.check_in_time < attendance_logs.check_in_time THEN EXCLUDED.fine_blocks ELSE attendance_logs.fine_blocks END,
         total_fine = CASE WHEN EXCLUDED.check_in_time < attendance_logs.check_in_time THEN EXCLUDED.total_fine ELSE attendance_logs.total_fine END,
         
         updated_at = NOW()`
      ,
      [
        employeeId,
        employee_code,
        work_date,
        check_in_time,
        computed.minutes_late,
        computed.fine_blocks,
        computed.total_fine
      ]
    );

    // 5. Tự động đồng bộ lên Google Sheets (giống hệt API POST /log của bạn)
    triggerAutoSync(work_date.slice(0, 7));

    res.json({ success: true, message: 'Check-in thành công và đã lưu DB!' });
  } catch (err) {
    console.error("Lỗi khi check-in:", err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu điểm danh' });
  }
});


/**
 * POST /api/attendance/excuse
 * Endpoint cho AI Agent xử lý đơn xin đi muộn/vắng mặt từ Mobile App
 */
router.post('/excuse', async (req, res, next) => {
  try {
    const { employee_code, reason } = req.body;
    
    if (!employee_code) {
      return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên.' });
    }

    const safeReason = reason || ''; 

    const now = new Date();
    const work_date = now.toLocaleDateString('en-CA');

    // 1. Tìm ID nhân viên
    const empCheck = await pool.query(
      'SELECT id FROM employees WHERE employee_code = $1 AND is_current = TRUE',
      [employee_code]
    );
    
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }
    const employeeId = empCheck.rows[0].id;

    // 2. KIỂM TRA XEM HÔM NAY ĐÃ CHECK-IN CHƯA
    const logCheck = await pool.query(
      'SELECT id FROM attendance_logs WHERE employee_code = $1 AND work_date = $2',
      [employee_code, work_date]
    );
    const hasCheckedIn = logCheck.rows.length > 0;

    // 3. Logic "AI Agent" phân tích từ khóa giả lập
    const lowerReason = safeReason.toLowerCase();
    const isValidExcuse = lowerReason.includes('ngập') || 
                          lowerReason.includes('hỏng xe') || 
                          lowerReason.includes('tai nạn') ||
                          lowerReason.includes('ốm');

    if (isValidExcuse) {
      // 🟢 TRƯỜNG HỢP 1: AI DUYỆT (is_exempt = TRUE)
      // Khi được Miễn trừ, Database cho phép check_in_time bị NULL, nên UPSERT thoải mái.
      await pool.query(
        `INSERT INTO attendance_logs 
           (employee_id, employee_code, work_date, is_exempt, note, updated_at)
         VALUES ($1, $2, $3, TRUE, $4, NOW())
         ON CONFLICT (employee_code, work_date)
         DO UPDATE SET 
           is_exempt = TRUE, 
           note = EXCLUDED.note, 
           updated_at = NOW()`,
        [employeeId, employee_code, work_date, safeReason]
      );

      res.json({ 
        success: true, 
        message: 'Đã phân tích: Lý do hợp lệ. Hệ thống đã tự động cấp quyền Miễn trừ (Exempt) cho ngày hôm nay!' 
      });

    } else {
      // 🔴 TRƯỜNG HỢP 2: AI KHÔNG DUYỆT (is_exempt = FALSE)
      if (hasCheckedIn) {
        // Nếu ĐÃ Check-in: Chỉ cần cập nhật thêm (UPDATE) cột ghi chú vào log hiện tại.
        await pool.query(
          `UPDATE attendance_logs 
           SET note = $1, updated_at = NOW()
           WHERE employee_code = $2 AND work_date = $3`,
          [safeReason, employee_code, work_date]
        );

        res.json({ 
          success: true, 
          message: 'Đã ghi nhận giải trình. Admin sẽ xem xét đối chiếu cùng với giờ Check-in thực tế của bạn.' 
        });
      } else {
        // Nếu CHƯA Check-in: Chặn lại, vì không thể lưu log đi muộn mà không có giờ đến.
        res.json({ 
          success: false, 
          message: 'Lý do chưa đủ điều kiện duyệt tự động. Vui lòng Check-in tại văn phòng trước khi gửi giải trình!' 
        });
      }
    }
  } catch (err) {
    console.error("Lỗi khi xử lý Excuse:", err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xử lý sự cố.' });
  }
});

module.exports = router;

module.exports = router;

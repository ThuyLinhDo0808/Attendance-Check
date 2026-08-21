const express = require('express');
const pool = require('../db/pool');
const { calculateLateness } = require('../utils/fineCalculator');
const { getSettings } = require('../utils/settingsCache');
const { triggerAutoSync } = require('../utils/googleSheetsSync');
const multer = require('multer');
const fs = require('fs');
const { getOrCreateEmployeeFolder, uploadFileToDrive } = require('../utils/googleDriveService');
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 2000 * 1024 * 1024 // Cho phép upload file lên đến 2GB
  }
});

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

    const now = new Date();
    const work_date = now.toLocaleDateString('en-CA');
    const check_in_time = now.toTimeString().slice(0, 8);

    const empCheck = await pool.query(
      'SELECT id FROM employees WHERE employee_code = $1 AND is_current = TRUE',
      [employee_code]
    );
    
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }
    const employeeId = empCheck.rows[0].id;

    const settings = await getSettings();
    const computed = calculateLateness(check_in_time, settings);
    
    const isLate = computed.minutes_late > 0;
    // Lưu lại phút muộn để sau này từ chối đơn thì lôi ra tính, còn tiền phạt tạm thời treo = 0
    const initialMinutesLate = computed.minutes_late; 
    const initialFineBlocks = 0; 
    const initialTotalFine = 0;     
    const initialNote = isLate ? 'Đang đi muộn - Chờ giải trình' : null;

    await pool.query(
      `INSERT INTO attendance_logs
         (employee_id, employee_code, work_date, check_in_time,
          minutes_late, fine_blocks, total_fine, is_exempt, note, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, NOW())
       ON CONFLICT (employee_code, work_date)
       DO UPDATE SET
         check_in_time = LEAST(attendance_logs.check_in_time, EXCLUDED.check_in_time),
         minutes_late = EXCLUDED.minutes_late,
         note = EXCLUDED.note,
         updated_at = NOW()`
      ,
      [
        employeeId,
        employee_code,
        work_date,
        check_in_time,
        initialMinutesLate,
        initialFineBlocks,
        initialTotalFine,
        initialNote
      ]
    );

    triggerAutoSync(work_date.slice(0, 7));
    res.json({ success: true, message: 'Check-in thành công! (Đã ghi nhận giờ đến).' });
  } catch (err) {
    console.error("Lỗi khi check-in:", err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu điểm danh' });
  }
});

router.post('/excuse', async (req, res, next) => {
  try {
    const { employee_code, reason } = req.body;
    
    if (!employee_code) return res.status(400).json({ success: false, message: 'Thiếu mã nhân viên.' });
    const safeReason = reason || ''; 
    const work_date = new Date().toLocaleDateString('en-CA');

    const lowerReason = safeReason.toLowerCase();
    const isUrgent = lowerReason.includes('ngập') || lowerReason.includes('hỏng xe') || lowerReason.includes('tai nạn') || lowerReason.includes('ốm');
    const ai_suggestion = isUrgent ? 'Đề xuất Duyệt (Khẩn cấp)' : 'Cần xem xét';

    await pool.query(
      `INSERT INTO excuse_requests (employee_code, work_date, reason, ai_suggestion, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       ON CONFLICT (employee_code, work_date)
       DO UPDATE SET reason = EXCLUDED.reason, ai_suggestion = EXCLUDED.ai_suggestion, status = 'PENDING', created_at = NOW()`,
      [employee_code, work_date, safeReason, ai_suggestion]
    );

    res.json({ success: true, message: 'Đã gửi giải trình thành công! Đang chờ Admin xét duyệt.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

router.get('/pending-excuses', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT er.*, e.name AS employee_name 
       FROM excuse_requests er
       JOIN employees e ON e.employee_code = er.employee_code AND e.is_current = TRUE
       WHERE er.status = 'PENDING'
       ORDER BY er.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * POST /api/attendance/resolve-excuse
 * Xử lý duyệt hoặc từ chối:
 * - APPROVED: Miễn phạt hoàn toàn (is_exempt = TRUE, phạt = 0).
 * - REJECTED: LÚC NÀY MỚI TÍNH TOÁN VÀ ÁP ĐẶT TIỀN PHẠT DỰA TRÊN GIỜ CHECK-IN THỰC TẾ.
 */
router.post('/resolve-excuse', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { request_id, status } = req.body;
    
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE excuse_requests SET status = $1 WHERE id = $2 RETURNING employee_code, work_date, reason`,
      [status, request_id]
    );

    if (rows.length > 0) {
      const reqData = rows[0];
      
      const empRes = await client.query('SELECT id FROM employees WHERE employee_code = $1 AND is_current = TRUE', [reqData.employee_code]);
      
      if (empRes.rows.length > 0) {
        const employeeId = empRes.rows[0].id;

        if (status === 'APPROVED') {
          // 🟢 DUYỆT: Miễn trừ hoàn toàn, đưa phút muộn và tiền phạt về 0, bật is_exempt = TRUE
          await client.query(
            `UPDATE attendance_logs 
             SET is_exempt = TRUE, 
                 minutes_late = 0,
                 fine_blocks = 0,
                 total_fine = 0,
                 note = $1, 
                 updated_at = NOW()
             WHERE employee_code = $2 AND work_date = $3`,
            [`[Đã duyệt] ${reqData.reason}`, reqData.employee_code, reqData.work_date]
          );
        } else if (status === 'REJECTED') {
          // 🔴 TỪ CHỐI: Lấy số phút muộn đã lưu lúc check-in, tính toán ra tiền phạt chính thức và gập phạt xuống
          const logCheck = await client.query(
            `SELECT check_in_time FROM attendance_logs WHERE employee_code = $1 AND work_date = $2`,
            [reqData.employee_code, reqData.work_date]
          );

          if (logCheck.rows.length > 0 && logCheck.rows[0].check_in_time) {
            const settings = await getSettings();
            const computed = calculateLateness(logCheck.rows[0].check_in_time, settings);

            await client.query(
              `UPDATE attendance_logs 
               SET is_exempt = FALSE, 
                   minutes_late = $1, 
                   fine_blocks = $2, 
                   total_fine = $3, 
                   note = $4, 
                   updated_at = NOW()
               WHERE employee_code = $5 AND work_date = $6`,
              [
                computed.minutes_late, 
                computed.fine_blocks, 
                computed.total_fine, 
                `[Từ chối giải trình] ${reqData.reason}`, 
                reqData.employee_code, 
                reqData.work_date
              ]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} đơn thành công.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xử lý đơn.' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/attendance/upload-evidence
 * Nhận video từ client, đẩy lên Google Drive và lưu ID vào bảng attendance_logs
 */
router.post('/upload-evidence', upload.array('media', 5), async (req, res, next) => {
  try {
    // Nhận mảng log_ids (chứa ID chính xác của từng lần đi muộn) thay vì employee_codes
    const { log_ids } = req.body; 
    const files = req.files;

    if (!files || files.length === 0 || !log_ids) {
      return res.status(400).json({ error: 'Thiếu file hoặc chưa chọn bản ghi.' });
    }

    const parsedIds = JSON.parse(log_ids);
    if (parsedIds.length === 0) return res.status(400).json({ error: 'Chưa chọn bản ghi nào.' });

    const rootFolderId = process.env.DRIVE_FOLDER_ID;
    const uploadedFileIds = [];
    
    // Tải video lên Drive đúng 1 lần duy nhất
    for (const file of files) {
        const fileId = await uploadFileToDrive(file.path, file.originalname, rootFolderId);
        uploadedFileIds.push(fileId);
        fs.unlinkSync(file.path);
    }

    // Lặp qua từng ID sự kiện đi muộn để gán chung ID video vào
    for (const logId of parsedIds) {
        await pool.query(
          `UPDATE attendance_logs 
           SET evidence_files = (COALESCE(evidence_files, '[]'::jsonb) || $1::jsonb), 
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(uploadedFileIds), logId]
        );
    }

    res.json({ success: true, message: 'Đã tải lên và gắn Tag thành công!', fileIds: uploadedFileIds });
  } catch (err) {
    if (req.files) req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    next(err);
  }
});

module.exports = router;

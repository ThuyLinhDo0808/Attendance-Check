const express = require('express');
const pool = require('../db/pool');
const multer = require('multer'); 
const { spawn } = require('child_process'); 
const path = require('path');
const fs = require('fs');
const router = express.Router();

const upload = multer({ dest: 'uploads/temp_blueprints/' });

// GET: Fetch dynamic layout coordinates
router.get('/layout', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT layout_json FROM office_layouts WHERE is_active = TRUE ORDER BY id DESC LIMIT 1'
    );
    res.json(rows[0]?.layout_json || { seats: [], tables: [] });
  } catch (err) {
    next(err);
  }
});

// GET: Fetch seat assignments with Time-Travel support
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

// POST: SCD2 Seat Assignment
router.post('/assign', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { seat_id, employee_code } = req.body;
    await client.query('BEGIN');

    await client.query(
      `UPDATE seat_assignments SET is_current = FALSE, effective_end_date = CURRENT_DATE 
       WHERE seat_id = $1 AND is_current = TRUE`,
      [seat_id]
    );

    if (employee_code) {
       await client.query(
          `UPDATE seat_assignments SET is_current = FALSE, effective_end_date = CURRENT_DATE 
           WHERE employee_code = $1 AND is_current = TRUE`,
          [employee_code]
       );
       
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

// POST: Save new office layout
router.post('/layout', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { layout_json } = req.body;
    await client.query('BEGIN');
    
    // Deactivate old layouts
    await client.query('UPDATE office_layouts SET is_active = FALSE WHERE is_active = TRUE');
    
    // Insert new layout
    await client.query(
      'INSERT INTO office_layouts (layout_json, is_active) VALUES ($1, TRUE)',
      [layout_json]
    );
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Gọi AI model để phân tích ảnh blueprint và trả về tọa độ ghế và bàn
router.post('/analyze-blueprint', upload.single('blueprint'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No blueprint image provided.' });
  }

  const imagePath = path.resolve(req.file.path);
  // Đường dẫn đến file script Python sẽ tạo ở Bước 4
  const pythonScriptPath = path.resolve(__dirname, '../scripts/sam_analyzer.py'); 

  // Khởi tạo process chạy Python
  const pythonProcess = spawn('python', [pythonScriptPath, imagePath]);

  let dataString = '';
  let errorString = '';

  // Nhận dữ liệu từ Python
  pythonProcess.stdout.on('data', (data) => {
    dataString += data.toString();
  });

  // Ghi nhận lỗi từ Python nếu có
  pythonProcess.stderr.on('data', (data) => {
    errorString += data.toString();
  });

  // Khi xử lý xong
  pythonProcess.on('close', (code) => {
    // Xóa file ảnh tạm để tiết kiệm dung lượng
    fs.unlink(imagePath, () => {});

    if (code !== 0) {
      console.error(`Python Error: ${errorString}`);
      return res.status(500).json({ error: 'Vision model processing failed.' });
    }

    try {
      const layoutData = JSON.parse(dataString);
      res.json(layoutData);
    } catch (err) {
      res.status(500).json({ error: 'Invalid coordinate data returned from model.' });
    }
  });
});

module.exports = router;
-- ============================================================
-- Seed data: 5 dummy employees + sample attendance/fine history
-- Dates are generated relative to CURRENT_DATE so the "this
-- month" analytics views always have data to show, regardless
-- of when this script is run.
--
-- Fine math is pre-computed here to match the backend formula:
--   minutes_late = max(0, check_in - 08:30)
--   fine_blocks  = minutes_late / 15.0        (NOT rounded up)
--   total_fine   = fine_blocks * 10000
-- ============================================================

INSERT INTO employees (name, employee_code, status) VALUES
    ('Lê Thành Đạt',    'DATLT7', 'ACTIVE'),
    ('Trần Văn Hiếu',     'HIEUTV4', 'ACTIVE'),
    ('Phạm Thị Thu Hiền',   'PHAMTHITHUHIEN', 'ACTIVE'),
    ('Vũ Thị Phượng',    'PHUONGVT6', 'ACTIVE'),
    ('Phan Thị Thanh Thủy', 'THUYPT', 'ACTIVE'),
    ('Vũ Chiến Thắng',    'THANGVC', 'ACTIVE'),
    ('Đỗ Hoàng Long',     'LONGDH2', 'ACTIVE'),
    ('Trịnh Ngọc Cảnh',   'CANHTN', 'ACTIVE'),
    ('Lữ Hoàng Long',    'LONGLH6', 'ACTIVE'),
    ('Lê Thị Ngọc Anh',    'ANHLTN7', 'ACTIVE'),
    ('Tống Thu Hiền',     'HIENTT17', 'ACTIVE'),
    ('Phạm Thị Thảo Nguyên',   'PTT.NGUYEN', 'ACTIVE'),
    ('Nguyễn Xuân Minh',    'NX.MINH', 'ACTIVE'),
    ('Trần Phúc Mạnh Linh',     'LINHTPM', 'ACTIVE'),
    ('Đỗ Thùy Linh',    'LINHDT15', 'ACTIVE'),
    ('Phạm Xuân Huy',     'HUY.PX', 'ACTIVE'),
    ('Trần Quốc Việt',   'VIETTQ3', 'ACTIVE'),
    ('Nguyễn Hữu Sơn',    'SONNH14', 'ACTIVE'),
    ('Phạm Hoàng Minh',    'MINHPH4', 'ACTIVE'),
    ('Nguyễn Hoàng Phúc',     'PHUCNH7', 'ACTIVE'),
    ('Đặng Việt Khánh',   'DVKHANH', 'ACTIVE'),
    ('Nguyễn Đoàn Dũng',    'DUNGND11', 'ACTIVE'),
    ('Vũ Hữu Sỹ',    'SYVH', 'ACTIVE'),
    ('Bùi Anh Huy',     'HUYBA', 'ACTIVE'),
    ('Trần Văn Mạnh',   'MANHTV1', 'ACTIVE'),
    ('Nguyễn Long Nhật',    'NHATNL', 'ACTIVE'),
    ('Nguyễn Thị Hải Đường',     'HAIDUONG', 'ACTIVE'),
    ('Trần Văn Vượng',    'VUONG.TV', 'ACTIVE'),
    ('Trần Minh Đức',     'DUCTM13', 'ACTIVE'),
    ('Trần Trọng Kỳ',   'TT.KY', 'ACTIVE');

-- Helper note: 08:30:00 is the workday start used throughout.
-- minutes_late / fine_blocks / total_fine below are computed by
-- hand to exactly match backend/utils/fineCalculator.js.

-- -- ---------- Nguyen Van An (EMP001, id=1) : mostly on time ----------
-- INSERT INTO attendance_logs
--     (employee_id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note)
-- VALUES
--     (1, (CURRENT_DATE - INTERVAL '1 day')::date,  '08:28:00', '17:30:00', 0, 0.00, 0.00, NULL),
--     (1, (CURRENT_DATE - INTERVAL '3 day')::date,  '08:35:00', '17:30:00', 5, 0.33, 1666.67, 'Traffic'),
--     (1, (CURRENT_DATE - INTERVAL '7 day')::date,  '08:30:00', '17:31:00', 0, 0.00, 0.00, NULL),
--     (1, (CURRENT_DATE - INTERVAL '10 day')::date, '08:20:00', '17:29:00', 0, 0.00, 0.00, NULL);

-- -- ---------- Tran Thi Bao (EMP002, id=2) : frequently late ----------
-- INSERT INTO attendance_logs
--     (employee_id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note)
-- VALUES
--     (2, (CURRENT_DATE - INTERVAL '1 day')::date,  '08:46:00', '17:30:00', 16, 1.07, 5333.33, 'Bus delay'),
--     (2, (CURRENT_DATE - INTERVAL '2 day')::date,  '08:52:00', '17:35:00', 22, 1.47, 7333.33, NULL),
--     (2, (CURRENT_DATE - INTERVAL '4 day')::date,  '09:05:00', '17:30:00', 35, 2.33, 11666.67, 'Overslept'),
--     (2, (CURRENT_DATE - INTERVAL '6 day')::date,  '08:31:00', '17:30:00', 1, 0.07, 333.33, NULL),
--     (2, (CURRENT_DATE - INTERVAL '9 day')::date,  '08:40:00', '17:30:00', 10, 0.67, 3333.33, NULL);

-- -- ---------- Le Hoang Cuong (EMP003, id=3) : occasional lateness ----------
-- INSERT INTO attendance_logs
--     (employee_id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note)
-- VALUES
--     (3, (CURRENT_DATE - INTERVAL '2 day')::date,  '08:30:00', '17:30:00', 0, 0.00, 0.00, NULL),
--     (3, (CURRENT_DATE - INTERVAL '5 day')::date,  '08:38:00', '17:32:00', 8, 0.53, 2666.67, NULL),
--     (3, (CURRENT_DATE - INTERVAL '12 day')::date, '08:25:00', '17:30:00', 0, 0.00, 0.00, NULL);

-- -- ---------- Pham Thi Dung (EMP004, id=4) : one very late day ----------
-- INSERT INTO attendance_logs
--     (employee_id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note)
-- VALUES
--     (4, (CURRENT_DATE - INTERVAL '1 day')::date,  '09:15:00', '17:40:00', 45, 3.00, 15000.00, 'Medical appointment'),
--     (4, (CURRENT_DATE - INTERVAL '8 day')::date,  '08:29:00', '17:30:00', 0, 0.00, 0.00, NULL),
--     (4, (CURRENT_DATE - INTERVAL '11 day')::date, '08:33:00', '17:30:00', 3, 0.20, 1000.00, NULL);

-- -- ---------- Hoang Van Em (EMP005, id=5, ACTIVE) : older history ----------
-- INSERT INTO attendance_logs
--     (employee_id, work_date, check_in_time, check_out_time, minutes_late, fine_blocks, total_fine, note)
-- VALUES
--     (5, (CURRENT_DATE - INTERVAL '20 day')::date, '08:47:00', '17:30:00', 17, 1.13, 5666.67, 'Last month, before ACTIVE');

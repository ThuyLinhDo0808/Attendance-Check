-- ============================================================
-- Seed data: Danh sách nhân viên
-- ============================================================
TRUNCATE TABLE employees CASCADE;

-- Đặt effective_start_date lùi về quá khứ 400 ngày để hợp lệ hóa các log điểm danh cũ
INSERT INTO employees (employee_code, name, status, effective_start_date, effective_end_date, is_current) VALUES
    ('DATLT7',         'Lê Thành Đạt',           'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('HIEUTV4',        'Trần Văn Hiếu',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('PHAMTHITHUHIEN', 'Phạm Thị Thu Hiền',      'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('PHUONGVT6',      'Vũ Thị Phượng',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('THUYPT',         'Phan Thị Thanh Thủy',    'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('THANGVC',        'Vũ Chiến Thắng',         'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('LONGDH2',        'Đỗ Hoàng Long',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('CANHTN',         'Trịnh Ngọc Cảnh',        'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('LONGLH6',        'Lữ Hoàng Long',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('ANHLTN7',        'Lê Thị Ngọc Anh',        'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('HIENTT17',       'Tống Thu Hiền',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('PTT.NGUYEN',     'Phạm Thị Thảo Nguyên',   'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('NX.MINH',        'Nguyễn Xuân Minh',       'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('LINHTPM',        'Trần Phúc Mạnh Linh',    'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('LINHDT15',       'Đỗ Thùy Linh',           'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('HUY.PX',         'Phạm Xuân Huy',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('VIETTQ3',        'Trần Quốc Việt',         'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('SONNH14',        'Nguyễn Hữu Sơn',         'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('MINHPH4',        'Phạm Hoàng Minh',        'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('PHUCNH7',        'Nguyễn Hoàng Phúc',      'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('DVKHANH',        'Đặng Việt Khánh',        'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('DUNGND11',       'Nguyễn Đoàn Dũng',       'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('SYVH',           'Vũ Hữu Sỹ',              'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('HUYBA',          'Bùi Anh Huy',            'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('MANHTV1',        'Trần Văn Mạnh',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('NHATNL',         'Nguyễn Long Nhật',       'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('HAIDUONG',       'Nguyễn Thị Hải Đường',   'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('VUONG.TV',       'Trần Văn Vượng',         'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('DUCTM13',        'Trần Minh Đức',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE),
    ('TT.KY',          'Trần Trọng Kỳ',          'ACTIVE', CURRENT_DATE - INTERVAL '400 day', NULL, TRUE);


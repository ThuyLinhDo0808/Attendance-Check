-- ============================================================
-- Internal Attendance & Fine Management System
-- PostgreSQL Schema — Slowly Changing Dimension Type 2 (SCD2)
-- ============================================================

-- Xóa các bảng cũ nếu tồn tại để làm sạch DB trước khi tạo mới
DROP TABLE IF EXISTS attendance_audits CASCADE;
DROP TABLE IF EXISTS excuse_requests CASCADE;
DROP TABLE IF EXISTS office_layouts CASCADE;
DROP TABLE IF EXISTS seat_assignments CASCADE;
DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ------------------------------------------------------------
-- Employees (SCD2)[cite: 48]
-- ------------------------------------------------------------
CREATE TABLE employees (
    id                     SERIAL PRIMARY KEY,
    employee_code          VARCHAR(50) NOT NULL,
    name                   VARCHAR(150) NOT NULL,
    status                 VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                               CHECK (status IN ('ACTIVE', 'INACTIVE')),
    effective_start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_end_date     DATE NULL,
    is_current             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_employees_scd2_dates
        CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date),
    CONSTRAINT chk_employees_current_is_open
        CHECK ( (is_current AND effective_end_date IS NULL)
             OR (NOT is_current AND effective_end_date IS NOT NULL) )
);

CREATE UNIQUE INDEX uq_employees_current_code ON employees (employee_code) WHERE is_current;
CREATE INDEX idx_employees_code ON employees (employee_code);

-- ------------------------------------------------------------
-- Attendance logs[cite: 48]
-- ------------------------------------------------------------
CREATE TABLE attendance_logs (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employees(id),
    employee_code   VARCHAR(50) NOT NULL,
    work_date       DATE NOT NULL,
    check_in_time   TIME NULL,
    check_out_time  TIME NULL,
    minutes_late    INT NOT NULL DEFAULT 0,
    fine_blocks     NUMERIC(6, 2) NOT NULL DEFAULT 0,
    total_fine      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_exempt       BOOLEAN NOT NULL DEFAULT FALSE,
    note            TEXT,
    -- Google Drive file ids (or the MANUAL_MARK_NO_FILE / ARCHIVED_OFFLINE
    -- markers) attached as evidence — see routes/attendance.js.
    evidence_files  JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_workdate UNIQUE (employee_code, work_date),
    CONSTRAINT chk_checkin_required_unless_exempt
        CHECK (check_in_time IS NOT NULL OR is_exempt)
);

CREATE INDEX idx_attendance_work_date ON attendance_logs (work_date);
CREATE INDEX idx_attendance_employee_code ON attendance_logs (employee_code);
CREATE INDEX idx_attendance_employee_id ON attendance_logs (employee_id);

-- ------------------------------------------------------------
-- Attendance Audits (Lưu vết lịch sử thay đổi điểm danh)
-- Bảng này ghi lại mọi thay đổi trên bảng attendance_logs
-- ------------------------------------------------------------
CREATE TABLE attendance_audits (
    audit_id        SERIAL PRIMARY KEY,
    log_id          INT NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
    action_type     VARCHAR(10), -- INSERT hoặc UPDATE
    changed_at      TIMESTAMP DEFAULT NOW(),
    check_in_time   TIME,
    is_exempt       BOOLEAN,
    note            TEXT,
    minutes_late    INT,
    total_fine      NUMERIC(10, 2)
);

-- Hàm Trigger tự động chép log thay đổi
CREATE OR REPLACE FUNCTION audit_attendance_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO attendance_audits (log_id, action_type, check_in_time, is_exempt, note, minutes_late, total_fine)
    VALUES (NEW.id, TG_OP, NEW.check_in_time, NEW.is_exempt, NEW.note, NEW.minutes_late, NEW.total_fine);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn Trigger vào bảng attendance_logs
CREATE TRIGGER attendance_audit_trigger
AFTER INSERT OR UPDATE ON attendance_logs
FOR EACH ROW EXECUTE FUNCTION audit_attendance_changes();

-- ------------------------------------------------------------
-- Seat Assignments (SCD2)
-- Office seating map over time
-- ------------------------------------------------------------
CREATE TABLE seat_assignments (
    id                     SERIAL PRIMARY KEY,
    seat_id                VARCHAR(50) NOT NULL,
    employee_code          VARCHAR(50),
    effective_start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_end_date     DATE NULL,
    is_current             BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_seat_assignments_current ON seat_assignments (seat_id) WHERE is_current;

-- ------------------------------------------------------------
-- Office layouts (SCD2) — floor plan drawn in the Map Builder
-- ------------------------------------------------------------
CREATE TABLE office_layouts (
    id                     SERIAL PRIMARY KEY,
    layout_json            JSONB NOT NULL,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    effective_start_date   TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_end_date     TIMESTAMP NULL
);

-- ------------------------------------------------------------
-- Excuse requests submitted from the mobile app
-- ------------------------------------------------------------
CREATE TABLE excuse_requests (
    id              SERIAL PRIMARY KEY,
    employee_code   VARCHAR(50) NOT NULL,
    work_date       DATE NOT NULL,
    reason          TEXT NOT NULL DEFAULT '',
    ai_suggestion   VARCHAR(100),
    status          VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_excuse_employee_workdate UNIQUE (employee_code, work_date)
);

-- ------------------------------------------------------------
-- Settings (SCD2)
-- ------------------------------------------------------------
CREATE TABLE settings (
    id                     SERIAL PRIMARY KEY,
    key                    VARCHAR(50) NOT NULL,
    value                  VARCHAR(50) NOT NULL,
    description            TEXT,
    effective_start_date   TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_end_date     TIMESTAMP NULL,
    is_current             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_settings_scd2_dates
        CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date),
    CONSTRAINT chk_settings_current_is_open
        CHECK ( (is_current AND effective_end_date IS NULL)
             OR (NOT is_current AND effective_end_date IS NOT NULL) )
);

CREATE UNIQUE INDEX uq_settings_current_key ON settings (key) WHERE is_current;
CREATE INDEX idx_settings_key ON settings (key);

-- ------------------------------------------------------------
-- User accounts (login)
-- Keyed by employee_code (stable across SCD2 versions). Not dropped
-- above so re-running this file keeps everyone's passwords. The owner
-- account is created on server start from OWNER_PASSWORD.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_accounts (
    employee_code   VARCHAR(50) PRIMARY KEY,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(10) NOT NULL DEFAULT 'employee'
                        CHECK (role IN ('employee', 'admin', 'owner')),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Khởi tạo dữ liệu cài đặt mặc định[cite: 48]
INSERT INTO settings (key, value, description, effective_start_date, is_current) VALUES
    ('workday_start_time', '08:30', 'Time of day after which a check-in counts as late (24h HH:MM)', NOW(), TRUE),
    ('block_minutes',      '15',    'Size of one lateness block, in minutes', NOW(), TRUE),
    ('fine_per_block_vnd', '10000',  'Cash fine charged per lateness block, in VND', NOW(), TRUE);
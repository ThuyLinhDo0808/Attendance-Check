-- ============================================================
-- Internal Attendance & Fine Management System
-- PostgreSQL Schema
-- ============================================================

DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- ------------------------------------------------------------
-- Employees (Áp dụng SCD Type 2 để lưu lịch sử)
-- ------------------------------------------------------------
CREATE TABLE employees (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    employee_code   VARCHAR(50) NOT NULL, -- Bỏ UNIQUE vì một mã có thể có nhiều dòng lịch sử
    status          VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    
    -- Các cột theo dõi lịch sử (SCD2)
    effective_start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_end_date   TIMESTAMP NULL,
    is_current           BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Attendance logs
-- minutes_late / fine_blocks / total_fine are computed by the
-- backend at write-time (see routes/attendance.js) so that the
-- exact business logic lives in one place and is easy to audit.
-- They are still stored (not generated columns) because the
-- workday start time is adjustable in code and past records
-- should keep the fine that applied on the day they were logged.
-- ------------------------------------------------------------
CREATE TABLE attendance_logs (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date       DATE NOT NULL,
    check_in_time   TIME NOT NULL,
    check_out_time  TIME NULL,
    minutes_late    INT NOT NULL DEFAULT 0,
    fine_blocks     NUMERIC(6, 2) NOT NULL DEFAULT 0,
    total_fine      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    note            TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_workdate UNIQUE (employee_id, work_date)
);

CREATE INDEX idx_attendance_work_date ON attendance_logs (work_date);
CREATE INDEX idx_attendance_employee ON attendance_logs (employee_id);

-- ------------------------------------------------------------
-- Settings
-- Business-rule constants the admin can change from the UI at
-- runtime, instead of editing .env and restarting the server.
-- Stored as text and parsed by the backend (utils/settingsCache.js)
-- since the set of settings may grow without needing new columns.
-- ------------------------------------------------------------
CREATE TABLE settings (
    id              SERIAL PRIMARY KEY, -- Thêm Surrogate Key
    key             VARCHAR(50) NOT NULL,
    value           VARCHAR(50) NOT NULL,
    description     TEXT,
    
    -- Các cột theo dõi lịch sử (SCD2)
    effective_start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_end_date   TIMESTAMP NULL,
    is_current           BOOLEAN NOT NULL DEFAULT TRUE,
    
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value, description) VALUES
    ('workday_start_time', '08:30', 'Time of day after which a check-in counts as late (24h HH:MM)'),
    ('block_minutes',      '15',    'Size of one lateness block, in minutes'),
    ('fine_per_block_vnd', '5000', 'Cash fine charged per lateness block, in VND');

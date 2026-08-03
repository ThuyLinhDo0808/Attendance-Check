-- ============================================================
-- Internal Attendance & Fine Management System
-- PostgreSQL Schema
-- ============================================================

DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- ------------------------------------------------------------
-- Employees
-- ------------------------------------------------------------
CREATE TABLE employees (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    employee_code   VARCHAR(50) UNIQUE NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE')),
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

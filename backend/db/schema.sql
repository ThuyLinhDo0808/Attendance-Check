-- ============================================================
-- Internal Attendance & Fine Management System
-- PostgreSQL Schema — Slowly Changing Dimension Type 2 (SCD2)
--
-- Audit requirement this satisfies: no UPDATE ever overwrites a
-- business-meaning column on employees or settings. A "change" is
-- always modeled as: close the current version (is_current = FALSE,
-- effective_end_date = now) + insert a brand new version
-- (is_current = TRUE, effective_end_date = NULL). Nothing is ever
-- deleted or overwritten, so a report run against "3 years ago" can
-- always reconstruct exactly which department an employee was in,
-- and exactly what the fine rate was, on that date.
-- ============================================================

DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ------------------------------------------------------------
-- Employees (SCD2)
--
-- `id` is a VERSION surrogate key — a new row (new id) is created
-- every time name/department/status changes. `employee_code` is the
-- stable BUSINESS key that stays constant across all versions of the
-- same person; it is intentionally NOT globally unique on this table
-- (it repeats once per historical version) — only one row per code
-- may have is_current = TRUE, enforced by the partial unique index
-- below.
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

-- Exactly one CURRENT version per employee_code at any time.
CREATE UNIQUE INDEX uq_employees_current_code ON employees (employee_code) WHERE is_current;
CREATE INDEX idx_employees_code ON employees (employee_code);

-- ------------------------------------------------------------
-- Attendance logs
--
-- employee_id is bound ONCE, at INSERT time, to whichever employee
-- VERSION was current that day — and is deliberately never rewritten
-- afterwards (see routes/attendance.js). That is what makes a fact
-- table audit-correct under SCD2: the log permanently carries the
-- department/name that was true when the event happened, even if the
-- person is later transferred or renamed.
--
-- employee_code is denormalized here (duplicated from employees) so
-- that "all logs for this person" and the one-log-per-day uniqueness
-- constraint keep working correctly across a version change — a
-- department transfer must not let someone be logged twice on the
-- day it happens, and must not fragment their history across two
-- different employee_id values.
--
-- minutes_late / fine_blocks / total_fine are computed by the backend
-- at write time from the settings that were CURRENT at that moment,
-- then stored (never recalculated from live settings) — so they stay
-- accurate to the policy that was in effect when they were earned,
-- exactly like the employee version binding above.
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
       -- TRUE when the admin marks a day as exempt from lateness rules
       -- (approved leave, business trip, etc). check_in_time is then
       -- optional, and minutes_late/fine_blocks/total_fine stay at 0
       -- regardless of what time (if any) was actually recorded.
    note            TEXT,
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
-- Settings (SCD2)
--
-- Same pattern as employees: `id` is a version surrogate key, `key`
-- is the stable business key (e.g. 'fine_per_block_vnd') and repeats
-- across historical versions. Changing a rate NEVER updates a row in
-- place — it closes the current version and inserts a new one (see
-- routes/settings.js), so "what was the fine rate on 2023-05-01" is
-- always answerable via effective_start_date / effective_end_date.
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

-- Exactly one CURRENT version per settings key at any time.
CREATE UNIQUE INDEX uq_settings_current_key ON settings (key) WHERE is_current;
CREATE INDEX idx_settings_key ON settings (key);

INSERT INTO settings (key, value, description, effective_start_date, is_current) VALUES
    ('workday_start_time', '08:30', 'Time of day after which a check-in counts as late (24h HH:MM)', NOW(), TRUE),
    ('block_minutes',      '15',    'Size of one lateness block, in minutes', NOW(), TRUE),
    ('fine_per_block_vnd', '10000',  'Cash fine charged per lateness block, in VND', NOW(), TRUE);

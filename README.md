# Attendance & Fine Management System

An internal, single-admin web app for logging employee attendance, tracking
lateness, and calculating cash penalties — with late workers surfaced
front-and-center on every screen.

```
attendance-app/
├── backend/     Node.js + Express API, PostgreSQL access
└── frontend/    React + Vite + Tailwind admin dashboard
```

## Business rules — now configured in the database

Workday start time, block size, and the fine rate are **no longer in
`.env`**. They live in the `settings` table (seeded with the same
defaults by `db/schema.sql`) and are editable from the **Settings tab**
in the admin UI — changes take effect immediately, no restart needed.

- **Workday start:** default 08:30 AM.
- **Lateness:** any check-in strictly after the start time.
- **Fine blocks:** `minutes_late / block_minutes` — an *exact* fraction,
  never rounded up.
  - 5 min late (15-min block) → 5/15 = **0.33** blocks
  - 16 min late → 16/15 = **1.07** blocks
- **Fine amount:** `fine_blocks × fine_per_block_vnd`.
  - 5 min late → 0.33 × 5,000 = **1,666.67 VNĐ**

All three values (`minutes_late`, `fine_blocks`, `total_fine`) are always
recomputed **server-side** at log time from the check-in time and the
*current* settings — the client never sends them and past logs are never
retroactively recalculated when settings change later (so historical
fines stay accurate to the policy that was in effect when they were
earned).

## Data visualization

The **Company Analytics** tab includes:

- A **line chart** of late check-ins per month and total fines collected
  per month, over the last 3/6/12 months (zero-filled, so a quiet month
  still shows as a dip rather than a gap) — the chart to check whether a
  new regulation actually reduced lateness.
- A **bar chart** comparing total fine amount across employees for the
  selected month.
- The full "who's late" table described above.

Charts are built with [Recharts](https://recharts.org/) (`frontend`
depends on it — remember to `npm install` after pulling this update).

## Exporting a monthly report

Both the **Company Analytics** and **Employee Fine Sheet** tabs have
Export buttons for the selected month:

- **CSV** — a flat, plain-numeric file (no thousands separators or
  currency symbols, ISO dates) so it drops straight into accounting/ERP
  imports. Company Analytics exports transaction-level detail (one row
  per attendance log); Fine Sheet exports the employee-summary version.
- **Excel (.xlsx)** — a workbook with both a `Summary` sheet (one row per
  employee) and a `Detail` sheet (every log that month), for month-end
  review and filing.

Both are plain links to `GET /api/export/monthly` — the browser handles
the download, no extra JS required. You can also hit the endpoint
directly:

```
GET /api/export/monthly?month=2026-07&format=csv&report=detail   # or report=summary
GET /api/export/monthly?month=2026-07&format=xlsx
```

## Fixing a mistake

You never need to touch the database or restart the app to correct a log:

- **Employee Fine Sheet → click a row → Edit/Delete** next to any date in
  their history. Editing re-submits check-in/check-out through the same
  upsert endpoint, so `minutes_late`/`fine_blocks`/`total_fine` are always
  recalculated server-side — never edited by hand.
- **Attendance Logger → "Late today" panel** has the same Edit/Delete
  actions, for fixing an entry right after you log it.

Both update in place; nothing else needs to reload.

## "Who's late" — where to look

The app was built around surfacing this clearly, not burying it in a report:

- **Attendance Logger tab** — a live "Late today" panel lists every employee
  already logged as late for the selected date (defaults to today), updated
  the moment a new log is saved.
- **Company Analytics tab** — a full table (not just a top-10) of every
  employee with at least one late check-in in the selected month, sorted
  worst-first, with an amber highlight.
- **Employee Fine Sheet tab** — any employee with `times_late > 0` gets a
  highlighted row and an amber dot; clicking any row opens their full
  check-in history with late days highlighted individually.

## Prerequisites

- Node.js 18+
- PostgreSQL 13+ running locally (or a connection string to a hosted instance)

## 1. Database setup

```bash
# Create the database (adjust user/host as needed)
createdb attendance_fine_db
```

```bash
cd backend
cp .env.example .env
# edit .env with your PostgreSQL credentials
npm install
npm run seed     # applies db/schema.sql, then db/seed.sql
```

`npm run seed` creates the `employees` and `attendance_logs` tables and
inserts 5 dummy employees plus a spread of attendance logs (some on-time,
some late by varying amounts) so the analytics screens have real numbers to
show immediately — including data dated "yesterday" and within the last
couple of weeks, so the current month's dashboards aren't empty.

You can re-run `npm run seed` any time to reset to a clean seeded state
(it drops and recreates both tables).

## 2. Start the backend API

```bash
cd backend
npm run dev       # nodemon, auto-restarts on change
# or: npm start
```

The API listens on `http://localhost:4000` by default (`PORT` in `.env`).
Sanity check: `curl http://localhost:4000/api/health`.

## 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite's dev server proxies `/api/*` requests to
`http://localhost:4000`, so no CORS configuration is needed locally (the
backend also has `cors()` enabled for direct calls in other setups).

## 4. Build for production

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
```

Serve `frontend/dist` with any static file host, and point
`VITE_API_BASE_URL` (frontend/.env) at your deployed backend URL before
building if it won't be same-origin.

## API reference

| Method | Path                                   | Purpose |
|--------|-----------------------------------------|---------|
| GET    | `/api/employees`                        | List employees (`?status=ACTIVE`) |
| POST   | `/api/employees`                        | Create an employee |
| POST   | `/api/attendance/log`                   | Log/update one day's attendance (upsert on employee+date) |
| GET    | `/api/attendance`                       | List logs (`?employee_id=`, `?month=YYYY-MM`, `?date=YYYY-MM-DD`, `?late_only=true`) |
| DELETE | `/api/attendance/:id`                   | Remove a log entry |
| GET    | `/api/analytics/monthly?month=YYYY-MM`  | Company-wide totals + full list of late workers that month |
| GET    | `/api/analytics/trends?months=6`        | Zero-filled monthly series for the trend charts |
| GET    | `/api/analytics/employee/:id`           | One employee's totals + full check-in history |
| GET    | `/api/analytics/fine-sheet?month=`      | All employees with aggregate totals (powers Tab 3); omit `month` for all-time |
| GET    | `/api/settings`                         | Current business-rule settings |
| PUT    | `/api/settings`                         | Update one or more settings (body: any of `workday_start_time`, `block_minutes`, `fine_per_block_vnd`) |
| GET    | `/api/export/monthly?month=YYYY-MM`     | Download report (`?format=csv\|xlsx`, `?report=detail\|summary` for CSV) |

## Adjusting the business rule

Open the **Settings** tab in the app and edit the values there — they're
stored in the `settings` table and take effect on the next log or edit,
no restart required. (`backend/.env` no longer holds these — see above.)

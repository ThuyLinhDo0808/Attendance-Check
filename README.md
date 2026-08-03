# Attendance & Fine Management System

An internal, single-admin web app for logging employee attendance, tracking
lateness, and calculating cash penalties — with late workers surfaced
front-and-center on every screen.

```
attendance-app/
├── backend/     Node.js + Express API, PostgreSQL access
└── frontend/    React + Vite + Tailwind admin dashboard
```

## Business rules (implemented in `backend/utils/fineCalculator.js`)

- **Workday start:** 08:30 AM (change `WORKDAY_START_TIME` in `backend/.env`).
- **Lateness:** any check-in strictly after the start time.
- **Fine blocks:** `minutes_late / 15` — an *exact* fraction, never rounded up.
  - 5 min late → 5/15 = **0.33** blocks
  - 16 min late → 16/15 = **1.07** blocks
- **Fine amount:** `fine_blocks × 5,000 VNĐ`.
  - 5 min late → 0.33 × 5,000 = **1,666.67 VNĐ**

All three values (`minutes_late`, `fine_blocks`, `total_fine`) are always
recomputed **server-side** from the submitted check-in time — the client
never sends them — so the business rule lives in exactly one place.

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
createdb -U postgres attendance_fine_db
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
| GET    | `/api/analytics/employee/:id`           | One employee's totals + full check-in history |
| GET    | `/api/analytics/fine-sheet?month=`      | All employees with aggregate totals (powers Tab 3); omit `month` for all-time |

## Adjusting the business rule

Everything is driven by `backend/.env`:

```env
WORKDAY_START_TIME=08:30
BLOCK_MINUTES=15
FINE_PER_BLOCK_VND=5000
```

Change these and restart the backend — new logs will use the new rule.
Existing logs keep the fine that was calculated when they were saved (by
design, so historical fines don't silently change if the policy changes
later).

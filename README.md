# Attendance & Fine Management System

An internal, single-admin web app and mobile companion for logging employee attendance, tracking lateness, calculating cash penalties, and managing excuse requests with AI assistance.

```
attendance-app/
├── backend/     Node.js + Express API, PostgreSQL access
└── frontend/    React + Vite + Tailwind admin dashboard
└── mobile/      Expo React Native mobile app for QR check-in & excuses
```

## Audit-safe history (SCD2)

`employees` and `settings` are both **Slowly Changing Dimension Type 2**
tables: nothing is ever `UPDATE`d in place. A "change" (a department
transfer, a fine-rate increase) closes the current version
(`is_current = FALSE`, `effective_end_date = now`) and inserts a brand new
version (`is_current = TRUE`, `effective_end_date = NULL`). The old row
stays in the table forever.

- **`employees`**: `id` is a per-VERSION surrogate key; `employee_code` is
  the stable business key shared across all of one person's versions.
  Only one row per `employee_code` may have `is_current = TRUE` (enforced
  by a partial unique index).
- **`attendance_logs.employee_id`** is bound **once, at insert time**, to
  whichever employee version was current that day — and is **never**
  rewritten afterwards, even when you edit the log's check-in time later.
  That's what makes a report accurate: a log permanently carries the
  name that was true when the event happened, even if the
  person is later transferred or renamed. `employee_code` is also stored
  directly on each log (denormalized) so "all logs for this person" and
  the one-log-per-day constraint keep working correctly across a version
  change.
- **`settings`**: same pattern — `key` (e.g. `fine_per_block_vnd`) is the
  business key, `id` is a per-version surrogate key. Raising the fine rate
  never touches the old row; it closes it and opens a new one.

**What this gets you:** run a report for 3 years ago, and the system
reconstructs *exactly* which department someone was in and exactly what
the fine rate was, on that date — because that's literally what's stored,
not something recalculated after the fact.

Two audit endpoints make this queryable directly:
- `GET /api/employees/:code/history` — full version timeline for one person.
- `GET /api/settings/history?key=fine_per_block_vnd` — full rate timeline
  (also shown directly in the **Settings** tab).
- `GET /api/settings/at?date=2023-05-01` — reconstructs the exact settings
  snapshot in effect on a given date.

## Business Rules & Excuse Workflow

### 1. Business Rules
- **Workday start:** default 08:30 AM — the current version of the `workday_start_time` setting.
- **Lateness:** any check-in strictly after the start time.
- **Fine blocks:** `minutes_late / block_minutes` — **rounded UP** to the nearest whole block (`Math.ceil`). Any partial block counts as a full block.
  - 1 to 15 min late (15-min block) → **1** block
  - 16 to 30 min late → **2** blocks
- **Fine amount:** `fine_blocks × fine_per_block_vnd`.
  - Default rate is 10,000 VNĐ per block (configurable in Settings).
  - 1 min late (08:31) → 1 block × 10,000 = **10,000 VNĐ**
  - 30 min late (09:00) → 2 blocks × 10,000 = **20,000 VNĐ**
- **Exempt days:** the admin can mark a day `is_exempt` (approved leave,
  business trip) — check-in becomes optional and no fine is charged,
  regardless of what time was recorded.

### 2. AI Excuse & Review Workflow (Mobile + Web)
- **Mobile Submissions**: Employees can submit late arrival or absence excuses directly from their mobile companion app.
- **AI-Powered Analysis**: The backend automatically parses reasons against keyword filters (e.g., heavy rain, broken vehicle, illness) to generate suggestions (`ai_suggestion` like *Đề xuất Duyệt* or *Cần xem xét*) and stores requests in `excuse_requests` under a `PENDING` status.
- **Web Admin "Pending Excuses" Tab**:
  - Dedicated screen for admins to review all pending staff explanations.
  - **Real-time Notification Badge**: The sidebar menu displays a live red badge indicating the exact count of pending requests requiring attention.
  - **Approve (Waive Fine)**: Approving an excuse automatically marks the day as exempt (`is_exempt = TRUE`) and clears cash penalties.
  - **Reject**: Declining an excuse triggers backend calculation against the morning's actual check-in time and officially enforces the fine onto the employee's ledger.

All computed values are recomputed **server-side** at log time from the
settings *current at that moment*, then stored — never recalculated from
live settings later, so historical fines stay accurate to the policy that
was in effect when they were earned.

### 3. Video Evidence & Google Drive Integration

The system suports attaching video or image evidence to late check-in records. To bypass standard Service Account storage quotas, media files are authenticated via OAuth 2.0 and pushed directly to a centralized Google Drive folder:

- **Bulk Tagging Architecture**: Instead of slicing a continuous morning recording into individual clips, admins can click **Upload Video & Tag Names** to upload a single master video. The interface groups missing evidence by date, allowing the admin to tag multiple employees who appear in the footage. The backend links the single Google Drive file ID across all selected attendance logs, drastically reducing upload times and storage overhead.
- **Dynamic Auto-Remaining**: Uoloaded files are automatically reformatted and renamed based on the specific date of the late arrival (e.g., `20-09-2026_12345_1_mov`). This guarantees the remote Drive folder remains perfectly organized and searchable without manual intervention.
- **Manual Evidence Overides**: For days where physical recording was missed but the lateness is acknowledged, admins can flag records as "Manually Confirmed". This skips the file upload requirement while satisfying the missing evidence UI warnings.
- **Console & Progreses Tracking**: To handle large video files natively on the web dashboard, the UI implements a simulated terminal console alongside a real-time progress bar, ensuring the admin always has visibility into the currenet upload state.

## Data visualization

The **Company Analytics** tab includes:

- A **line chart** of late check-ins per month and total fines collected
  per month, over the last 3/6/12 months (zero-filled, so a quiet month
  still shows as a dip rather than a gap).
- A **bar chart** comparing total fine amount across employees for the
  selected month.
- The full "who's late" table, grouped by `employee_code` so a department
  transfer mid-month doesn't fragment one person's stats into two rows.

Charts are built with [Recharts](https://recharts.org/).

## Exporting a report

- **Monthly**: `GET /api/export/monthly?month=YYYY-MM&format=csv|xlsx`
  (`&report=detail|summary` for CSV). Buttons on Company Analytics and
  Employee Fine Sheet.
- **Date range** (e.g. a weekly report): `GET /api/export/range?start_date=&end_date=&format=csv|xlsx`.

CSV is flat and plain-numeric (no thousands separators/currency symbols,
ISO dates) so it drops into accounting/ERP imports without reformatting.
XLSX includes both a `Summary` and a `Detail` sheet. Both include a
`department_at_time`/`department` column, reflecting the SCD2 point-in-time
guarantee described above.

## Google Sheets auto-sync (optional)

Instead of downloading an Excel file every time, the backend can push
report data straight to a Google Sheet automatically after every
attendance log, edit, or delete.

**How it works:** a Google Cloud *service account* (server-to-server
credentials, not a personal login) is granted Editor access to one
spreadsheet. The backend pushes to it directly via the Sheets API — no
OAuth login screen, and it works from `localhost` during development
(only outbound internet access is needed, not a public URL).

**Setup:**
1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or use an existing one) and enable the **Google Sheets API**.
2. Create a **Service Account** (IAM & Admin → Service Accounts), then
   create a JSON key for it and download it.
3. Create a new Google Sheet, then **share it** with the service account's
   email address (looks like `xxx@xxx.iam.gserviceaccount.com`, found in
   the JSON key) — give it **Editor** access.
4. Copy the Sheet ID from its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
5. In `backend/.env`, set:
   ```env
   GOOGLE_SHEET_ID=<the sheet id from step 4>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email from the JSON key>
   GOOGLE_PRIVATE_KEY="<private_key from the JSON key, keep the quotes>"
   ```
   The private key in the JSON file contains `\n` sequences — paste it
   exactly as-is (still one line, still with `\n`, still quoted); the
   backend converts them back to real newlines at startup.
6. Restart the backend. The **Settings tab** will show "Connected" under
   Google Sheets auto-sync, with a link to open the sheet and a manual
   "Sync now" button.

Once configured, every `POST /api/attendance/log` and `DELETE
/api/attendance/:id` automatically re-pushes that month's `Summary` and
`Detail` tabs (a full overwrite, not an append — so edits and deletes are
reflected correctly, and the sheet is always an exact mirror of the
database). If it's not configured, the app works completely normally —
this feature is entirely optional.

## Fixing a mistake

You never need to touch the database or restart the app to correct a log:

- **Employee Fine Sheet → click a row → Edit/Delete** next to any date in
  their history. Editing re-submits check-in/check-out through the same
  upsert endpoint, so `minutes_late`/`fine_blocks`/`total_fine` are always
  recalculated server-side — never edited by hand. The log's `employee_id`
  (its SCD2 version binding) is never touched by an edit, only by a new
  log.
- **Attendance Logger → "Late today" panel** has the same Edit/Delete
  actions, for fixing an entry right after you log it.

## "Who's late" — where to look

- **Attendance Logger tab** — a live "Late today" panel lists every employee
  already logged as late for the selected date, updated the moment a new
  log is saved.
- **Company Analytics tab** — a full table of every employee with at least
  one late check-in in the selected month, sorted worst-first.
- **Employee Fine Sheet tab** — any employee with `times_late > 0` gets a
  highlighted row; clicking opens their full check-in history.

## Mobile App Companion (Expo React Native)

The project includes a companion mobile application designed for employees to interact with the system on the go. 

### Core Mobile Features:
- **QR Code Check-in**: 
  - Employees can open the mobile app and navigate to the **QR Check-in** tab to scan the office QR code.
  - **Anti-Spam Safeguards (`useRef`)**: The scanner utilizes a synchronization reference hook (`useRef`) to instantly lock the camera matrix upon the first successful read. This completely eliminates multi-scan loops or accidental duplicate check-in triggers before the app transitions screens.
- **AI Excuse & Late Reporting**:
  - If an employee checks in late or faces an emergency (e.g., severe weather, traffic accidents, vehicle breakdown), they can use the **Excuse Report** tab to type and submit a explanation.
  - The backend AI parses the text description to assign an automated recommendation status (`ai_suggestion`), routing it straight to the web admin's pending queue for final approval or rejection.

## Prerequisites

- Node.js 18+
- PostgreSQL 13+ running locally (or a connection string to a hosted instance)
- **Expo Go** app installed on your smartphone (iOS/Android)

<br>
<br>

# How to run

## 1. Database setup

```bash
createdb attendance_fine_db
```

```bash
cd backend
cp .env.example .env
# edit .env with your PostgreSQL credentials
npm install
npm run seed     # applies db/schema.sql, then db/seed.sql
```

`npm run seed` creates the schema and inserts 5 employees plus a spread of
attendance logs — including a deliberate demonstration of SCD2: one
employee (EMP002) has two historical versions (a department transfer), and
the fine rate has two historical versions (3,000 → 5,000 VNĐ). Older logs
are priced at whichever rate was in effect on that date, and are bound to
whichever department version was current then — so you can see the audit
behavior working immediately, not just take it on faith.

You can re-run `npm run seed` any time to reset to a clean seeded state
(it drops and recreates all three tables).

## 2. Start the backend API

```bash
cd backend
npm run dev       # nodemon, auto-restarts on change
```

The API listens on `http://localhost:4000` by default. Sanity check:
`curl http://localhost:4000/api/health`.

## 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite's dev server proxies `/api/*` to
`http://localhost:4000`.

## 4. Build for production

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
```
## 5. Running Mobile App (Expo)

- Open a new terminal tab and navigate to your mobile app dirrectory.

- Install mobile dependencies:

```bash
npm install
```

- Configure Local IP:
  + Set `BACKEND_URL` in your mobile app files to your computer's local network IP address:

  ``` bash
  const BACKEND_URL = 'http://YOUR_LOCAL_IP:4000/api';
  ```

- Start the mobile app:

``` bash
  npx expo start
```

- Scan the QR code using the camerea (IOS)/ Expo Go app (Android) on your physical device.

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/employees` | Current version of every employee (`?status=`, `?as_of=YYYY-MM-DD` for a historical org snapshot) |
| GET    | `/api/employees/:code/history` | Full SCD2 version timeline for one employee |
| POST   | `/api/employees` | Create a new employee (first version) |
| PATCH  | `/api/employees/:code` | Versioned update — closes current version, opens a new one (body: `name?`, `department?`, `status?`, `effective_date?`) |
| POST   | `/api/attendance/log` | Log/update one day's attendance (upsert on employee_code + date). Body: `employee_code`, `work_date`, `check_in_time?`, `check_out_time?`, `note?`, `is_exempt?` |
| GET    | `/api/attendance` | List logs (`?employee_code=`, `?month=YYYY-MM`, `?date=YYYY-MM-DD`, `?late_only=true`) |
| DELETE | `/api/attendance/:id` | Remove a log entry |
| POST   | `/api/attendance/checkin` | Mobile QR check-in endpoint JS
| POST   | `/api/attendance/excuse` | Submit mobile excuse report  
| GET     | `/api/attendance/pending-excuses` | Fetch pending excuse requests for admin
| POST    | `/api/attendance/resolve-excuse` | Approve or reject an excuse request
| POST    | `/api/attendance/upload-evidence` | Upload media via OAuth2, dynamically rename by date, and bulk-tag multiple log IDs.
| POST   | `/api/attendance/mark-manual-evidance` | Tag late logs as manually confirmed without requiring an actual file upload
| GET    | `/api/analytics/monthly?month=YYYY-MM` | Company-wide totals + late workers that month |
| GET    | `/api/analytics/trends?months=6` | Zero-filled monthly series for the trend charts |
| GET    | `/api/analytics/employee/:code` | One employee's totals + full check-in history |
| GET    | `/api/analytics/fine-sheet?month=` | All employees with aggregate totals |
| GET    | `/api/analytics/range?start_date=&end_date=` | Late-only detail across an arbitrary date range |
| GET    | `/api/settings` | Current business-rule settings |
| PUT    | `/api/settings` | SCD2 write — closes changed keys' current version, opens new ones |
| GET    | `/api/settings/history?key=` | Full version timeline for one (or all) settings keys |
| GET    | `/api/settings/at?date=` | Settings snapshot in effect on a given date |
| GET    | `/api/export/monthly?month=` | Download report (`?format=csv\|xlsx`, `?report=detail\|summary` for CSV) |
| GET    | `/api/export/range?start_date=&end_date=` | Download a date-range report |
| GET    | `/api/sync/status` | Whether Google Sheets auto-sync is configured |
| POST   | `/api/sync/monthly` | Manually trigger a sync for one month (body: `{ month }`) |

## Adjusting the business rule

Open the **Settings** tab and edit the values there. The change is a new
SCD2 version, not an overwrite — the old rate stays visible in the
"Fine rate history" panel on the same tab.

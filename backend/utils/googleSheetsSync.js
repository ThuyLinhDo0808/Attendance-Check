/**
 * Push-based Google Sheets sync.
 *
 * Design: the backend pushes report data to a Google Sheet using a
 * service account (server-to-server auth — no OAuth login flow, no
 * "connect your Google account" screen, since this is a single-admin
 * internal tool). Sync fires automatically after every attendance
 * log/edit/delete (see routes/attendance.js), so the sheet stays current
 * without anyone downloading and re-uploading an Excel file.
 *
 * This only requires OUTBOUND internet access from the backend to
 * Google's API — it works from localhost during development, unlike a
 * pull-based Apps Script approach (which would need the backend to be
 * publicly reachable).
 *
 * Setup: see README.md "Google Sheets auto-sync" section. Until the
 * required env vars are set, every function here is a harmless no-op —
 * the rest of the app works completely normally without this feature
 * configured.
 */
const { google } = require('googleapis');
const { fetchDetailRows, fetchSummaryRows } = require('./reportQueries');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Private keys from a downloaded JSON key file contain literal "\n"
// sequences once pasted into a single-line .env value — convert them
// back to real newlines, or the JWT signing step fails.
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

function isConfigured() {
  return Boolean(SHEET_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);
}

let sheetsClientPromise = null;
function getSheetsClient() {
  if (!sheetsClientPromise) {
    const auth = new google.auth.JWT({
      email: SERVICE_ACCOUNT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClientPromise = Promise.resolve(google.sheets({ version: 'v4', auth }));
  }
  return sheetsClientPromise;
}

const DETAIL_HEADERS = [
  'Employee Code', 'Employee Name', 'Work Date', 'Check-in',
  'Check-out', 'Minutes Late', 'Fine Blocks', 'Total Fine (VND)', 'Exempt', 'Note',
];
const SUMMARY_HEADERS = [
  'Employee Code', 'Employee Name', 'Times Late',
  'Total Minutes Late', 'Total Fine Blocks', 'Total Fine (VND)',
];

function detailRowToArray(row) {
  return [
    row.employee_code,
    row.employee_name,
    row.work_date,
    row.check_in_time ? String(row.check_in_time).slice(0, 5) : '',
    row.check_out_time ? String(row.check_out_time).slice(0, 5) : '',
    Number(row.minutes_late),
    Number(row.fine_blocks),
    Number(row.total_fine),
    row.is_exempt ? 'Yes' : '',
    row.note || '',
  ];
}

function summaryRowToArray(row) {
  return [
    row.employee_code,
    row.employee_name,
    Number(row.times_late),
    Number(row.total_minutes_late),
    Number(row.total_fine_blocks),
    Number(row.total_fine),
  ];
}

/**
 * Ensures the two tabs ("Summary", "Detail") exist in the target
 * spreadsheet, creating whichever are missing. Google Sheets IDs are
 * per-spreadsheet, so this is safe to call every sync — it's a no-op
 * once both tabs already exist.
 */
async function ensureSheetsExist(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTitles = meta.data.sheets.map((s) => s.properties.title);
  const toCreate = ['Summary', 'Detail'].filter((title) => !existingTitles.includes(title));

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }
}

/**
 * Overwrites the Summary and Detail tabs with the given month's data.
 * A full overwrite (not append) keeps the sheet an exact mirror of the
 * database — safe to re-run any time, and edits/deletes are reflected
 * correctly instead of leaving stale rows behind.
 */
async function syncMonthToSheet(month) {
  if (!isConfigured()) return { skipped: true, reason: 'not configured' };

  const sheets = await getSheetsClient();
  await ensureSheetsExist(sheets);

  const [detail, summary] = await Promise.all([fetchDetailRows(month), fetchSummaryRows(month)]);

  const summaryValues = [
    [`Fine Sheet Summary — ${month}`],
    [`Last synced: ${new Date().toISOString()}`],
    [],
    SUMMARY_HEADERS,
    ...summary.map(summaryRowToArray),
  ];
  const detailValues = [
    [`Attendance Detail — ${month}`],
    [`Last synced: ${new Date().toISOString()}`],
    [],
    DETAIL_HEADERS,
    ...detail.map(detailRowToArray),
  ];

  await Promise.all([
    sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'Summary' }),
    sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'Detail' }),
  ]);
  await Promise.all([
    sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Summary!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: summaryValues },
    }),
    sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Detail!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: detailValues },
    }),
  ]);

  return { skipped: false, month, summaryRows: summary.length, detailRows: detail.length };
}

/**
 * Fire-and-forget wrapper for calling after a log/edit/delete — never
 * throws or blocks the HTTP response on a Sheets API hiccup (network
 * blip, quota, etc). Logs the error server-side instead.
 */
function triggerAutoSync(month) {
  if (!isConfigured()) return;
  syncMonthToSheet(month).catch((err) => {
    console.error(`Google Sheets auto-sync failed for ${month}:`, err.message);
  });
}

module.exports = { isConfigured, syncMonthToSheet, triggerAutoSync };

/**
 * Push-based Google Sheets sync (Monthly Tabs Version).
 */
const { google } = require('googleapis');
const { fetchDetailRows, fetchSummaryRows } = require('./reportQueries');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
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
  'Mã Nhân Viên', 'Họ và Tên', 'Ngày Làm Việc', 'Giờ Vào',
  'Giờ Ra', 'Số Phút Muộn', 'Số Block Phạt', 'Tổng Tiền Phạt (VND)', 'Miễn Trừ', 'Ghi Chú',
];
const SUMMARY_HEADERS = [
  'Mã Nhân Viên', 'Họ và Tên', 'Số Lần Đi Muộn',
  'Tổng Số Phút Muộn', 'Số Block Phạt', 'Tổng Tiền Phạt (VND)',
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
 * Kiểm tra và tạo Tab riêng cho từng tháng (VD: Summary_2026-08)
 */
async function ensureSheetsExist(sheets, month) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingTitles = meta.data.sheets.map((s) => s.properties.title);
  
  const summaryTitle = `Summary_${month}`;
  const detailTitle = `Detail_${month}`;
  
  const toCreate = [summaryTitle, detailTitle].filter((title) => !existingTitles.includes(title));

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }
  
  return { summaryTitle, detailTitle };
}

/**
 * Xóa và cập nhật dữ liệu vào đúng tab của tháng đó.
 */
async function syncMonthToSheet(month) {
  if (!isConfigured()) return { skipped: true, reason: 'not configured' };

  const sheets = await getSheetsClient();
  const { summaryTitle, detailTitle } = await ensureSheetsExist(sheets, month);

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

  // Chỉ clear và update dữ liệu trên tab của tháng hiện tại
  await Promise.all([
    sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: summaryTitle }),
    sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: detailTitle }),
  ]);
  
  await Promise.all([
    sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${summaryTitle}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: summaryValues },
    }),
    sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${detailTitle}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: detailValues },
    }),
  ]);

  return { skipped: false, month, summaryRows: summary.length, detailRows: detail.length };
}

function triggerAutoSync(month) {
  if (!isConfigured()) return;
  syncMonthToSheet(month).catch((err) => {
    console.error(`Google Sheets auto-sync failed for ${month}:`, err.message);
  });
}

module.exports = { isConfigured, syncMonthToSheet, triggerAutoSync };
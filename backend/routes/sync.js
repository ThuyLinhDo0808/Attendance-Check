const express = require('express');
const { isConfigured, syncMonthToSheet } = require('../utils/googleSheetsSync');

const router = express.Router();

/**
 * GET /api/sync/status
 * Whether Google Sheets auto-sync is configured, for the Settings tab
 * to show a connected/not-connected indicator.
 */
router.get('/status', (req, res) => {
  res.json({
    configured: isConfigured(),
    sheetUrl: isConfigured() ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}` : null,
  });
});

/**
 * POST /api/sync/monthly
 * Body: { month: 'YYYY-MM' }
 * Manual "sync now" trigger — the same push that happens automatically
 * after every log/edit/delete, exposed for an explicit button in the UI
 * (e.g. right after configuring the feature, or to force a refresh).
 */
router.post('/monthly', async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(400).json({
        error: 'Google Sheets sync is not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY in backend/.env — see README.',
      });
    }
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month is required in YYYY-MM format' });
    }
    const result = await syncMonthToSheet(month);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

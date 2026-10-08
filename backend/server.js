require('dotenv').config();
const express = require('express');
const cors = require('cors');

const employeesRouter = require('./routes/employees');
const attendanceRouter = require('./routes/attendance');
const analyticsRouter = require('./routes/analytics');
const settingsRouter = require('./routes/settings');
const exportRouter = require('./routes/export');
const syncRouter = require('./routes/sync');
const seatsRouter = require('./routes/seats');
const authRouter = require('./routes/auth');
const { requireAuth, requireRole } = require('./utils/auth');
const { ensureAuthSchema } = require('./db/authSchema');

const app = express();

// Hosted platforms terminate TLS at a proxy in front of the app.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Basic request log — useful for a single-admin internal tool.
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Login is public; everything below needs a valid token.
app.use('/api/auth', authRouter);

// The few endpoints the mobile app calls are open to every signed-in
// employee (the handlers restrict them to the caller's own data). The rest
// of the API is the admin dashboard and needs the admin or owner role.
const EMPLOYEE_ENDPOINTS = [
  ['POST', /^\/api\/attendance\/checkin\/?$/],
  ['POST', /^\/api\/attendance\/excuse\/?$/],
  ['GET', /^\/api\/analytics\/employee\/[^/]+\/?$/],
];

function isEmployeeEndpoint(req) {
  const path = req.originalUrl.split('?')[0];
  return EMPLOYEE_ENDPOINTS.some(([method, pattern]) => req.method === method && pattern.test(path));
}

const requireAdmin = requireRole('admin');
app.use('/api', requireAuth, (req, res, next) =>
  isEmployeeEndpoint(req) ? next() : requireAdmin(req, res, next)
);

app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportRouter);
app.use('/api/sync', syncRouter);
app.use('/api/seats', seatsRouter);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  ensureAuthSchema()
    .catch((err) => console.error('[auth] Could not prepare user_accounts table:', err.message))
    .finally(() => {
      const server = app.listen(PORT, () => {
        console.log(`Attendance & Fine Management API listening on port ${PORT}`);
      });

      // Set timeout để cho phép upload video lớn lên đến 30 phút
      server.timeout = 1800000;
    });
}

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pool = require('./db/pool');
const requestContext = require('./middleware/requestContext');
const securityHeaders = require('./middleware/securityHeaders');
const { notFound, errorHandler } = require('./middleware/errorHandlers');
const { version } = require('./package.json');

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

// Hosted platforms terminate TLS at a proxy in front of the app, so req.ip
// and req.secure reflect the real client. Override the hop count with
// TRUST_PROXY (a hop count, true/false, or a list of proxy addresses).
function parseTrustProxy(value) {
  if (value === undefined || value === '') return 1;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.disable('x-powered-by');

// CORS_ORIGINS is an optional comma-separated allowlist; unset keeps the
// previous allow-all behaviour so local dev and the mobile app still work.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins, exposedHeaders: ['X-Request-Id'] } : { exposedHeaders: ['X-Request-Id'] }));

app.use(requestContext);
app.use(securityHeaders);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

const startedAt = new Date();

app.get('/api/health', async (req, res) => {
  let database = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    database = 'unreachable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    version,
    database,
    uptime_seconds: Math.round(process.uptime()),
    started_at: startedAt.toISOString(),
    time: new Date().toISOString(),
  });
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

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  ensureAuthSchema()
    .catch((err) => console.error('[auth] Could not prepare user_accounts table:', err.message))
    .finally(() => {
      const server = app.listen(PORT, () => {
        console.log(`Attendance & Fine Management API v${version} listening on port ${PORT}`);
      });

      // Set timeout để cho phép upload video lớn lên đến 30 phút
      server.timeout = 1800000;

      // Finish in-flight requests and close the DB pool before exiting, so a
      // redeploy never cuts off a half-written attendance log.
      const shutdown = (signal) => {
        console.log(`${signal} received, shutting down gracefully…`);
        server.close(() => {
          pool.end().finally(() => process.exit(0));
        });
        setTimeout(() => process.exit(1), 10000).unref();
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    });
}

module.exports = app;

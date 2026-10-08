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

const app = express();

app.disable('x-powered-by');
// Behind a hosting proxy (Render, Railway, Nginx) this makes req.ip and
// req.secure reflect the real client.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

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

app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportRouter);
app.use('/api/sync', syncRouter);
app.use('/api/seats', seatsRouter);
app.use('/api/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Attendance & Fine Management API v${version} listening on port ${PORT}`);
});

// Set timeout để cho phép upload video lớn lên đến 30 phút
server.timeout = 1800000;

// Finish in-flight requests and close the DB pool before exiting, so a
// redeploy never cuts off a half-written attendance log.
function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully…`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

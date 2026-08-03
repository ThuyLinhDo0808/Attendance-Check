require('dotenv').config();
const express = require('express');
const cors = require('cors');

const employeesRouter = require('./routes/employees');
const attendanceRouter = require('./routes/attendance');
const analyticsRouter = require('./routes/analytics');
const settingsRouter = require('./routes/settings');
const exportRouter = require('./routes/export');

const app = express();

app.use(cors());
app.use(express.json());

// Basic request log — useful for a single-admin internal tool.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export', exportRouter);

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
app.listen(PORT, () => {
  console.log(`Attendance & Fine Management API listening on port ${PORT}`);
});

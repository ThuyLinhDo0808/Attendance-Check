// Error responses always keep the `error` message the dashboard and mobile
// app already read, and add a stable `code` plus the request id so a
// failure the admin reports can be matched to its log line.

function notFound(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
    request_id: req.id,
  });
}

const PG_ERRORS = {
  '23505': [409, 'CONFLICT', 'A record with these values already exists.'],
  '23503': [409, 'REFERENCE_CONFLICT', 'This record is referenced by other data.'],
  '23502': [400, 'MISSING_FIELD', 'A required field is missing.'],
  '22P02': [400, 'INVALID_INPUT', 'One of the values has an invalid format.'],
  '22007': [400, 'INVALID_INPUT', 'One of the dates or times has an invalid format.'],
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let code = status < 500 && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';

  if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
  } else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code;
    message = `Upload rejected: ${err.message}`;
  } else if (PG_ERRORS[err.code]) {
    [status, code, message] = PG_ERRORS[err.code];
  }

  if (status >= 500) {
    console.error(JSON.stringify({
      time: new Date().toISOString(),
      level: 'error',
      request_id: req.id,
      message: err.message,
      stack: err.stack,
    }));
    // Don't leak internals (SQL, file paths) to clients in production.
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }

  if (res.headersSent) return;
  res.status(status).json({ error: message, code, request_id: req.id });
}

module.exports = { notFound, errorHandler };

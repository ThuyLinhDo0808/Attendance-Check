const crypto = require('crypto');

// Tags every request with an id (reusing an upstream X-Request-Id when a
// proxy already set one) and writes a single structured access-log line
// once the response has finished, including how long it took.
function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = {
      time: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      request_id: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 10) / 10,
    };
    console.log(JSON.stringify(line));
  });

  next();
}

module.exports = requestContext;

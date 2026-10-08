process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db/pool');
const auth = require('../utils/auth');
const app = require('../server');

// Stub the database: each test sets `queryHandler` to answer the SQL it
// expects. The per-request account lookup done by requireAuth is answered
// from `accounts` (employee_code → { role, name }) unless a test overrides it.
let queryHandler = async () => ({ rows: [] });
let accounts = {};
pool.query = (sql, params) => {
  if (/SELECT a\.role, e\.name/.test(sql)) {
    const account = accounts[params[0]];
    return Promise.resolve({ rows: account ? [account] : [] });
  }
  return queryHandler(sql, params);
};

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end().catch(() => {});
});

beforeEach(() => {
  queryHandler = async () => ({ rows: [] });
  accounts = {
    LINHDT15: { role: 'owner', name: null },
    NV001: { role: 'employee', name: 'Nhân viên 1' },
    NV050: { role: 'admin', name: 'Quản trị' },
  };
});

function tokenFor(role, employee_code = role === 'owner' ? auth.OWNER_EMPLOYEE_CODE : 'NV001') {
  return auth.signToken({ employee_code, role, name: 'Test' });
}

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

test('password hashes verify and reject wrong passwords', () => {
  const stored = auth.hashPassword('correct horse');
  assert.match(stored, /^scrypt\$/);
  assert.equal(auth.verifyPassword('correct horse', stored), true);
  assert.equal(auth.verifyPassword('wrong', stored), false);
  assert.equal(auth.verifyPassword('anything', null), false);
  assert.equal(auth.verifyPassword('anything', 'plain-text'), false);
});

test('the owner is LinhDT15 by default', () => {
  assert.equal(auth.OWNER_EMPLOYEE_CODE, 'LINHDT15');
});

test('health check stays public', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.status, 200);
});

test('API rejects requests without a token', async () => {
  for (const [method, path] of [
    ['GET', '/api/employees'],
    ['GET', '/api/settings'],
    ['POST', '/api/attendance/checkin'],
    ['GET', '/api/analytics/employee/NV001'],
    ['GET', '/api/auth/me'],
  ]) {
    const res = await call(method, path);
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test('API rejects a forged token', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ sub: 'LINHDT15', role: 'owner' }, 'not-the-secret');
  const res = await call('GET', '/api/employees', { token: forged });
  assert.equal(res.status, 401);
});

test('employees cannot reach admin endpoints', async () => {
  const token = tokenFor('employee');
  for (const [method, path] of [
    ['GET', '/api/employees'],
    ['PUT', '/api/settings'],
    ['GET', '/api/attendance'],
    ['GET', '/api/analytics/monthly'],
    ['GET', '/api/export/monthly'],
    ['GET', '/api/auth/accounts'],
  ]) {
    const res = await call(method, path, { token });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
});

test('the owner can reach admin endpoints', async () => {
  queryHandler = async () => ({ rows: [] });
  const res = await call('GET', '/api/employees', { token: tokenFor('owner') });
  assert.equal(res.status, 200);
});

test('employees can only read their own stats', async () => {
  const token = tokenFor('employee', 'NV001');
  const other = await call('GET', '/api/analytics/employee/NV002', { token });
  assert.equal(other.status, 403);

  queryHandler = async () => ({ rows: [] });
  const own = await call('GET', '/api/analytics/employee/nv001', { token });
  assert.equal(own.status, 404); // reached the handler; stub DB has no such employee
});

test('employees cannot check in for someone else', async () => {
  const res = await call('POST', '/api/attendance/checkin', {
    token: tokenFor('employee', 'NV001'),
    body: { employee_code: 'NV002', qr_data: 'x' },
  });
  assert.equal(res.status, 403);
});

test('check-in uses the code from the token', async () => {
  const seen = [];
  queryHandler = async (sql, params) => {
    seen.push(params);
    return { rows: [] };
  };
  const res = await call('POST', '/api/attendance/checkin', {
    token: tokenFor('employee', 'NV001'),
    body: { qr_data: 'x' },
  });
  assert.equal(res.status, 404); // stub DB: employee lookup finds nothing
  assert.deepEqual(seen[0], ['NV001']);
});

test('login requires the right password', async () => {
  const password_hash = auth.hashPassword('secret123');
  queryHandler = async () => ({
    rows: [{ employee_code: 'NV010', password_hash, role: 'employee', name: 'Nhân viên' }],
  });

  const bad = await call('POST', '/api/auth/login', { body: { username: 'nv010', password: 'nope' } });
  assert.equal(bad.status, 401);

  const noPassword = await call('POST', '/api/auth/login', { body: { username: 'nv010' } });
  assert.equal(noPassword.status, 400);

  const good = await call('POST', '/api/auth/login', { body: { username: 'nv010', password: 'secret123' } });
  assert.equal(good.status, 200);
  assert.equal(good.body.data.employee_code, 'NV010');
  assert.equal(auth.verifyToken(good.body.token).role, 'employee');
});

test('deactivated employees cannot log in', async () => {
  const password_hash = auth.hashPassword('secret123');
  queryHandler = async () => ({
    rows: [{ employee_code: 'NV011', password_hash, role: 'employee', name: null }],
  });
  const res = await call('POST', '/api/auth/login', { body: { username: 'NV011', password: 'secret123' } });
  assert.equal(res.status, 401);
});

test('owner can log in without an employee record', async () => {
  const password_hash = auth.hashPassword('ownerpass');
  queryHandler = async () => ({
    rows: [{ employee_code: 'LINHDT15', password_hash, role: 'owner', name: null }],
  });
  const res = await call('POST', '/api/auth/login', { body: { username: 'LinhDT15', password: 'ownerpass' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, 'owner');
});

test('repeated failed logins are rate limited', async () => {
  const password_hash = auth.hashPassword('secret123');
  queryHandler = async () => ({
    rows: [{ employee_code: 'NV099', password_hash, role: 'employee', name: 'X' }],
  });
  let last;
  for (let i = 0; i < 11; i++) {
    last = await call('POST', '/api/auth/login', { body: { username: 'NV099', password: 'wrong' } });
  }
  assert.equal(last.status, 429);
});

test('revoked or deactivated accounts lose access immediately', async () => {
  const token = tokenFor('employee', 'NV001');
  delete accounts.NV001;
  const revoked = await call('GET', '/api/analytics/employee/NV001', { token });
  assert.equal(revoked.status, 401);

  accounts.NV001 = { role: 'employee', name: null }; // employee record no longer current
  const deactivated = await call('GET', '/api/analytics/employee/NV001', { token });
  assert.equal(deactivated.status, 401);
});

test('a demoted admin loses admin access immediately', async () => {
  const token = tokenFor('admin', 'NV050');
  accounts.NV050.role = 'employee';
  const res = await call('GET', '/api/employees', { token });
  assert.equal(res.status, 403);
});

test('admins cannot grant roles or touch the owner account', async () => {
  const token = tokenFor('admin', 'NV050');
  const grant = await call('PUT', '/api/auth/accounts/NV001', { token, body: { role: 'admin' } });
  assert.equal(grant.status, 403);
  const owner = await call('PUT', '/api/auth/accounts/LINHDT15', { token, body: { password: 'hijack123' } });
  assert.equal(owner.status, 403);
});

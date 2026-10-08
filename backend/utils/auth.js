const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

/**
 * Authentication helpers: password hashing, JWT issuing/verification and
 * the Express middleware that guards the API.
 *
 * Roles, from most to least privileged:
 *   owner    — the app's owner/developer (OWNER_EMPLOYEE_CODE, default
 *              LINHDT15). Full access to everything, including granting
 *              the admin role.
 *   admin    — can use the whole web dashboard and manage employee
 *              passwords, but cannot create other admins/owners.
 *   employee — mobile app only: check in, submit an excuse, view their
 *              own stats.
 */

const ROLES = ['employee', 'admin', 'owner'];
const ROLE_RANK = { employee: 0, admin: 1, owner: 2 };

const OWNER_EMPLOYEE_CODE = (process.env.OWNER_EMPLOYEE_CODE || 'LINHDT15').toUpperCase();
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '12h';
const MIN_PASSWORD_LENGTH = 6;

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  // Keep the server usable in local dev, but every restart signs everyone out.
  jwtSecret = crypto.randomBytes(48).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[auth] JWT_SECRET is not set — using a random secret. Sessions will not survive a restart.');
  }
}

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  return null;
}

function signToken({ employee_code, role, name }) {
  return jwt.sign({ sub: employee_code, role, name }, jwtSecret, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  const payload = jwt.verify(token, jwtSecret);
  return { employee_code: payload.sub, role: payload.role, name: payload.name };
}

function hasRole(user, minRole) {
  return !!user && ROLE_RANK[user.role] >= ROLE_RANK[minRole];
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function unauthorized(res, message) {
  return res.status(401).json({ success: false, error: message, message });
}

/**
 * Rejects the request with 401 unless it carries a valid Bearer token
 * whose account still exists. The role is re-read from the database so
 * revoking a login, removing the admin role or deactivating an employee
 * takes effect immediately rather than when the token expires.
 */
async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return unauthorized(res, 'Bạn cần đăng nhập.');

  let claims;
  try {
    claims = verifyToken(token);
  } catch {
    return unauthorized(res, 'Phiên đăng nhập đã hết hạn.');
  }

  try {
    const { rows } = await pool.query(
      `SELECT a.role, e.name
         FROM user_accounts a
         LEFT JOIN employees e ON e.employee_code = a.employee_code AND e.is_current = TRUE
        WHERE a.employee_code = $1`,
      [claims.employee_code]
    );
    const account = rows[0];
    if (!account || (account.role !== 'owner' && !account.name)) {
      return unauthorized(res, 'Tài khoản không còn hiệu lực.');
    }
    req.user = { employee_code: claims.employee_code, role: account.role, name: account.name || claims.name };
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Must run after requireAuth. Rejects with 403 below the given role. */
function requireRole(minRole) {
  return (req, res, next) => {
    if (!hasRole(req.user, minRole)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này.', message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    return next();
  };
}

/**
 * Employees may only act on their own employee_code; admins and the owner
 * may act on anyone's. Returns the code the request should use, or null
 * when an employee tried to act for someone else.
 */
function resolveActingCode(user, requestedCode) {
  if (hasRole(user, 'admin')) return requestedCode || user.employee_code || null;
  if (requestedCode && String(requestedCode).toUpperCase() !== String(user.employee_code).toUpperCase()) return null;
  return user.employee_code;
}

/**
 * Small in-memory limiter for login attempts so passwords can't be
 * brute-forced. Keyed by IP + username; resets on a successful login.
 */
function createLoginLimiter({ maxAttempts = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  const keyOf = (req, username) => `${req.ip}|${String(username || '').toUpperCase()}`;

  return {
    isBlocked(req, username) {
      const entry = attempts.get(keyOf(req, username));
      if (!entry) return false;
      if (Date.now() - entry.first > windowMs) {
        attempts.delete(keyOf(req, username));
        return false;
      }
      return entry.count >= maxAttempts;
    },
    fail(req, username) {
      const key = keyOf(req, username);
      const entry = attempts.get(key);
      if (!entry || Date.now() - entry.first > windowMs) {
        attempts.set(key, { count: 1, first: Date.now() });
      } else {
        entry.count += 1;
      }
    },
    reset(req, username) {
      attempts.delete(keyOf(req, username));
    },
  };
}

module.exports = {
  ROLES,
  OWNER_EMPLOYEE_CODE,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
  validatePassword,
  signToken,
  verifyToken,
  hasRole,
  requireAuth,
  requireRole,
  resolveActingCode,
  createLoginLimiter,
};

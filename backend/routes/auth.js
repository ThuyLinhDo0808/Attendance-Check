const express = require('express');
const pool = require('../db/pool');
const {
  OWNER_EMPLOYEE_CODE,
  hashPassword,
  verifyPassword,
  validatePassword,
  signToken,
  hasRole,
  requireAuth,
  requireRole,
  createLoginLimiter,
} = require('../utils/auth');

const router = express.Router();
const loginLimiter = createLoginLimiter();

const INVALID_LOGIN = 'Sai tài khoản hoặc mật khẩu.';

function fail(res, status, message) {
  return res.status(status).json({ success: false, error: message, message });
}

/**
 * POST /api/auth/login
 * Body: { username (employee_code), password }
 * Returns { success, token, data: { employee_code, name, role } }.
 *
 * Employees need an active employee record AND an account (password set
 * by an admin). The owner account works even without an employee record,
 * since the owner is the app's developer rather than necessarily staff.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, 400, 'Vui lòng nhập tài khoản và mật khẩu.');

    const code = String(username).trim().toUpperCase();
    if (loginLimiter.isBlocked(req, code)) {
      return fail(res, 429, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    }

    const { rows } = await pool.query(
      `SELECT a.employee_code, a.password_hash, a.role, e.name
         FROM user_accounts a
         LEFT JOIN employees e ON e.employee_code = a.employee_code AND e.is_current = TRUE
        WHERE a.employee_code = $1`,
      [code]
    );
    const account = rows[0];

    if (!account || !verifyPassword(password, account.password_hash)) {
      loginLimiter.fail(req, code);
      return fail(res, 401, INVALID_LOGIN);
    }
    // Non-owners must still be a current employee (deactivated staff lose access).
    if (account.role !== 'owner' && !account.name) {
      loginLimiter.fail(req, code);
      return fail(res, 401, INVALID_LOGIN);
    }

    loginLimiter.reset(req, code);
    const user = { employee_code: account.employee_code, role: account.role, name: account.name || account.employee_code };
    res.json({ success: true, token: signToken(user), data: user });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

/** GET /api/auth/me — who the current token belongs to. */
router.get('/me', (req, res) => {
  res.json({ success: true, data: req.user });
});

/**
 * POST /api/auth/change-password
 * Body: { current_password, new_password }
 */
router.post('/change-password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    const invalid = validatePassword(new_password);
    if (invalid) return fail(res, 400, invalid);

    const { rows } = await pool.query(
      'SELECT password_hash FROM user_accounts WHERE employee_code = $1',
      [req.user.employee_code]
    );
    if (!rows[0] || !verifyPassword(current_password || '', rows[0].password_hash)) {
      return fail(res, 401, 'Mật khẩu hiện tại không đúng.');
    }

    await pool.query(
      'UPDATE user_accounts SET password_hash = $1, updated_at = NOW() WHERE employee_code = $2',
      [hashPassword(new_password), req.user.employee_code]
    );
    res.json({ success: true, message: 'Đã đổi mật khẩu.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/accounts — admin: which employee codes have an account.
 */
router.get('/accounts', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT employee_code, role, created_at, updated_at FROM user_accounts ORDER BY employee_code'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/auth/accounts/:code
 * Body: { password?, role? }
 * Admin: create an account or reset a password for an employee.
 * Only the owner may grant or remove the admin role, and the owner
 * account itself can only be changed by the owner.
 */
router.put('/accounts/:code', requireRole('admin'), async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const { password, role } = req.body || {};
    const isOwner = hasRole(req.user, 'owner');

    if (code === OWNER_EMPLOYEE_CODE && !isOwner) return fail(res, 403, 'Không thể thay đổi tài khoản chủ sở hữu.');
    if (role !== undefined) {
      if (!['employee', 'admin'].includes(role)) return fail(res, 400, 'Vai trò không hợp lệ.');
      if (!isOwner) return fail(res, 403, 'Chỉ chủ sở hữu mới được phân quyền.');
      if (code === OWNER_EMPLOYEE_CODE) return fail(res, 400, 'Không thể đổi vai trò của chủ sở hữu.');
    }

    const existing = await pool.query('SELECT role FROM user_accounts WHERE employee_code = $1', [code]);
    const current = existing.rows[0];
    // Admins can't reset another admin's password — that would let them take over the account.
    if (current && current.role !== 'employee' && !isOwner && code !== req.user.employee_code) {
      return fail(res, 403, 'Chỉ chủ sở hữu mới được đổi mật khẩu của quản trị viên.');
    }

    if (!current) {
      if (code !== OWNER_EMPLOYEE_CODE) {
        const emp = await pool.query(
          'SELECT 1 FROM employees WHERE employee_code = $1 AND is_current = TRUE',
          [code]
        );
        if (emp.rows.length === 0) return fail(res, 404, 'Không tìm thấy nhân viên.');
      }
      const invalid = validatePassword(password);
      if (invalid) return fail(res, 400, invalid);
      await pool.query(
        'INSERT INTO user_accounts (employee_code, password_hash, role) VALUES ($1, $2, $3)',
        [code, hashPassword(password), code === OWNER_EMPLOYEE_CODE ? 'owner' : role || 'employee']
      );
    } else {
      if (password !== undefined) {
        const invalid = validatePassword(password);
        if (invalid) return fail(res, 400, invalid);
      }
      await pool.query(
        `UPDATE user_accounts
            SET password_hash = COALESCE($2, password_hash),
                role = COALESCE($3, role),
                updated_at = NOW()
          WHERE employee_code = $1`,
        [code, password !== undefined ? hashPassword(password) : null, role || null]
      );
    }

    const { rows } = await pool.query(
      'SELECT employee_code, role, created_at, updated_at FROM user_accounts WHERE employee_code = $1',
      [code]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/auth/accounts/:code — admin: revoke an employee's login. */
router.delete('/accounts/:code', requireRole('admin'), async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    if (code === OWNER_EMPLOYEE_CODE) return fail(res, 400, 'Không thể xoá tài khoản chủ sở hữu.');
    const existing = await pool.query('SELECT role FROM user_accounts WHERE employee_code = $1', [code]);
    if (!existing.rows[0]) return fail(res, 404, 'Tài khoản không tồn tại.');
    if (existing.rows[0].role !== 'employee' && !hasRole(req.user, 'owner')) {
      return fail(res, 403, 'Chỉ chủ sở hữu mới được xoá tài khoản quản trị viên.');
    }
    await pool.query('DELETE FROM user_accounts WHERE employee_code = $1', [code]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

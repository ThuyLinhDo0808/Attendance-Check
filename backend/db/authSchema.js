const pool = require('./pool');
const { hashPassword, OWNER_EMPLOYEE_CODE } = require('../utils/auth');

/**
 * Creates the user_accounts table if it doesn't exist yet (so existing
 * databases pick it up without re-running schema.sql, which drops
 * everything) and makes sure the owner account exists.
 *
 * Accounts are keyed by employee_code rather than employees.id because
 * employees is SCD2: an employee's id changes with every new version,
 * their code never does.
 */
async function ensureAuthSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
        employee_code   VARCHAR(50) PRIMARY KEY,
        password_hash   TEXT NOT NULL,
        role            VARCHAR(10) NOT NULL DEFAULT 'employee'
                            CHECK (role IN ('employee', 'admin', 'owner')),
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query(
    'SELECT role FROM user_accounts WHERE employee_code = $1',
    [OWNER_EMPLOYEE_CODE]
  );

  if (rows.length === 0) {
    const initialPassword = process.env.OWNER_PASSWORD;
    if (!initialPassword) {
      console.warn(
        `[auth] No account for owner ${OWNER_EMPLOYEE_CODE}. Set OWNER_PASSWORD in backend/.env and restart to create it.`
      );
      return;
    }
    await pool.query(
      `INSERT INTO user_accounts (employee_code, password_hash, role) VALUES ($1, $2, 'owner')`,
      [OWNER_EMPLOYEE_CODE, hashPassword(initialPassword)]
    );
    console.log(`[auth] Created owner account ${OWNER_EMPLOYEE_CODE}.`);
  } else if (rows[0].role !== 'owner') {
    await pool.query(
      `UPDATE user_accounts SET role = 'owner', updated_at = NOW() WHERE employee_code = $1`,
      [OWNER_EMPLOYEE_CODE]
    );
  }
}

module.exports = { ensureAuthSchema };

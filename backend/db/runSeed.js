/**
 * Runs schema.sql followed by seed.sql against the configured database.
 * Usage: npm run seed
 */
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function run() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Applying schema.sql ...');
    await client.query(schemaSql);
    console.log('Applying seed.sql ...');
    await client.query(seedSql);
    console.log('Database schema created and seeded successfully.');
  } catch (err) {
    console.error('Failed to seed database:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();

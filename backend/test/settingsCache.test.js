const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Swap the real PostgreSQL pool for a fake before settingsCache loads it,
// so these tests run without a database.
const poolPath = require.resolve(path.join(__dirname, '..', 'db', 'pool'));
const fakePool = {
  rows: [],
  calls: [],
  async query(sql, params) {
    this.calls.push({ sql, params });
    return { rows: this.rows };
  },
};
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: fakePool };

const { getSettings, getSettingsAt, invalidate } = require('../utils/settingsCache');
const { calculateLateness } = require('../utils/fineCalculator');

test.beforeEach(() => {
  fakePool.rows = [];
  fakePool.calls = [];
  invalidate();
});

test('falls back to the defaults when the settings table is empty', async () => {
  assert.deepEqual(await getSettings(), {
    workday_start_time: '08:30',
    block_minutes: 15,
    fine_per_block_vnd: 10000,
  });
});

test('parses stored string values into numbers for the calculator', async () => {
  fakePool.rows = [
    { key: 'block_minutes', value: '10' },
    { key: 'fine_per_block_vnd', value: '20000' },
  ];
  const settings = await getSettings();
  assert.deepEqual(settings, {
    workday_start_time: '08:30',
    block_minutes: 10,
    fine_per_block_vnd: 20000,
  });
  assert.equal(calculateLateness('08:41', settings).total_fine, 40000);
});

test('caches current settings until invalidated', async () => {
  fakePool.rows = [{ key: 'fine_per_block_vnd', value: '20000' }];
  await getSettings();
  fakePool.rows = [{ key: 'fine_per_block_vnd', value: '30000' }];
  assert.equal((await getSettings()).fine_per_block_vnd, 20000);
  assert.equal(fakePool.calls.length, 1);

  invalidate();
  assert.equal((await getSettings()).fine_per_block_vnd, 30000);
  assert.equal(fakePool.calls.length, 2);
});

test('getSettingsAt looks up the version in effect at that time, bypassing the cache', async () => {
  fakePool.rows = [{ key: 'fine_per_block_vnd', value: '20000' }];
  await getSettings();

  fakePool.rows = [{ key: 'fine_per_block_vnd', value: '5000' }];
  const when = '2025-01-15T09:00:00Z';
  const historical = await getSettingsAt(when);

  assert.equal(historical.fine_per_block_vnd, 5000);
  assert.deepEqual(fakePool.calls.at(-1).params, [when]);
  assert.match(fakePool.calls.at(-1).sql, /effective_start_date <= \$1/);
  // The live cache is untouched.
  assert.equal((await getSettings()).fine_per_block_vnd, 20000);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLateness, timeToMinutes, round2 } = require('../utils/fineCalculator');

// Matches the defaults in utils/settingsCache.js.
const DEFAULT_SETTINGS = {
  workday_start_time: '08:30',
  block_minutes: 15,
  fine_per_block_vnd: 10000,
};

test('timeToMinutes converts HH:MM and HH:MM:SS to minutes since midnight', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('08:30'), 510);
  assert.equal(timeToMinutes('08:30:59'), 510);
  assert.equal(timeToMinutes('23:59'), 1439);
});

test('round2 rounds to two decimal places', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(10000), 10000);
  assert.equal(round2(1 / 3), 0.33);
});

test('early or on-time check-in has no fine', () => {
  for (const time of ['07:00', '08:29', '08:30', '08:30:00', '08:30:59']) {
    assert.deepEqual(calculateLateness(time, DEFAULT_SETTINGS), {
      minutes_late: 0,
      fine_blocks: 0,
      total_fine: 0,
    }, time);
  }
});

test('any partial block is rounded up to a full block', () => {
  const cases = [
    // [check-in, minutes_late, fine_blocks, total_fine]
    ['08:31', 1, 1, 10000],
    ['08:37', 7, 1, 10000],
    ['08:38', 8, 1, 10000],
    ['08:45', 15, 1, 10000],
    ['08:46', 16, 2, 20000],
    ['09:00', 30, 2, 20000],
    ['09:01', 31, 3, 30000],
    ['10:30', 120, 8, 80000],
    ['10:31', 121, 9, 90000],
  ];
  for (const [time, minutes_late, fine_blocks, total_fine] of cases) {
    assert.deepEqual(
      calculateLateness(time, DEFAULT_SETTINGS),
      { minutes_late, fine_blocks, total_fine },
      time
    );
  }
});

test('README examples: 08:31 is 10,000 VND and 09:00 is 20,000 VND', () => {
  assert.equal(calculateLateness('08:31', DEFAULT_SETTINGS).total_fine, 10000);
  assert.equal(calculateLateness('09:00', DEFAULT_SETTINGS).total_fine, 20000);
});

test('seconds in the check-in time are ignored', () => {
  assert.deepEqual(
    calculateLateness('08:45:59', DEFAULT_SETTINGS),
    calculateLateness('08:45', DEFAULT_SETTINGS)
  );
});

test('uses the workday start time from settings', () => {
  const settings = { ...DEFAULT_SETTINGS, workday_start_time: '09:00' };
  assert.equal(calculateLateness('08:45', settings).total_fine, 0);
  assert.deepEqual(calculateLateness('09:20', settings), {
    minutes_late: 20,
    fine_blocks: 2,
    total_fine: 20000,
  });
});

test('uses the block size from settings', () => {
  const settings = { ...DEFAULT_SETTINGS, block_minutes: 10 };
  assert.deepEqual(calculateLateness('08:50', settings), {
    minutes_late: 20,
    fine_blocks: 2,
    total_fine: 20000,
  });
  assert.equal(calculateLateness('08:51', settings).fine_blocks, 3);
});

test('uses the rate per block from settings', () => {
  const settings = { ...DEFAULT_SETTINGS, fine_per_block_vnd: 25000 };
  assert.equal(calculateLateness('08:46', settings).total_fine, 50000);
});

test('a zero rate records lateness but no fine', () => {
  const settings = { ...DEFAULT_SETTINGS, fine_per_block_vnd: 0 };
  assert.deepEqual(calculateLateness('09:00', settings), {
    minutes_late: 30,
    fine_blocks: 2,
    total_fine: 0,
  });
});

test('a fractional rate keeps two decimal places', () => {
  const settings = { ...DEFAULT_SETTINGS, fine_per_block_vnd: 0.1 };
  // 3 blocks * 0.1 is 0.30000000000000004 in floating point.
  assert.equal(calculateLateness('09:01', settings).total_fine, 0.3);
});

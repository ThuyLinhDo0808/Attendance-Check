/**
 * Core business logic for lateness + fine calculation.
 *
 * Workday start time, block size, and rate per block are all
 * adjustable via environment variables (see .env.example) so the
 * rule can change without touching this module.
 */
require('dotenv').config();

const WORKDAY_START_TIME = process.env.WORKDAY_START_TIME || '08:30';
const BLOCK_MINUTES = Number(process.env.BLOCK_MINUTES) || 15;
const FINE_PER_BLOCK_VND = Number(process.env.FINE_PER_BLOCK_VND) || 10000;

/**
 * Converts a "HH:MM" or "HH:MM:SS" string into minutes-since-midnight.
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Given a check-in time string ("HH:MM" or "HH:MM:SS"), returns the
 * computed lateness fields.
 *
 * minutes_late is always a non-negative integer (early/on-time = 0).
 * fine_blocks is the EXACT proportional value (minutes_late / 15),
 * never rounded up — e.g. 16 minutes late = 1.07 blocks, not 2.
 * total_fine = fine_blocks * rate, rounded to 2 decimal places (VND cents
 * don't really exist, but we keep 2 decimals to preserve exact math and
 * avoid compounding rounding errors; the frontend formats for display).
 */
function calculateLateness(checkInTime, workdayStart = WORKDAY_START_TIME) {
  const checkInMinutes = timeToMinutes(checkInTime);
  const startMinutes = timeToMinutes(workdayStart);

  const minutesLate = Math.max(0, checkInMinutes - startMinutes);
  
  // CHANGED: Use Math.floor() to only count complete blocks.
  // 1-14 mins -> 0 blocks. 15-29 mins -> 1 block.
  const fineBlocks = Math.floor(minutesLate / BLOCK_MINUTES);
  
  const totalFine = fineBlocks * FINE_PER_BLOCK_VND;

  return {
    minutes_late: minutesLate,
    fine_blocks: round2(fineBlocks),
    total_fine: round2(totalFine),
  };
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

module.exports = {
  calculateLateness,
  WORKDAY_START_TIME,
  BLOCK_MINUTES,
  FINE_PER_BLOCK_VND,
};

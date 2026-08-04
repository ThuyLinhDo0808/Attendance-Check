/**
 * Core business logic for lateness + fine calculation.
 *
 * This is a pure function: it takes the current settings (workday start
 * time, block size, rate per block) as an argument rather than reading
 * them itself, so the calculation is easy to test and has no hidden
 * dependency on the database or environment. Callers fetch settings via
 * utils/settingsCache.js (which reads the `settings` table — see the
 * Settings tab in the admin UI) and pass them in here.
 */

/**
 * Converts a "HH:MM" or "HH:MM:SS" string into minutes-since-midnight.
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Given a check-in time string ("HH:MM" or "HH:MM:SS") and the current
 * settings, returns the computed lateness fields.
 *
 * minutes_late is always a non-negative integer (early/on-time = 0).
 * fine_blocks is the EXACT proportional value (minutes_late / block_minutes),
 * never rounded up — e.g. 16 minutes late at a 15-min block = 1.07 blocks,
 * not 2.
 * total_fine = fine_blocks * rate, rounded to 2 decimal places (VND cents
 * don't really exist, but 2 decimals preserves exact math and avoids
 * compounding rounding errors; the frontend formats for display).
 *
 * @param {string} checkInTime
 * @param {{workday_start_time: string, block_minutes: number, fine_per_block_vnd: number}} settings
 */
function calculateLateness(checkInTime, settings) {
  const { workday_start_time, block_minutes, fine_per_block_vnd } = settings;

  const checkInMinutes = timeToMinutes(checkInTime);
  const startMinutes = timeToMinutes(workday_start_time);

  const minutesLate = Math.max(0, checkInMinutes - startMinutes);
  
  // 1 phút muộn cũng tính là 1 block
  const fineBlocks = Math.ceil(minutesLate / block_minutes);
  const totalFine = fineBlocks * fine_per_block_vnd;

  return {
    minutes_late: minutesLate,
    fine_blocks: round2(fineBlocks),
    total_fine: round2(totalFine),
  };
}

module.exports = {
  calculateLateness,
  timeToMinutes,
  round2,
};

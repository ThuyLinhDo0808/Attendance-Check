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
 * fine_blocks is minutes_late / block_minutes rounded to the NEAREST whole
 * block, with exactly half rounding up — e.g. at a 15-min block, 14 minutes
 * (0.93) = 1 block, 19 minutes (1.27) = 1 block, 25 minutes (1.67) = 2
 * blocks, and 7 minutes (0.47) = 0 (see README "Fine blocks").
 * total_fine = fine_blocks * rate, rounded to 2 decimal places.
 *
 * @param {string} checkInTime
 * @param {{workday_start_time: string, block_minutes: number, fine_per_block_vnd: number}} settings
 */

function calculateLateness(checkInTime, settings) {
  const { workday_start_time, block_minutes, fine_per_block_vnd } = settings;

  const checkInMinutes = timeToMinutes(checkInTime);
  const startMinutes = timeToMinutes(workday_start_time);

  const minutesLate = Math.max(0, checkInMinutes - startMinutes);

  const fineBlocks = Math.round(minutesLate / block_minutes);
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

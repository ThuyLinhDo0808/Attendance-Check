/**
 * Wall-clock helpers pinned to the office's timezone.
 *
 * Check-ins are stamped by the server, so using the process's own local
 * time breaks as soon as the API runs on a host in another timezone
 * (most cloud hosts run in UTC — a 08:20 check-in in Hanoi would be
 * stored as 01:20, on the wrong day before 07:00). APP_TIMEZONE lets the
 * deployment pick the office's zone; it defaults to Vietnam.
 */
const TIME_ZONE = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';

function nowParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`, // YYYY-MM-DD
    time: `${parts.hour}:${parts.minute}:${parts.second}`, // HH:MM:SS
  };
}

module.exports = {
  TIME_ZONE,
  todayDate: (date) => nowParts(date).date,
  currentMonth: (date) => nowParts(date).date.slice(0, 7),
  currentTime: (date) => nowParts(date).time,
};

export function formatVND(value) {
  const num = Number(value) || 0;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} VNĐ`;
}

export function formatVNDExact(value) {
  const num = Number(value) || 0;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VNĐ`;
}

export function formatBlocks(value) {
  return (Number(value) || 0).toFixed(2);
}

// Local calendar date as YYYY-MM-DD. toISOString() would give the UTC
// date instead, which in Vietnam (UTC+7) is still "yesterday" until 07:00.
export function localDateValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthValue() {
  return localDateValue().slice(0, 7); // YYYY-MM
}

export function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  // A bare YYYY-MM-DD is parsed as UTC midnight, which shows the previous
  // day in timezones west of UTC; read it as a local date instead.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5);
}

export function currentWeekValue() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export function weekToDates(weekStr) {
  if (!weekStr) return null;
  const [year, week] = weekStr.split('-W').map(Number);
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  
  const start = new Date(ISOweekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  
  return {
    start_date: localDateValue(start),
    end_date: localDateValue(end),
  };
}

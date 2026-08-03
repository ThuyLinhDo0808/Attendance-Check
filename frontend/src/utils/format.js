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

export function currentMonthValue() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5);
}

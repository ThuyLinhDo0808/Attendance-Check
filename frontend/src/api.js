const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const api = {
  getEmployees: (status) => request(`/employees${status ? `?status=${status}` : ''}`),
  getEmployeeHistory: (code) => request(`/employees/${code}/history`),
  createEmployee: (payload) =>
    request('/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (code, payload) =>
    request(`/employees/${code}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // employee_code is the stable identifier used everywhere now (an
  // employee's numeric id changes if they get a new SCD2 version, e.g.
  // a department transfer — employee_code never does).
  logAttendance: (payload) =>
    request('/attendance/log', { method: 'POST', body: JSON.stringify(payload) }),
  getAttendanceLogs: ({ employee_code, month, date, lateOnly } = {}) => {
    const params = new URLSearchParams();
    if (employee_code) params.set('employee_code', employee_code);
    if (month) params.set('month', month);
    if (date) params.set('date', date);
    if (lateOnly) params.set('late_only', 'true');
    const qs = params.toString();
    return request(`/attendance${qs ? `?${qs}` : ''}`);
  },
  deleteAttendanceLog: (id) => request(`/attendance/${id}`, { method: 'DELETE' }),

  getMonthlyAnalytics: (month) => request(`/analytics/monthly?month=${month}`),
  getEmployeeAnalytics: (code, month) =>
    request(`/analytics/employee/${code}${month ? `?month=${month}` : ''}`),
  getFineSheet: (month) => request(`/analytics/fine-sheet${month ? `?month=${month}` : ''}`),
  getTrends: (months) => request(`/analytics/trends?months=${months}`),

  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  getSettingsHistory: (key) => request(`/settings/history${key ? `?key=${key}` : ''}`),

  exportMonthlyUrl: ({ month, format = 'csv', report = 'detail' }) => {
    const params = new URLSearchParams({ month, format, report });
    return `${BASE_URL}/export/monthly?${params.toString()}`;
  },

  getAnalyticsByRange: (start_date, end_date) => 
    request(`/analytics/range?start_date=${start_date}&end_date=${end_date}`),

  exportRangeUrl: ({ start_date, end_date, format = 'csv' }) => {
    const params = new URLSearchParams({ start_date, end_date, format });
    return `${BASE_URL}/export/range?${params.toString()}`;
  },

  getSyncStatus: () => request('/sync/status'),
  syncMonthNow: (month) => request('/sync/monthly', { method: 'POST', body: JSON.stringify({ month }) }),

  getSeats: async (asOfDate) => {
    const url = asOfDate ? `/api/seats?as_of=${asOfDate}` : '/api/seats';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Không thể tải sơ đồ ghế');
    return res.json();
  },

  getAttendanceAudit: async (logId) => {
    const res = await fetch(`/api/attendance/audit/${logId}`);
    if (!res.ok) throw new Error('Lỗi khi tải lịch sử sửa đổi');
    return res.json();
  },

  assignSeat: async (seatId, employeeCode) => {
    const res = await fetch('/api/seats/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seat_id: seatId,
        employee_code: employeeCode,
      }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Đã xảy ra lỗi khi cập nhật chỗ ngồi');
    }
    return res.json();
  },  
};

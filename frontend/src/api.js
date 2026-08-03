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
  createEmployee: (payload) =>
    request('/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (id, payload) =>
    request(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  logAttendance: (payload) =>
    request('/attendance/log', { method: 'POST', body: JSON.stringify(payload) }),
  getAttendanceLogs: ({ employee_id, month, date, lateOnly } = {}) => {
    const params = new URLSearchParams();
    if (employee_id) params.set('employee_id', employee_id);
    if (month) params.set('month', month);
    if (date) params.set('date', date);
    if (lateOnly) params.set('late_only', 'true');
    const qs = params.toString();
    return request(`/attendance${qs ? `?${qs}` : ''}`);
  },
  deleteAttendanceLog: (id) => request(`/attendance/${id}`, { method: 'DELETE' }),

  getMonthlyAnalytics: (month) => request(`/analytics/monthly?month=${month}`),
  getEmployeeAnalytics: (id, month) =>
    request(`/analytics/employee/${id}${month ? `?month=${month}` : ''}`),
  getFineSheet: (month) => request(`/analytics/fine-sheet${month ? `?month=${month}` : ''}`),
  getTrends: (months) => request(`/analytics/trends?months=${months}`),

  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

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
};

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// --- Session -----------------------------------------------------------
// The login token lives in localStorage so a page refresh keeps the admin
// signed in. Every API call sends it as a Bearer token; a 401 from the
// server (expired or revoked) clears it and sends the app back to login.

const listeners = new Set();

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const session = {
  getToken: () => readStorage(TOKEN_KEY),
  getUser: () => {
    try {
      return JSON.parse(readStorage(USER_KEY));
    } catch {
      return null;
    }
  },
  save(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Private mode etc. — the session just won't survive a refresh.
    }
    listeners.forEach((fn) => fn(user));
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    listeners.forEach((fn) => fn(null));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/**
 * fetch() that adds the login token and signs the user out on a 401.
 * Accepts either a full '/api/...' path or a URL already built with BASE_URL.
 */
export async function authFetch(url, options = {}) {
  const token = session.getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && token) session.clear();
  return res;
}

async function request(path, options = {}) {
  const res = await authFetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(body?.error || body?.message || `Request failed (${res.status})`);
  }
  return body;
}

/**
 * Downloads a file from the API. Plain <a href> links can't carry the
 * Authorization header, so fetch the file and save it from a blob instead.
 */
export async function downloadFile(url, fallbackName = 'export') {
  const res = await authFetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Download failed (${res.status})`);
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;

  const blobUrl = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  changePassword: (current_password, new_password) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  getAccounts: () => request('/auth/accounts'),
  setAccountPassword: (code, password) =>
    request(`/auth/accounts/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify({ password }) }),
  setAccountRole: (code, role) =>
    request(`/auth/accounts/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify({ role }) }),
  deleteAccount: (code) => request(`/auth/accounts/${encodeURIComponent(code)}`, { method: 'DELETE' }),

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
    const url = asOfDate ? `${BASE_URL}/seats?as_of=${asOfDate}` : `${BASE_URL}/seats`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error('Không thể tải sơ đồ ghế');
    return res.json();
  },

  getAttendanceAudit: async (logId) => {
    const res = await authFetch(`${BASE_URL}/attendance/audit/${logId}`);
    if (!res.ok) throw new Error('Lỗi khi tải lịch sử sửa đổi');
    return res.json();
  },

  assignSeat: async (seatId, employeeCode) => {
    const res = await authFetch(`${BASE_URL}/seats/assign`, {
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

  getPendingExcuses: () => request('/attendance/pending-excuses'),
  resolveExcuse: (payload) => request('/attendance/resolve-excuse', { method: 'POST', body: JSON.stringify(payload) }),

  uploadEvidence: async (formData) => {
    // Không dùng hàm request() chung, mà dùng thẳng fetch() để trình duyệt tự lo Header cho FormData
    const res = await authFetch(`${BASE_URL}/attendance/upload-evidence`, {
      method: 'POST',
      body: formData,
    });
    
    // Đọc luồng phản hồi trả về từ backend
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await res.json() : null;

    if (!res.ok) {
      throw new Error(body?.error || `Lỗi tải file lên (${res.status})`);
    }
    return body;
  },

  // Lấy cấu trúc sơ đồ hiện tại (Bàn và tọa độ ghế)
  getOfficeLayout: async () => {
    const response = await authFetch(`${BASE_URL}/seats/layout`);
    if (!response.ok) throw new Error('Failed to fetch office layout');
    return response.json();
  },

  // Lưu cấu trúc sơ đồ mới (Dành cho Map Builder kéo thả)
  saveOfficeLayout: async (layoutJson) => {
    const response = await authFetch(`${BASE_URL}/seats/layout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ layout_json: layoutJson })
    });
    if (!response.ok) throw new Error('Failed to save office layout');
    return response.json();
  }
};

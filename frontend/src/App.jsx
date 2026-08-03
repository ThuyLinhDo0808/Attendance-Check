import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { formatVND } from './utils/format';
import AttendanceLogger from './components/AttendanceLogger.jsx';
import CompanyAnalytics from './components/CompanyAnalytics.jsx';
import EmployeeFineSheet from './components/EmployeeFineSheet.jsx';
import Settings from './components/Settings.jsx';
import WeeklyReport from './components/WeeklyReport.jsx';
import EmployeeManager from './components/EmployeeManager.jsx';

const TABS = [
  { id: 'logger', label: 'Attendance Logger', glyph: '⏱' },
  { id: 'analytics', label: 'Company Analytics', glyph: '▤' },
  { id: 'weekly', label: 'Weekly Report', glyph: '📅' },
  { id: 'sheet', label: 'Employee Fine Sheet', glyph: '≣' },
  { id: 'employees', label: 'Employees', glyph: '👥' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('logger');
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState(null);
  const [sidebarSettings, setSidebarSettings] = useState(null);
  const [toast, setToast] = useState(null);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await api.getEmployees();
      setEmployees(data);
      setEmployeesError(null);
    } catch (err) {
      setEmployeesError(err.message);
    }
  }, []);

  const loadSidebarSettings = useCallback(async () => {
    try {
      const rows = await api.getSettings();
      setSidebarSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    } catch {
      // sidebar just falls back to showing nothing extra; not critical path
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadSidebarSettings();
  }, [loadEmployees, loadSidebarSettings]);

  const showToast = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, key: Date.now() });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-ledger-950 text-slate-200 flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-mono-num text-accent text-lg font-bold">
              {sidebarSettings?.workday_start_time || '—'}
            </span>
            <span className="text-xs uppercase tracking-widest text-slate-400">cutoff</span>
          </div>
          <h1 className="mt-2 text-lg font-bold text-white leading-tight">
            Attendance &amp; Fine Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">Single-admin internal tool</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
            >
              <span className="text-base w-5 text-center" aria-hidden="true">
                {tab.glyph}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-white/10 text-xs text-slate-500">
          {sidebarSettings ? (
            <>
              Rate: {formatVND(sidebarSettings.fine_per_block_vnd)} /{' '}
              {sidebarSettings.block_minutes}-min block
            </>
          ) : (
            'Loading rate…'
          )}
          <br />
          Fines are proportional — never rounded up.
          <br />
          <button
            onClick={() => setActiveTab('settings')}
            className="mt-1 text-accent hover:underline"
          >
            Change in Settings →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {employeesError && (
            <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
              Could not load employees: {employeesError}. Confirm the backend API is running.
            </div>
          )}

          {activeTab === 'logger' && (
            <AttendanceLogger employees={employees} onLogged={() => showToast('Attendance logged.')} />
          )}
          {activeTab === 'analytics' && <CompanyAnalytics />}
          {activeTab === 'weekly' && <WeeklyReport />}
          {activeTab === 'sheet' && <EmployeeFineSheet />}
          {activeTab === 'employees' && (
            <EmployeeManager 
              employees={employees} 
              onEmployeeAdded={() => {
                showToast('New employee added.');
                loadEmployees(); // Reload the employee list immediately
              }} 
            />
          )}
          {activeTab === 'settings' && (
            <Settings
              onSaved={() => {
                showToast('Settings updated.');
                loadSidebarSettings();
              }}
            />
          )}
        </div>
      </main>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="fixed bottom-6 right-6 rounded-lg bg-ledger-950 text-white text-sm px-4 py-3 shadow-lg border border-white/10"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

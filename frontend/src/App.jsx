import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { formatVND } from './utils/format';
import AttendanceLogger from './components/AttendanceLogger.jsx';
import CompanyAnalytics from './components/CompanyAnalytics.jsx';
import EmployeeFineSheet from './components/EmployeeFineSheet.jsx';
import Settings from './components/Settings.jsx';
import WeeklyReport from './components/WeeklyReport.jsx';
import EmployeeManager from './components/EmployeeManager.jsx';
import AdminQRCode from './components/AdminQRCode.jsx';
import PendingExcuses from './components/PendingExcuses.jsx';
import { 
  ClockIcon, 
  PresentationChartBarIcon, 
  CalendarDaysIcon, 
  TableCellsIcon, 
  UserGroupIcon, 
  Cog6ToothIcon ,
  QrCodeIcon,
  BellAlertIcon,
  VideoCameraIcon,
  MapIcon
} from '@heroicons/react/24/outline';
import EvidenceManager from './components/EvidenceManager.jsx';
import MapBuilder from './components/MapBuilder.jsx';
import { useShortcuts, SHORTCUT_REGISTRY } from './hooks/useShortcuts';
import CommandPalette from './components/CommandPalette.jsx';

const MENU_GROUPS = [
  {
    title: 'Daily Operations',
    items: [
      { id: 'qrcode', label: 'QR Check-in', icon: QrCodeIcon },
      { id: 'logger', label: 'Attendance Logger', icon: ClockIcon },
      { id: 'excuses', label: 'Pending Excuses', icon: BellAlertIcon },
      { id: 'evidence', label: 'Evidence Manager', icon: VideoCameraIcon }, 
    ]
  },
  {
    title: 'Ledger & Analytics',
    items: [
      { id: 'analytics', label: 'Company Analytics', icon: PresentationChartBarIcon },
      { id: 'weekly', label: 'Weekly Report', icon: CalendarDaysIcon }, 
      { id: 'sheet', label: 'Employee Fine Sheet', icon: TableCellsIcon },
    ]
  },
  {
    title: 'Workspace & System',
    items: [
      { id: 'map-builder', label: 'Map Builder', icon: MapIcon },
      { id: 'employees', label: 'Employee Management', icon: UserGroupIcon }, 
      { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
    ]
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('logger');
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState(null);
  const [sidebarSettings, setSidebarSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const { shortcuts } = useShortcuts();

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const keys = [];
      if (e.ctrlKey) keys.push('ctrl');
      if (e.metaKey) keys.push('meta');
      if (e.altKey) keys.push('alt');
      if (e.shiftKey) keys.push('shift');
      if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
        keys.push(e.key.toLowerCase());
      }
      
      const pressedCombo = keys.join('+');

      const matchedActionId = Object.keys(shortcuts).find(id => shortcuts[id] === pressedCombo);

      if (matchedActionId) {
        e.preventDefault();
        const actionDef = SHORTCUT_REGISTRY.find(item => item.id === matchedActionId);
        if (actionDef && actionDef.targetTab) {
          setActiveTab(actionDef.targetTab);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [shortcuts]);

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
    }
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const data = await api.getPendingExcuses();
      setPendingCount(data.length);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadSidebarSettings();
    loadPendingCount();
  }, [loadEmployees, loadSidebarSettings, loadPendingCount]);

  const showToast = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, key: Date.now() });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      
      <CommandPalette setActiveTab={setActiveTab} />

      {/* Sidebar được cấu trúc lại */}
      <aside className="w-64 shrink-0 bg-ledger-950 text-slate-200 flex flex-col shadow-xl z-20">
        <div className="px-6 py-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="font-mono-num text-accent text-lg font-bold">
              {sidebarSettings?.workday_start_time || '—'}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold bg-white/10 px-1.5 py-0.5 rounded">cutoff</span>
          </div>
          <h1 className="mt-3 text-lg font-extrabold text-white leading-tight tracking-wide">
            Attendance<br/><span className="text-accent">&amp;</span> Fine Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-2 font-medium">Single-admin internal tool</p>
        </div>

        {/* Duyệt qua các nhóm Menu */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-hide">
          {MENU_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${
                        activeTab === tab.id
                          ? 'bg-accent text-white shadow-md shadow-accent/20'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`} />
                      {tab.label}
                    </div>
                    
                    {tab.id === 'excuses' && pendingCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Sidebar */}
        <div className="px-6 py-5 border-t border-white/5 text-xs text-slate-400 bg-black/10">
          <div className="font-mono-num mb-1">
            {sidebarSettings ? (
              <>Rate: <span className="text-slate-200 font-bold">{formatVND(sidebarSettings.fine_per_block_vnd)}</span> / {sidebarSettings.block_minutes}m</>
            ) : (
              'Loading rate…'
            )}
          </div>
          <p className="opacity-70 leading-relaxed">Fines are proportional — never rounded up.</p>
          <button
            onClick={() => setActiveTab('settings')}
            className="mt-2 text-accent font-semibold hover:text-indigo-400 transition-colors"
          >
            Open Settings →
          </button>
        </div>
      </aside>

      {/* Phần Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {employeesError && (
            <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
              Could not load employees: {employeesError}. Confirm the backend API is running.
            </div>
          )}

          {activeTab === 'qrcode' && <AdminQRCode />}
          {activeTab === 'logger' && <AttendanceLogger employees={employees} onLogged={() => showToast('Attendance logged.')} />}
          {activeTab === 'analytics' && <CompanyAnalytics />}
          {activeTab === 'weekly' && <WeeklyReport />}
          {activeTab === 'sheet' && <EmployeeFineSheet />}
          {activeTab === 'employees' && (
            <EmployeeManager 
              employees={employees} 
              onEmployeeAdded={() => {
                showToast('New employee added.');
                loadEmployees(); 
              }} 
            />
          )}
          {activeTab === 'map-builder' && <MapBuilder />}
          {activeTab === 'excuses' && <PendingExcuses onResolved={() => {
              showToast('Đã xử lý đơn thành công!');
              loadPendingCount(); 
            }} />}
          {activeTab === 'evidence' && <EvidenceManager />}
          {activeTab === 'settings' && <Settings onSaved={() => {
                showToast('Settings updated.');
                loadSidebarSettings();
              }} />}
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
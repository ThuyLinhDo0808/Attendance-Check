import React, { useEffect, useState, useCallback } from 'react';
import { api, session } from './api';
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
  MapIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import EvidenceManager from './components/EvidenceManager.jsx';
import MapBuilder from './components/MapBuilder.jsx';
import { useShortcuts, SHORTCUT_REGISTRY } from './hooks/useShortcuts';
import CommandPalette from './components/CommandPalette.jsx';
import { useApiHealth } from './hooks/useApiHealth';
import Login from './components/Login.jsx';
import AccountMenu from './components/AccountMenu.jsx';

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

const MENU_ITEMS = MENU_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title }))
);

const KEY_LABELS = { alt: 'Alt', ctrl: 'Ctrl', meta: '⌘', shift: '⇧' };

const HEALTH_DOT = {
  checking: 'bg-slate-500',
  ok: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  degraded: 'bg-amber-400',
  offline: 'bg-rose-500',
};
const HEALTH_LABEL = {
  checking: 'Connecting…',
  ok: 'All systems normal',
  degraded: 'Database unreachable',
  offline: 'API offline',
};

function formatCompactVND(value) {
  const num = Number(value) || 0;
  if (num >= 1000) return `${(num / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`;
  return String(num);
}

const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function App() {
  const [user, setUser] = useState(() => (session.getToken() ? session.getUser() : null));

  useEffect(() => session.subscribe(setUser), []);

  if (!user) return <Login />;
  return <Dashboard user={user} />;
}

function Dashboard({ user }) {
  const [activeTab, setActiveTab] = useState('logger');
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState(null);
  const [sidebarSettings, setSidebarSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const apiHealth = useApiHealth();
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

  const activeItem = MENU_ITEMS.find((item) => item.id === activeTab) || MENU_ITEMS[0];

  function navigate(tabId) {
    setActiveTab(tabId);
    setSidebarOpen(false);
  }

  return (
    <div className="flex min-h-screen text-slate-900">
      <CommandPalette setActiveTab={setActiveTab} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden anim-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[17rem] shrink-0 flex-col bg-ledger-950 text-slate-300 ring-1 ring-white/5 transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Subtle brand glow behind the logo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(110,102,238,0.22),transparent_70%)]" />

        <div className="relative flex items-center justify-between px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-semibold tracking-tight text-white">Ledger</p>
              <p className="text-[11px] font-medium text-slate-400">Attendance &amp; Fines</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mx-4 mb-2 grid grid-cols-2 divide-x divide-white/5 rounded-xl border border-white/5 bg-white/[0.03] text-center">
          <div className="px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Cutoff</p>
            <p className="font-mono-num mt-0.5 text-sm font-semibold text-white">
              {sidebarSettings?.workday_start_time || '—'}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Rate · VNĐ</p>
            <p className="font-mono-num mt-0.5 truncate text-sm font-semibold text-white">
              {sidebarSettings ? (
                <>
                  {formatCompactVND(sidebarSettings.fine_per_block_vnd)}
                  <span className="text-slate-500 font-medium">/{sidebarSettings.block_minutes}m</span>
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>

        <nav className="relative flex-1 space-y-7 overflow-y-auto px-3 py-5 scrollbar-hide" aria-label="Main">
          {MENU_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 px-3 font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      data-tab={tab.id}
                      onClick={() => navigate(tab.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-white/[0.07] text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-400 shadow-[0_0_12px_rgba(139,135,245,0.8)]" />
                      )}
                      <span className="flex items-center gap-3">
                        <tab.icon
                          className={`h-[18px] w-[18px] transition-colors ${
                            isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                        />
                        {tab.label}
                      </span>

                      {tab.id === 'excuses' && pendingCount > 0 && (
                        <span className="font-mono-num rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-inset ring-rose-400/30">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <AccountMenu
          user={user}
          status={HEALTH_LABEL[apiHealth]}
          statusDot={HEALTH_DOT[apiHealth]}
          onOpenSettings={() => navigate('settings')}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-3 px-4 sm:px-6 lg:px-10">
            <button
              onClick={() => setSidebarOpen(true)}
              className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Open menu"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>

            <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
              <span className="hidden truncate text-slate-400 sm:inline">{activeItem.group}</span>
              <ChevronRightIcon className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:block" />
              <span className="truncate font-medium text-slate-900">{activeItem.label}</span>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 md:inline-flex">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                {todayLabel}
              </span>
              <button
                onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
                className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white pl-2.5 pr-1.5 text-xs text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 sm:w-56"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                <span className="hidden flex-1 text-left sm:inline">Jump to…</span>
                <span className="hidden items-center gap-0.5 sm:flex">
                  {(shortcuts.open_palette || '').split('+').filter(Boolean).map((k) => (
                    <kbd key={k} className="kbd">{KEY_LABELS[k] || k.toUpperCase()}</kbd>
                  ))}
                </span>
              </button>
              <button
                onClick={() => navigate('excuses')}
                className="relative rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={`${pendingCount} pending excuses`}
                title="Pending excuses"
              >
                <BellIcon className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div key={activeTab} className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6 lg:px-10 animate-page-in">
            {employeesError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">Couldn't load employees</p>
                  <p className="mt-0.5 text-amber-800/80">{employeesError}. Check that the API server is running.</p>
                </div>
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
      </div>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-ledger-950/95 py-3 pl-3.5 pr-5 text-sm text-white shadow-xl ring-1 ring-white/10 backdrop-blur animate-toast-in"
        >
          {toast.tone === 'error' ? (
            <ExclamationTriangleIcon className="h-5 w-5 text-rose-400" />
          ) : (
            <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-700 shadow-glow ring-1 ring-white/20">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden="true">
        <path d="M6 5v14h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="8.5" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}

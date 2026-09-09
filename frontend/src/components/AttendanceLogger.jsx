import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks } from '../utils/format';
import LateWorkersPanel from './LateWorkersPanel.jsx';
import LiveOfficeMap from './LiveOfficeMap.jsx';
import { 
  ClipboardDocumentCheckIcon, 
  CalendarDaysIcon, 
  ClockIcon, 
  DocumentTextIcon, 
  BanknotesIcon, 
  MapIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function previewFine(checkInTime, isExempt, settings) {
  if (isExempt) return { minutesLate: 0, fineBlocks: 0, totalFine: 0, exempt: true };
  if (!checkInTime || !settings) return null;
  const [h, m] = checkInTime.split(':').map(Number);
  const [sh, sm] = settings.workday_start_time.split(':').map(Number);
  const minutesLate = Math.max(0, h * 60 + m - (sh * 60 + sm));
  const fineBlocks = Math.round(minutesLate / settings.block_minutes);
  const totalFine = fineBlocks * settings.fine_per_block_vnd;
  return { minutesLate, fineBlocks, totalFine, exempt: false };
}

const MetricRow = ({ icon: Icon, label, value, highlight, sub }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 text-sm">
    <dt className="flex items-center gap-2 text-slate-500 font-medium">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      {label}
    </dt>
    <dd className="text-right">
      <span className={`font-mono text-sm ${highlight ? 'text-red-600 font-bold' : 'text-slate-800 font-semibold'}`}>
        {value}
      </span>
      {sub && <span className="block text-[10px] text-slate-400 font-mono">{sub}</span>}
    </dd>
  </div>
);

export default function AttendanceLogger({ employees, onLogged }) {
  const [form, setForm] = useState({
    employee_code: '',
    work_date: todayISO(),
    check_in_time: '',
    check_out_time: '',
    note: '',
    is_exempt: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.getSettings().then((rows) => {
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      setSettings({
        workday_start_time: byKey.workday_start_time,
        block_minutes: Number(byKey.block_minutes),
        fine_per_block_vnd: Number(byKey.fine_per_block_vnd),
      });
    }).catch(() => {});
  }, []);

  const preview = useMemo(
    () => previewFine(form.check_in_time, form.is_exempt, settings),
    [form.check_in_time, form.is_exempt, settings]
  );
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setResult(null);
    if (error) setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.employee_code || !form.work_date) {
      setError('Employee selection and work date are required.');
      return;
    }
    if (!form.is_exempt && !form.check_in_time) {
      setError('Check-in timestamp is mandatory unless explicitly marked exempt.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        check_in_time: form.is_exempt ? null : form.check_in_time,
        check_out_time: form.check_out_time || null,
        note: form.note || null,
        is_exempt: form.is_exempt,
      };
      const saved = await api.logAttendance(payload);
      setResult(saved);
      setRefreshKey((k) => k + 1);
      setForm((f) => ({ ...f, employee_code: '', check_in_time: '', check_out_time: '', note: '', is_exempt: false }));
      onLogged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ClipboardDocumentCheckIcon className="h-7 w-7 text-indigo-600" />
            Attendance Logger
          </h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Single-operator check-in ledger with real-time SCD2 point-in-time fine evaluation.
          </p>
        </div>
        {settings && (
          <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono shadow-sm">
            <span className="text-slate-400">CUTOFF:</span>
            <span className="font-bold text-slate-900">{settings.workday_start_time}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">RATE:</span>
            <span className="font-bold text-indigo-600">{formatVNDExact(settings.fine_per_block_vnd)}</span>
            <span className="text-slate-400">/{settings.block_minutes}m</span>
          </div>
        )}
      </header>

      {/* Interactive Floor Plan Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Interactive Floor Plan
            </h3>
            <span className="text-[11px] text-slate-400 hidden md:inline font-normal">
              — Click any assigned seat to load personnel into entry form
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date:</label>
            <input
              type="date"
              value={form.work_date}
              onChange={(e) => update('work_date', e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none shadow-sm"
            />
          </div>
        </div>
        <div className="p-3 bg-slate-50/40">
          <LiveOfficeMap 
            date={form.work_date} 
            selectedCode={form.employee_code} 
            onSeatClick={(code) => update('employee_code', code)} 
            employees={employees}
          />
        </div>
      </div>

      {/* Main Form & Calculation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Entry Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Manual Check-in Entry
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {form.employee_code ? `Selected: ${form.employee_code}` : 'No seat selected'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Staff Member <span className="text-red-500">*</span>
              </label>
              <select
                value={form.employee_code}
                onChange={(e) => update('employee_code', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition"
              >
                <option value="">-- Choose employee or select via office map --</option>
                {activeEmployees.sort((a, b) => a.name.localeCompare(b.name)).map((emp) => (
                  <option key={emp.employee_code} value={emp.employee_code}>
                    {emp.name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <CalendarDaysIcon className="h-3.5 w-3.5 text-slate-400" />
                Work Date
              </label>
              <input
                type="date"
                value={form.work_date}
                onChange={(e) => update('work_date', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                  Check-in Time
                </span>
                {form.is_exempt && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                    WAIVED
                  </span>
                )}
              </label>
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => update('check_in_time', e.target.value)}
                disabled={form.is_exempt}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Check-out Time <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => update('check_out_time', e.target.value)}
                className="w-full sm:w-1/2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <DocumentTextIcon className="h-3.5 w-3.5 text-slate-400" />
                Audit Notes / Justification
              </label>
              <textarea
                value={form.note}
                onChange={(e) => update('note', e.target.value)}
                placeholder="Specify official delay reasons, medical leave, or corporate dispatch..."
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none resize-none"
              />
            </div>
          </div>

          <div
            onClick={() => update('is_exempt', !form.is_exempt)}
            className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <input
              id="is_exempt"
              type="checkbox"
              checked={form.is_exempt}
              onChange={(e) => update('is_exempt', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
            />
            <div className="text-xs">
              <label htmlFor="is_exempt" className="font-bold text-slate-800 cursor-pointer">
                Exempt from Penalty Calculation
              </label>
              <p className="text-slate-500 mt-0.5">
                Flag record as authorized absence or external field assignment. Prevents lateness penalty creation.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {submitting ? 'Recording Log…' : 'Commit Attendance Record'}
          </button>
        </form>

        {/* Right Sidebar: Projection & Last Recorded Result */}
        <div className="space-y-4 sticky top-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Projection Ledger</span>
              <span className="text-[10px] text-slate-400 font-mono">Live Sync</span>
            </h3>

            {preview?.exempt ? (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center text-xs text-emerald-800 font-medium">
                <ShieldCheckIcon className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                Record marked as <strong>EXEMPT</strong>. Zero fine assessed.
              </div>
            ) : preview ? (
              <dl className="divide-y divide-slate-100">
                <MetricRow 
                  icon={ClockIcon} 
                  label="Delay Duration" 
                  value={`${preview.minutesLate} mins`} 
                  highlight={preview.minutesLate > 0} 
                />
                <MetricRow 
                  icon={BanknotesIcon} 
                  label="Computed Blocks" 
                  value={formatBlocks(preview.fineBlocks)} 
                  highlight={preview.fineBlocks > 0} 
                  sub={`@ ${settings?.block_minutes}m per block`}
                />
                <MetricRow 
                  icon={BanknotesIcon} 
                  label="Estimated Fine" 
                  value={formatVNDExact(preview.totalFine)} 
                  highlight={preview.totalFine > 0} 
                />
              </dl>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-lg">
                Specify check-in timestamp to inspect real-time penalty estimation.
              </div>
            )}
          </div>

          {result && (
            <div className={`p-4 rounded-xl border shadow-sm ${
              result.is_exempt ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className={`h-5 w-5 ${result.is_exempt ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {result.is_exempt ? 'Exemption Registered' : 'Attendance Logged'}
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                {result.is_exempt 
                  ? 'Record stored with waiver status. Zero fine accrued.' 
                  : `Successfully charged ${formatVNDExact(result.total_fine)}.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Late Today Audit Panel */}
      <div className="mt-8">
        <LateWorkersPanel refreshKey={refreshKey} />
      </div>
    </div>
  );
}
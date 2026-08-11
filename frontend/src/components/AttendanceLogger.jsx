import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks } from '../utils/format';
import LateWorkersPanel from './LateWorkersPanel.jsx';
import LiveOfficeMap from './LiveOfficeMap.jsx'; // <--- Thêm import

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function previewFine(checkInTime, isExempt, settings) {
  if (isExempt) return { minutesLate: 0, fineBlocks: 0, totalFine: 0, exempt: true };
  if (!checkInTime || !settings) return null;
  const [h, m] = checkInTime.split(':').map(Number);
  const [sh, sm] = settings.workday_start_time.split(':').map(Number);
  const minutesLate = Math.max(0, h * 60 + m - (sh * 60 + sm));
  const fineBlocks = Math.ceil(minutesLate / settings.block_minutes);
  const totalFine = fineBlocks * settings.fine_per_block_vnd;
  return { minutesLate, fineBlocks, totalFine, exempt: false };
}

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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.employee_code || !form.work_date) {
      setError('Employee and date are required.');
      return;
    }
    if (!form.is_exempt && !form.check_in_time) {
      setError('Check-in time is required unless this day is marked exempt.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_code: form.employee_code,
        work_date: form.work_date,
        check_in_time: form.is_exempt ? null : form.check_in_time,
        check_out_time: form.check_out_time || null,
        note: form.note || null,
        is_exempt: form.is_exempt,
      };
      const saved = await api.logAttendance(payload);
      setResult(saved);
      setRefreshKey((k) => k + 1);
      setForm(f => ({ ...f, employee_code: '', check_in_time: '', note: '' })); // Reset sau khi log thành công
      onLogged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Attendance Logger</h2>
        <p className="text-sm text-slate-500 mt-1">
          Click vào một vị trí trên sơ đồ để chọn nhân viên, sau đó điền giờ Check-in.
        </p>
      </header>

      {/* Sơ đồ chỗ ngồi chiếm toàn bộ chiều rộng phía trên */}
      <div className="mb-6">
        <LiveOfficeMap 
          date={form.work_date} 
          selectedCode={form.employee_code} 
          onSeatClick={(code) => update('employee_code', code)} 
          employees={employees}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee</label>
              <select
                value={form.employee_code}
                onChange={(e) => update('employee_code', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
              >
                <option value="">-- Click on Map or Select --</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.employee_code} value={emp.employee_code}>
                    {emp.name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Work date</label>
              <input
                type="date"
                value={form.work_date}
                onChange={(e) => update('work_date', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Check-in time {form.is_exempt && <span className="text-slate-400 font-normal">(exempt)</span>}
              </label>
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => update('check_in_time', e.target.value)}
                disabled={form.is_exempt}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Check-out time <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => update('check_out_time', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_exempt}
              onChange={(e) => update('is_exempt', e.target.checked)}
              className="rounded border-slate-300 text-accent focus:ring-accent"
            />
            Exempt from lateness rules (approved leave, business trip, etc.)
          </label>

          {error && (
            <div className="rounded-lg border border-fine/30 bg-fine-soft px-3 py-2 text-sm text-fine">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving…' : 'Save attendance log'}
          </button>
        </form>

        {/* Live preview + last result */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Live fine preview</h3>
            {preview?.exempt ? (
              <p className="text-sm text-ok font-medium">Exempt — no fine will be charged.</p>
            ) : preview ? (
              <dl className="space-y-2.5 text-sm">
                <Row label="Minutes late" value={`${preview.minutesLate} min`} />
                <Row label="Fine blocks" value={formatBlocks(preview.fineBlocks)} />
                <Row label="Total fine" value={formatVNDExact(preview.totalFine)} emphasize={preview.totalFine > 0} />
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Enter a check-in time to preview the fine.</p>
            )}
          </div>

          {result && (
            <div className="bg-ok-soft border border-ok/30 rounded-xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ok mb-3">Saved successfully</h3>
              {!result.is_exempt && (
                <dl className="space-y-2.5 text-sm">
                  <Row label="Total fine" value={formatVNDExact(result.total_fine)} emphasize />
                </dl>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <LateWorkersPanel refreshKey={refreshKey} />
      </div>
    </div>
  );
}

function Row({ label, value, emphasize }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono-num ${emphasize ? 'text-fine font-semibold' : 'text-slate-800'}`}>{value}</dd>
    </div>
  );
}
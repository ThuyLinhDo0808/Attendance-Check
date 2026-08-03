import React, { useMemo, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks } from '../utils/format';
import LateWorkersPanel from './LateWorkersPanel.jsx';

const WORKDAY_START = '08:30'; // mirrors backend default; used only for the live preview

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function previewFine(checkInTime) {
  if (!checkInTime) return null;
  const [h, m] = checkInTime.split(':').map(Number);
  const [sh, sm] = WORKDAY_START.split(':').map(Number);
  
  // Calculate total minutes late
  const minutesLate = Math.max(0, h * 60 + m - (sh * 60 + sm));
  
  // CHANGED: Use Math.floor() to match the new backend grace-period logic
  const fineBlocks = Math.floor(minutesLate / 15);
  
  const totalFine = fineBlocks * 10000;
  return { minutesLate, fineBlocks, totalFine };
}

export default function AttendanceLogger({ employees, onLogged }) {
  const [form, setForm] = useState({
    employee_id: '',
    work_date: todayISO(),
    check_in_time: '',
    check_out_time: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const preview = useMemo(() => previewFine(form.check_in_time), [form.check_in_time]);
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setResult(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.employee_id || !form.work_date || !form.check_in_time) {
      setError('Employee, date, and check-in time are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_id: Number(form.employee_id),
        work_date: form.work_date,
        check_in_time: form.check_in_time,
        check_out_time: form.check_out_time || null,
        note: form.note || null,
      };
      const saved = await api.logAttendance(payload);
      setResult(saved);
      setRefreshKey((k) => k + 1);
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
          Log or correct a check-in / check-out for any employee and date. Lateness and fines
          are computed automatically against the 08:30 cutoff.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee</label>
              <select
                value={form.employee_id}
                onChange={(e) => update('employee_id', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
              >
                <option value="">Select employee…</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
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
                Check-in time
              </label>
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => update('check_in_time', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              rows={2}
              placeholder="e.g. Traffic, medical appointment…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Live fine preview
            </h3>
            {preview ? (
              <dl className="space-y-2.5 text-sm">
                <Row label="Minutes late" value={`${preview.minutesLate} min`} />
                <Row label="Fine blocks" value={formatBlocks(preview.fineBlocks)} />
                <Row
                  label="Total fine"
                  value={formatVNDExact(preview.totalFine)}
                  emphasize={preview.totalFine > 0}
                />
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Enter a check-in time to preview the fine.</p>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Preview only — the saved value is always computed server-side.
            </p>
          </div>

          {result && (
            <div className="bg-ok-soft border border-ok/30 rounded-xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ok mb-3">
                Saved successfully
              </h3>
              <dl className="space-y-2.5 text-sm">
                <Row label="Minutes late" value={`${result.minutes_late} min`} />
                <Row label="Fine blocks" value={formatBlocks(result.fine_blocks)} />
                <Row label="Total fine" value={formatVNDExact(result.total_fine)} emphasize />
              </dl>
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
      <dd className={`font-mono-num ${emphasize ? 'text-fine font-semibold' : 'text-slate-800'}`}>
        {value}
      </dd>
    </div>
  );
}

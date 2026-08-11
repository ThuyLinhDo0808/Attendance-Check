import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks } from '../utils/format';
import LateWorkersPanel from './LateWorkersPanel.jsx';
import LiveOfficeMap from './LiveOfficeMap.jsx';
import { ClipboardDocumentCheckIcon, CalendarDaysIcon, ClockIcon, DocumentTextIcon, BanknotesIcon, MapIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

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

// Component Row phụ cho Preview
const PreviewRow = ({ icon: Icon, label, value, emphasize }) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
        <dt className="flex items-center gap-2.5 text-sm text-slate-600">
            <Icon className="h-5 w-5 text-slate-400" />
            {label}
        </dt>
        <dd className={`font-mono text-sm ${emphasize ? 'text-red-600 font-bold' : 'text-slate-900 font-semibold'}`}>
            {value}
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
    if(error) setError(null);
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
        ...form,
        check_in_time: form.is_exempt ? null : form.check_in_time,
        check_out_time: form.check_out_time || null,
        note: form.note || null,
        is_exempt: form.is_exempt,
      };
      const saved = await api.logAttendance(payload);
      setResult(saved);
      setRefreshKey((k) => k + 1);
      // Reset một phần form
      setForm(f => ({ ...f, employee_code: '', check_in_time: '', note: '', is_exempt: false }));
      onLogged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 py-6">
      <header className="border-b border-slate-200 pb-6 mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">Attendance Logger</h2>
        <p className="mt-1.5 text-base text-slate-600">
          Enter check-in/check-out times manually or click on the map to select an employee quickly.
        </p>
      </header>

      {/* Sơ đồ chỗ ngồi Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-2 flex flex-col min-h-[400px]">
          <div className="p-5 flex items-center justify-between border-b border-slate-100 mb-2">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <MapIcon className='h-5 w-5 text-indigo-500'/>
                  Interactive Map
              </h3>
              <input
                type="date"
                value={form.work_date}
                onChange={(e) => update('work_date', e.target.value)}
                className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
          </div>
          <div className='flex-1 border border-slate-100 rounded-2xl bg-slate-50/50 m-2'>
            <LiveOfficeMap 
              date={form.work_date} 
              selectedCode={form.employee_code} 
              onSeatClick={(code) => update('employee_code', code)} 
              employees={employees}
            />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Form Logging (Left) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-7 shadow-sm space-y-6"
        >
          <div className='flex items-center gap-3 border-b border-slate-100 pb-4 mb-4'>
              <div className='bg-indigo-50 p-3 rounded-xl text-indigo-600 border border-indigo-100'>
                <ClipboardDocumentCheckIcon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-950">Attendance Logging</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Employee</label>
              <select
                value={form.employee_code}
                onChange={(e) => update('employee_code', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="">-- Select on map or here --</option>
                {activeEmployees.sort((a,b)=>a.name.localeCompare(b.name)).map((emp) => (
                  <option key={emp.employee_code} value={emp.employee_code}>
                    {emp.name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarDaysIcon className='h-4 w-4 text-slate-400'/>
                  Work Date
              </label>
              <input
                type="date"
                value={form.work_date}
                onChange={(e) => update('work_date', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="space-y-2 relative">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ClockIcon className='h-4 w-4 text-slate-400'/>
                  Check-in Time {form.is_exempt && <span className="text-xs text-indigo-500 font-normal">(Exempt)</span>}
              </label>
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => update('check_in_time', e.target.value)}
                disabled={form.is_exempt}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">
                Check-out Time <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => update('check_out_time', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="space-y-2 md:col-span-2 relative">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1.5">
                    <DocumentTextIcon className='h-4 w-4 text-slate-400'/>
                    Note
                </label>
                <textarea 
                    value={form.note}
                    onChange={(e) => update('note', e.target.value)}
                    placeholder='Reason for being late, business trip, etc.'
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
                />
            </div>
          </div>

          <div className="relative flex items-start bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex h-6 items-center">
              <input
                id="is_exempt"
                type="checkbox"
                checked={form.is_exempt}
                onChange={(e) => update('is_exempt', e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="ml-3 text-sm leading-6 cursor-pointer" onClick={() => update('is_exempt', !form.is_exempt)}>
              <label htmlFor="is_exempt" className="font-semibold text-slate-900 cursor-pointer">Exempt from Late Arrival Rules</label>
              <p className="text-slate-500">Use for cases of approved leave or business trips.</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm flex items-start gap-3 anim-shake">
              <XMarkIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm"
          >
            <ClipboardDocumentCheckIcon className="h-5 w-5" />
            {submitting ? 'Saving…' : 'Save Attendance Record'}
          </button>
        </form>

        {/* Live preview (Right) */}
        <div className="lg:col-span-1 space-y-6 sticky top-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 pb-3">Live Preview</h3>

            {preview?.exempt ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center text-sm font-medium text-emerald-800">
                 This day is EXEMPT. No fine will be calculated.
              </div>
            ) : preview ? (
              <dl className="space-y-1">
                <PreviewRow icon={ClockIcon} label="Minutes Late" value={`${preview.minutesLate} minutes`} emphasize={preview.minutesLate > 0} />
                <PreviewRow icon={BanknotesIcon} label="Fine Blocks" value={formatBlocks(preview.fineBlocks)} emphasize={preview.fineBlocks > 0}/>
                <PreviewRow icon={BanknotesIcon} label="Total Fine" value={formatVNDExact(preview.totalFine)} emphasize={preview.totalFine > 0} />
              </dl>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm italic">
                Enter check-in time to see the fine calculation preview.
              </div>
            )}
          </div>

          {/* Thông báo kết quả sau khi lưu thành công */}
          {result && (
            <div className={`rounded-3xl border p-6 anim-fade-in shadow-lg ${result.is_exempt ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className='flex items-center gap-3 mb-4'>
                    <CheckIcon className={`h-8 w-8 ${result.is_exempt ? 'text-emerald-500' : 'text-red-500'}`}/>
                    <h3 className={`text-lg font-bold ${result.is_exempt ? 'text-emerald-950' : 'text-red-950'}`}>Successfully Saved</h3>
                </div>
                
              {!result.is_exempt ? (
                 <dl className="space-y-1">
                     <PreviewRow icon={BanknotesIcon} label="Total Saved Fine" value={formatVNDExact(result.total_fine)} emphasize />
                 </dl>
              ) : (
                 <p className='text-sm text-emerald-800'>Attendance record saved with exemption.</p>
              )}
               <p className='text-xs text-slate-500 mt-4 italic'>System is syncing with Google Sheets...</p>
            </div>
          )}
        </div>
      </div>

      {/* Danh sách đi muộn hôm nay */}
      <div className="mt-12 bg-white rounded-3xl border border-slate-100 shadow-sm p-2">
        <LateWorkersPanel refreshKey={refreshKey} />
      </div>
    </div>
  );
}
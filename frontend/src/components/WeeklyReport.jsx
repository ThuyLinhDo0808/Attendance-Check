import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVND, formatTime, formatDate, currentWeekValue, weekToDates } from '../utils/format';
import { CalendarDaysIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function WeeklyReport() {
  const [week, setWeek] = useState(currentWeekValue());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dates = weekToDates(week);

  useEffect(() => {
    if (!dates) return;
    setLoading(true);
    api.getAnalyticsByRange(dates.start_date, dates.end_date)
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [week]);

  const totalFines = logs.reduce((sum, log) => sum + Number(log.total_fine), 0);

  return (
    <div className="space-y-6 py-2">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
             <CalendarDaysIcon className="h-8 w-8 text-indigo-600"/>
             Weekly Insight
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Details checked from <span className="font-bold text-slate-700">{formatDate(dates?.start_date)}</span> to <span className="font-bold text-slate-700">{formatDate(dates?.end_date)}</span>.
          </p>
        </div>
        <div className="flex items-end gap-4 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Reported Week</label>
            <input
              type="week"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Export Data</label>
            <a
              href={api.exportRangeUrl({ start_date: dates?.start_date, end_date: dates?.end_date, format: 'xlsx' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" /> Excel
            </a>
          </div>
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 font-medium">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
           <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
           </div>
        ) : logs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <span className="text-4xl mb-3">🎉</span>
            <p className="font-semibold">Excellent! No one was late this week.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-bold text-left">Date</th>
                  <th className="px-6 py-4 font-bold text-left">Employee</th>
                  <th className="px-6 py-4 font-bold text-center">Check-in Time</th>
                  <th className="px-6 py-4 font-bold text-right">Minutes Late</th>
                  <th className="px-6 py-4 font-bold text-right">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 font-mono whitespace-nowrap">
                      {formatDate(log.work_date)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{log.employee_name}</span>
                      <span className="ml-2 text-xs text-slate-500 font-mono font-semibold">{log.employee_code}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-700 font-semibold">
                      {formatTime(log.check_in_time)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-red-600">
                      {log.minutes_late} min
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-red-600 text-base">
                      {formatVND(log.total_fine)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-red-50/50 border-t-2 border-red-200">
                  <td colSpan={4} className="px-6 py-5 text-right font-bold text-slate-800 uppercase tracking-widest text-xs">
                    Total Weekly Fine:
                  </td>
                  <td className="px-6 py-5 text-right font-mono font-black text-red-600 text-xl tracking-tight">
                    {formatVND(totalFines)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
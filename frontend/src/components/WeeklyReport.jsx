import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVND, formatTime, formatDate, currentWeekValue, weekToDates } from '../utils/format';

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
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Weekly Late Report</h2>
          <p className="text-sm text-slate-500 mt-1">
            Detailed list of late arrivals by day (From {formatDate(dates?.start_date)} to {formatDate(dates?.end_date)}).
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Select Week</label>
            <input
              type="week"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Export Week</label>
            <div className="flex gap-2">
              <a
                href={api.exportRangeUrl({ start_date: dates?.start_date, end_date: dates?.end_date, format: 'xlsx' })}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-indigo-600 transition-colors"
              >
                Export Excel
              </a>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-1">
        {loading ? (
          <p className="p-8 text-sm text-slate-400 text-center">Loading data...</p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-sm text-slate-400 text-center">
            Excellent! No one was late this week 🎉
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium rounded-tl-lg">Date</th>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium text-center">Check-in</th>
                <th className="px-5 py-3 font-medium text-right">Minutes Late</th>
                <th className="px-5 py-3 font-medium text-right rounded-tr-lg">Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-700 font-mono-num whitespace-nowrap">
                    {formatDate(log.work_date)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-900">{log.employee_name}</span>
                    <span className="ml-2 text-xs text-slate-400 font-mono-num">{log.employee_code}</span>
                  </td>
                  <td className="px-5 py-3 text-center font-mono-num text-slate-700">
                    {formatTime(log.check_in_time)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono-num text-fine font-semibold">
                    {log.minutes_late} min
                  </td>
                  <td className="px-5 py-3 text-right font-mono-num font-semibold text-fine">
                    {formatVND(log.total_fine)}
                  </td>
                </tr>
              ))}
              {/* Dòng tổng kết tiền phạt cuối bảng */}
              <tr className="bg-fine-soft/40 border-t-2 border-fine/20">
                <td colSpan={4} className="px-5 py-4 text-right font-semibold text-slate-900 uppercase text-xs tracking-wide">
                  Total Weekly Fines:
                </td>
                <td className="px-5 py-4 text-right font-mono-num font-bold text-fine text-lg">
                  {formatVND(totalFines)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVND, formatBlocks, currentMonthValue, formatMonthLabel } from '../utils/format';
import EmployeeModal from './EmployeeModal.jsx';

export default function EmployeeFineSheet() {
  const [month, setMonth] = useState(''); // '' = all-time
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getFineSheet(month || undefined)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Employee Fine Sheet</h2>
          <p className="text-sm text-slate-500 mt-1">
            Every employee, all-time or scoped to a month. Click a row for full history.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Scope</label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
            />
            {month && (
              <button
                onClick={() => setMonth('')}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 text-xs text-slate-500">
          {month ? `Scoped to ${formatMonthLabel(month)}` : 'All-time totals'}
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-400">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Employee</th>
                <th className="px-5 py-2.5 font-medium">Code</th>
                <th className="px-5 py-2.5 font-medium text-right">Times late</th>
                <th className="px-5 py-2.5 font-medium text-right">Total minutes late</th>
                <th className="px-5 py-2.5 font-medium text-right">Fine blocks</th>
                <th className="px-5 py-2.5 font-medium text-right">Total fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const isLate = r.times_late > 0;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`cursor-pointer transition-colors ${
                      isLate ? 'bg-fine-soft/40 hover:bg-fine-soft' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        {isLate && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-fine shrink-0"
                            aria-hidden="true"
                            title="Has late check-ins"
                          />
                        )}
                        {r.name}
                        {r.status === 'INACTIVE' && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                            Inactive
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-mono-num">{r.employee_code}</td>
                    <td
                      className={`px-5 py-3 text-right font-mono-num ${
                        isLate ? 'text-fine font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {r.times_late}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-num text-slate-700">
                      {r.total_minutes_late} min
                    </td>
                    <td className="px-5 py-3 text-right font-mono-num text-slate-700">
                      {formatBlocks(r.total_fine_blocks)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono-num font-semibold ${
                        isLate ? 'text-fine' : 'text-slate-400'
                      }`}
                    >
                      {formatVND(r.total_fine)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <EmployeeModal employeeId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

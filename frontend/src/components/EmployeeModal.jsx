import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, formatDate, formatTime } from '../utils/format';

export default function EmployeeModal({ employeeId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getEmployeeAnalytics(employeeId)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [employeeId]);

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <p className="p-8 text-sm text-slate-400">Loading history…</p>
        ) : error ? (
          <p className="p-8 text-sm text-fine">{error}</p>
        ) : (
          data && (
            <>
              <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{data.employee.name}</h3>
                  <p className="text-sm text-slate-500 font-mono-num">
                    {data.employee.employee_code} · {data.employee.status}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
                >
                  ×
                </button>
              </div>

              <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 bg-slate-50">
                <Stat label="Times late" value={data.stats.times_late} />
                <Stat label="Minutes late" value={`${data.stats.total_minutes_late}`} />
                <Stat label="Fine blocks" value={formatBlocks(data.stats.total_fine_blocks)} />
                <Stat
                  label="Total fine"
                  value={formatVNDExact(data.stats.total_fine)}
                  emphasize
                />
              </div>

              <div className="overflow-y-auto flex-1">
                {data.history.length === 0 ? (
                  <p className="p-8 text-sm text-slate-400 text-center">
                    No attendance logs recorded for this employee yet.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="px-6 py-2.5 font-medium">Date</th>
                        <th className="px-6 py-2.5 font-medium">Check-in</th>
                        <th className="px-6 py-2.5 font-medium">Check-out</th>
                        <th className="px-6 py-2.5 font-medium text-right">Late</th>
                        <th className="px-6 py-2.5 font-medium text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.history.map((h) => {
                        const late = h.minutes_late > 0;
                        return (
                          <tr key={h.id} className={late ? 'bg-fine-soft/40' : ''}>
                            <td className="px-6 py-2.5 text-slate-700 font-mono-num">
                              {formatDate(h.work_date)}
                            </td>
                            <td className="px-6 py-2.5 font-mono-num text-slate-700">
                              {formatTime(h.check_in_time)}
                            </td>
                            <td className="px-6 py-2.5 font-mono-num text-slate-500">
                              {formatTime(h.check_out_time)}
                            </td>
                            <td
                              className={`px-6 py-2.5 text-right font-mono-num ${
                                late ? 'text-fine font-semibold' : 'text-ok'
                              }`}
                            >
                              {late ? `${h.minutes_late} min` : 'On time'}
                            </td>
                            <td className="px-6 py-2.5 text-right font-mono-num text-slate-700">
                              {late ? formatVNDExact(h.total_fine) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-mono-num font-bold ${emphasize ? 'text-fine' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

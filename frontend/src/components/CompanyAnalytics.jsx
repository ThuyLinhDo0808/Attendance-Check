import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVND, formatBlocks, currentMonthValue, formatMonthLabel } from '../utils/format';

export default function CompanyAnalytics() {
  const [month, setMonth] = useState(currentMonthValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getMonthlyAnalytics(month)
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
  }, [month]);

  const lateWorkers = data?.leaderboard || [];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Department Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">
            Aggregate lateness and fine totals for {formatMonthLabel(month)}.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading analytics…</p>
      ) : (
        data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <SummaryCard
                label="Total late check-ins"
                value={data.total_late_checkins}
                tone="fine"
              />
              <SummaryCard
                label="Total cash fines collected"
                value={formatVND(data.total_fine_collected)}
                tone="fine"
                mono
              />
              <SummaryCard
                label="Attendance logs recorded"
                value={data.total_logs}
                tone="neutral"
              />
            </div>

            {/* Late workers — the whole point of this dashboard */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Workers who were late this month
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every employee with at least one late check-in in {formatMonthLabel(month)},
                    worst first.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-fine-soft text-fine text-xs font-semibold px-2.5 py-1">
                  {lateWorkers.length} late this month
                </span>
              </div>

              {lateWorkers.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">
                  No late check-ins recorded for {formatMonthLabel(month)}. Nobody to flag 🎉
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2.5 font-medium">Employee</th>
                      <th className="px-5 py-2.5 font-medium">Code</th>
                      <th className="px-5 py-2.5 font-medium text-right">Times late</th>
                      <th className="px-5 py-2.5 font-medium text-right">Minutes late</th>
                      <th className="px-5 py-2.5 font-medium text-right">Fine blocks</th>
                      <th className="px-5 py-2.5 font-medium text-right">Total fine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lateWorkers.map((w) => (
                      <tr key={w.id} className="bg-fine-soft/40 hover:bg-fine-soft transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-fine"
                              aria-hidden="true"
                            />
                            {w.name}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 font-mono-num">
                          {w.employee_code}
                        </td>
                        <td className="px-5 py-3 text-right font-mono-num text-fine font-semibold">
                          {w.times_late}
                        </td>
                        <td className="px-5 py-3 text-right font-mono-num text-slate-700">
                          {w.total_minutes_late} min
                        </td>
                        <td className="px-5 py-3 text-right font-mono-num text-slate-700">
                          {formatBlocks(w.total_fine_blocks)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono-num font-semibold text-fine">
                          {formatVND(w.total_fine)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = 'neutral', mono = false }) {
  const toneClasses =
    tone === 'fine' ? 'border-fine/20 bg-fine-soft/60' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold text-slate-900 ${mono ? 'font-mono-num' : ''}`}>
        {value}
      </p>
    </div>
  );
}

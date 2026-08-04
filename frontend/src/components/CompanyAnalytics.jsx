import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../api';
import { formatVND, formatBlocks, currentMonthValue, formatMonthLabel } from '../utils/format';

const CHART_FINE = '#C2760C'; // matches tailwind fine.DEFAULT
const CHART_ACCENT = '#4F5FEA'; // matches tailwind accent.DEFAULT
const CHART_GRID = '#E2E8F0';

const TREND_RANGES = [
  { label: '3 mo', months: 3 },
  { label: '6 mo', months: 6 },
  { label: '12 mo', months: 12 },
];

export default function CompanyAnalytics() {
  const [month, setMonth] = useState(currentMonthValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [trendMonths, setTrendMonths] = useState(6);
  const [trends, setTrends] = useState(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    setTrendsLoading(true);
    setTrendsError(null);
    api
      .getTrends(trendMonths)
      .then((res) => {
        if (!cancelled) setTrends(res);
      })
      .catch((err) => {
        if (!cancelled) setTrendsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setTrendsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trendMonths]);

  const lateWorkers = data?.leaderboard || [];
  const trendChartData = (trends || []).map((t) => ({
    ...t,
    monthLabel: formatMonthLabel(t.month).replace(/\s\d{4}$/, ''), // "January" instead of "January 2026" to keep axis compact
  }));
  const barChartData = lateWorkers.slice(0, 12); // keep bar chart legible if the roster is large

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Company Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">
            Aggregate lateness and fine totals for {formatMonthLabel(month)}.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <ExportButtons month={month} />
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

            {/* Trend charts */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Lateness trend</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track whether recent policy changes are reducing lateness over time.
                  </p>
                </div>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {TREND_RANGES.map((r) => (
                    <button
                      key={r.months}
                      onClick={() => setTrendMonths(r.months)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        trendMonths === r.months
                          ? 'bg-accent text-white'
                          : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {trendsError ? (
                <p className="text-sm text-fine">{trendsError}</p>
              ) : trendsLoading ? (
                <p className="text-sm text-slate-400">Loading trend…</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">
                      Late check-ins per month
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendChartData} margin={{ left: -20 }}>
                        <CartesianGrid stroke={CHART_GRID} vertical={false} />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          axisLine={{ stroke: CHART_GRID }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(value) => [value, 'Late check-ins']}
                          labelFormatter={(label) => label}
                        />
                        <Line
                          type="monotone"
                          dataKey="total_late_checkins"
                          stroke={CHART_FINE}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Late check-ins"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">
                      Total fines collected per month (VNĐ)
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendChartData} margin={{ left: -20 }}>
                        <CartesianGrid stroke={CHART_GRID} vertical={false} />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          axisLine={{ stroke: CHART_GRID }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                        />
                        <Tooltip formatter={(value) => [formatVND(value), 'Fines collected']} />
                        <Line
                          type="monotone"
                          dataKey="total_fine_collected"
                          stroke={CHART_ACCENT}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Fines collected"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </section>

            {/* Bar chart: comparison across employees for the selected month */}
            {barChartData.length > 0 && (
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-8">
                <h3 className="text-sm font-semibold text-slate-900">
                  Late employees comparison — {formatMonthLabel(month)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Total fine amount by employee, worst first.
                </p>
                <ResponsiveContainer width="100%" height={Math.max(220, barChartData.length * 34)}>
                  <BarChart data={barChartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11, fill: '#334155' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(value) => [formatVND(value), 'Total fine']} />
                    <Bar dataKey="total_fine" fill={CHART_FINE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

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
                      <tr key={w.employee_code} className="bg-fine-soft/40 hover:bg-fine-soft transition-colors">
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

function ExportButtons({ month }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">Export this month</label>
      <div className="flex gap-2">
        <a
          href={api.exportMonthlyUrl({ month, format: 'csv', report: 'detail' })}
          className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          CSV
        </a>
        <a
          href={api.exportMonthlyUrl({ month, format: 'xlsx' })}
          className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Excel
        </a>
      </div>
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

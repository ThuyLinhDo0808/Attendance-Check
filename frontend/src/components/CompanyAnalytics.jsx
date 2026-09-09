import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { api } from '../api';
import { formatVND, formatBlocks, currentMonthValue, formatMonthLabel } from '../utils/format';
import { ArrowDownIcon, PresentationChartLineIcon } from '@heroicons/react/24/outline';

const CHART_FINE = '#ef4444'; // Đỏ cảnh báo cho cột vi phạm
const CHART_ACCENT = '#4F5FEA'; // Xanh Indigo cho đường tiền phạt
const CHART_GRID = '#f1f5f9';

const TREND_RANGES = [
  { label: '3 tháng', months: 3 },
  { label: '6 tháng', months: 6 },
  { label: '1 năm', months: 12 },
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
    api.getMonthlyAnalytics(month).then((res) => {
        if (!cancelled) setData(res);
      }).catch((err) => {
        if (!cancelled) setError(err.message);
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    setTrendsLoading(true);
    setTrendsError(null);
    api.getTrends(trendMonths).then((res) => {
        if (!cancelled) setTrends(res);
      }).catch((err) => {
        if (!cancelled) setTrendsError(err.message);
      }).finally(() => {
        if (!cancelled) setTrendsLoading(false);
      });
    return () => { cancelled = true; };
  }, [trendMonths]);

  const lateWorkers = data?.leaderboard || [];
  const trendChartData = (trends || []).map((t) => ({
    ...t,
    monthLabel: formatMonthLabel(t.month).replace(/\s\d{4}$/, ''), 
  }));
  const barChartData = lateWorkers.slice(0, 12); 

  return (
    <div className="space-y-8 py-2">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <PresentationChartLineIcon className="h-8 w-8 text-indigo-600"/>
            Analytics Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Phân tích tổng quan dữ liệu đi muộn và tiền phạt trong tháng {formatMonthLabel(month)}.
          </p>
        </div>
        <div className="flex items-end gap-4 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Kỳ báo cáo</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
            />
          </div>
          <ExportButtons month={month} />
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        data && (
          <>
            {/* Lưới KPI nổi bật */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SummaryCard
                label="Tổng lượt đi muộn"
                value={data.total_late_checkins}
                subtext="lượt vi phạm trong tháng"
                tone="alert"
              />
              <SummaryCard
                label="Tổng Quỹ Phạt"
                value={formatVND(data.total_fine_collected)}
                subtext="tổng cộng từ các block phạt"
                tone="primary"
                mono
              />
              <SummaryCard
                label="Tổng bản ghi hệ thống"
                value={data.total_logs}
                subtext="lượt check-in được xử lý"
                tone="neutral"
              />
            </div>

            {/* Biểu đồ Trục kép (Dual-Axis) */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tương quan Vi phạm & Tiền phạt</h3>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    Theo dõi biến động số lượt đi muộn (Cột đỏ) và Tiền phạt thu được (Đường xanh).
                  </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
                  {TREND_RANGES.map((r) => (
                    <button
                      key={r.months}
                      onClick={() => setTrendMonths(r.months)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                        trendMonths === r.months
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {trendsLoading ? (
                <div className="h-[350px] flex items-center justify-center text-slate-400">Loading trend...</div>
              ) : (
                <div className="w-full h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendChartData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                      
                      <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} dx={-10}/>
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} dx={10}/>
                      
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 600, color: '#475569' }} />
                      
                      <Bar yAxisId="left" dataKey="total_late_checkins" fill="#fca5a5" name="Lượt đi muộn" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Line yAxisId="right" type="monotone" dataKey="total_fine_collected" stroke={CHART_ACCENT} strokeWidth={4} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7 }} name="Tiền phạt (VNĐ)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
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
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Xuất dữ liệu</label>
      <div className="flex gap-2">
        <a
          href={api.exportMonthlyUrl({ month, format: 'csv', report: 'detail' })}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
        >
          CSV
        </a>
        <a
          href={api.exportMonthlyUrl({ month, format: 'xlsx' })}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Excel
        </a>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtext, tone = 'neutral', mono = false }) {
  const tones = {
    alert: 'bg-red-50 border-red-100 text-red-900',
    primary: 'bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-600/20',
    neutral: 'bg-white border-slate-200 text-slate-900'
  };
  
  const subtextTones = {
    alert: 'text-red-500',
    primary: 'text-indigo-200',
    neutral: 'text-slate-500'
  };

  return (
    <div className={`rounded-2xl border p-6 ${tones[tone]} flex flex-col justify-between`}>
      <p className={`text-xs font-bold uppercase tracking-widest opacity-80 mb-4`}>{label}</p>
      <div>
          <p className={`text-4xl font-black tracking-tight ${mono ? 'font-mono-num' : ''}`}>
            {value}
          </p>
          <p className={`text-xs font-semibold mt-2 ${subtextTones[tone]}`}>{subtext}</p>
      </div>
    </div>
  );
}
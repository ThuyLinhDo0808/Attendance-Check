import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  BanknotesIcon,
  TrophyIcon,
  FaceSmileIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { formatVND } from '../utils/format';

const COLUMNS = [
  { key: 'name', label: 'Nhân viên', numeric: false },
  { key: 'days_logged', label: 'Ngày có mặt', numeric: true },
  { key: 'times_late', label: 'Lượt muộn', numeric: true },
  { key: 'total_minutes_late', label: 'Tổng phút muộn', numeric: true },
  { key: 'total_fine', label: 'Tiền phạt', numeric: true },
];

/** Everyone tied for the best value of `pick` among `rows`. */
function leaders(rows, pick, direction) {
  if (rows.length === 0) return { value: null, people: [] };
  const values = rows.map(pick);
  const best = direction === 'max' ? Math.max(...values) : Math.min(...values);
  return { value: best, people: rows.filter((r) => pick(r) === best) };
}

const MAX_NAMES = 2;

/**
 * Per-member view of one month: who was late / fined the most and the
 * least, a top-10 chart and a sortable table of everyone on staff.
 */
export default function MemberStats({ members = [] }) {
  const [sort, setSort] = useState({ key: 'times_late', dir: 'desc' });

  const highlights = useMemo(() => {
    const late = members.filter((m) => m.times_late > 0);
    const fined = members.filter((m) => m.total_fine > 0);
    // Only people who actually came in that month count as "punctual".
    const present = members.filter((m) => m.days_logged > 0);
    return {
      mostLate: leaders(late, (m) => m.times_late, 'max'),
      mostFined: leaders(fined, (m) => m.total_fine, 'max'),
      leastLate: leaders(present, (m) => m.times_late, 'min'),
      leastFined: leaders(fined, (m) => m.total_fine, 'min'),
    };
  }, [members]);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...members].sort((a, b) => {
      const diff = col.numeric
        ? a[sort.key] - b[sort.key]
        : String(a[sort.key]).localeCompare(String(b[sort.key]), 'vi');
      // Ties: worst lateness first, then by name.
      return factor * diff || b.total_minutes_late - a.total_minutes_late || a.name.localeCompare(b.name, 'vi');
    });
  }, [members, sort]);

  const chartData = members
    .filter((m) => m.times_late > 0)
    .slice(0, 10)
    .map((m) => ({ name: m.name, times_late: m.times_late, total_fine: m.total_fine }));

  function toggleSort(key) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );
  }

  const { mostLate, mostFined, leastLate, leastFined } = highlights;

  return (
    <section className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <UsersIcon className="h-5 w-5 text-indigo-500" />
          Thống kê thành viên
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Ai đi muộn và đóng phạt nhiều nhất, ít nhất trong tháng.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HighlightCard
          icon={ClockIcon}
          tone="rose"
          label="Đi muộn nhiều nhất"
          people={mostLate.people}
          value={mostLate.value != null ? `${mostLate.value} lần` : null}
          empty="Không ai đi muộn"
        />
        <HighlightCard
          icon={BanknotesIcon}
          tone="amber"
          label="Đóng phạt nhiều nhất"
          people={mostFined.people}
          value={mostFined.value != null ? formatVND(mostFined.value) : null}
          empty="Không ai bị phạt"
        />
        <HighlightCard
          icon={TrophyIcon}
          tone="emerald"
          label="Chuyên cần nhất"
          people={leastLate.people}
          value={leastLate.value != null ? (leastLate.value === 0 ? 'Không muộn lần nào' : `${leastLate.value} lần muộn`) : null}
          empty="Chưa có dữ liệu"
        />
        <HighlightCard
          icon={FaceSmileIcon}
          tone="sky"
          label="Đóng phạt ít nhất"
          hint="trong số người bị phạt"
          people={leastFined.people}
          value={leastFined.value != null ? formatVND(leastFined.value) : null}
          empty="Không ai bị phạt"
        />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900">Top đi muộn trong tháng</h4>
          <div className="mt-4 w-full" style={{ height: Math.max(160, chartData.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(91, 79, 227, 0.04)' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 13 }}
                  formatter={(value, name, item) =>
                    name === 'times_late' ? [`${value} lần · ${formatVND(item.payload.total_fine)}`, 'Đi muộn'] : [value, name]
                  }
                />
                <Bar dataKey="times_late" fill="#FDA4AF" radius={[0, 6, 6, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3 text-left font-semibold">#</th>
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  const Arrow = sort.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
                  return (
                    <th key={col.key} className={`px-4 py-3 font-semibold ${col.numeric ? 'text-right' : 'text-left'}`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 ${active ? 'text-indigo-700' : ''}`}
                      >
                        {col.label}
                        {active && <Arrow className="h-3 w-3" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-slate-500">
                    Chưa có dữ liệu trong tháng này.
                  </td>
                </tr>
              ) : (
                sorted.map((m, index) => (
                  <tr key={m.employee_code} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-num text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        {m.employee_code}
                        {m.status !== 'ACTIVE' && ' · đã nghỉ'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-slate-700">{m.days_logged}</td>
                    <td className={`px-4 py-3 text-right font-mono-num font-semibold ${m.times_late > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {m.times_late}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-slate-700">{m.total_minutes_late}</td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold text-slate-900">{formatVND(m.total_fine)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const TONES = {
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
};

function HighlightCard({ icon: Icon, tone, label, hint, people, value, empty }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${TONES[tone]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      {people.length === 0 ? (
        <p className="mt-4 text-sm font-medium text-slate-400">{empty}</p>
      ) : (
        <div className="mt-4">
          <p className="truncate text-base font-semibold text-slate-900" title={people.map((p) => p.name).join(', ')}>
            {people.slice(0, MAX_NAMES).map((p) => p.name).join(', ')}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            <span className="font-mono-num">{value}</span>
            {people.length > MAX_NAMES && (
              <span className="font-medium text-slate-400"> · và {people.length - MAX_NAMES} người khác</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

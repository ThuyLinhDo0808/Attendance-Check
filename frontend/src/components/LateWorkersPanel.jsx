import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, formatTime } from '../utils/format';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Surfaces, in one glance, every employee already logged as late for a
 * given day — the "who's late" callout the admin cares about most.
 * Exposes a refreshKey prop so the parent can force a re-fetch right
 * after a new log is saved.
 */
export default function LateWorkersPanel({ refreshKey }) {
  const [date, setDate] = useState(todayISO());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getAttendanceLogs({ date, lateOnly: true })
      .then((rows) => {
        if (!cancelled) setLogs(rows);
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
  }, [date, refreshKey]);

  const isToday = date === todayISO();

  return (
    <section className="bg-white rounded-xl border border-fine/20 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-fine" aria-hidden="true" />
            Late {isToday ? 'today' : 'on this day'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every logged check-in past 08:30 on the selected date.
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      {loading ? (
        <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-fine">{error}</p>
      ) : logs.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400 text-center">
          No late check-ins logged for this date yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {logs.map((log) => (
            <li
              key={log.id}
              className="px-5 py-3 flex items-center justify-between gap-3 bg-fine-soft/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {log.employee_name}{' '}
                  <span className="text-slate-400 font-normal font-mono-num text-xs">
                    {log.employee_code}
                  </span>
                </p>
                <p className="text-xs text-slate-500 font-mono-num mt-0.5">
                  Checked in {formatTime(log.check_in_time)} · {log.minutes_late} min late
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono-num font-semibold text-fine">
                  {formatVNDExact(log.total_fine)}
                </p>
                <p className="text-xs text-slate-400 font-mono-num">
                  {formatBlocks(log.fine_blocks)} blocks
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, formatTime } from '../utils/format';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Surfaces, in one glance, every employee already logged as late for a
 * given day — the "who's late" callout the admin cares about most.
 * Also lets the admin fix a bad entry right here (edit or delete) without
 * hunting back through the logger form.
 * Exposes a refreshKey prop so the parent can force a re-fetch right
 * after a new log is saved.
 */
export default function LateWorkersPanel({ refreshKey, onDataChanged }) {
  const [date, setDate] = useState(todayISO());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ check_in_time: '', check_out_time: '', note: '' });
  const [rowBusy, setRowBusy] = useState(null);
  const [rowError, setRowError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return api
      .getAttendanceLogs({ date, lateOnly: true })
      .then((rows) => {
        setLogs(rows);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function startEdit(log) {
    setEditingId(log.id);
    setRowError(null);
    setDraft({
      check_in_time: (log.check_in_time || '').slice(0, 5),
      check_out_time: (log.check_out_time || '').slice(0, 5),
      note: log.note || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  async function saveEdit(log) {
    if (!draft.check_in_time) {
      setRowError('Check-in time is required.');
      return;
    }
    setRowBusy(log.id);
    setRowError(null);
    try {
      await api.logAttendance({
        employee_id: log.employee_id,
        work_date: log.work_date,
        check_in_time: draft.check_in_time,
        check_out_time: draft.check_out_time || null,
        note: draft.note || null,
      });
      setEditingId(null);
      await load();
      onDataChanged?.();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  async function deleteLog(log) {
    if (!window.confirm(`Delete this log for ${log.employee_name}?`)) return;
    setRowBusy(log.id);
    setRowError(null);
    try {
      await api.deleteAttendanceLog(log.id);
      await load();
      onDataChanged?.();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

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
            Every logged check-in past 08:30 on the selected date. Spot a mistake? Fix it right
            here.
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      {rowError && (
        <div className="mx-5 mt-3 rounded-lg border border-fine/30 bg-fine-soft px-3 py-2 text-xs text-fine">
          {rowError}
        </div>
      )}

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
          {logs.map((log) => {
            const isEditing = editingId === log.id;
            const busy = rowBusy === log.id;

            if (isEditing) {
              return (
                <li key={log.id} className="px-5 py-3 bg-accent-soft/50">
                  <p className="text-sm font-medium text-slate-900 mb-2">
                    {log.employee_name}{' '}
                    <span className="text-slate-400 font-normal font-mono-num text-xs">
                      {log.employee_code}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-500">
                      Check-in
                      <input
                        type="time"
                        value={draft.check_in_time}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, check_in_time: e.target.value }))
                        }
                        className="block mt-0.5 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      Check-out
                      <input
                        type="time"
                        value={draft.check_out_time}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, check_out_time: e.target.value }))
                        }
                        className="block mt-0.5 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                    </label>
                    <div className="flex items-end gap-1.5 ml-auto">
                      <button
                        onClick={() => saveEdit(log)}
                        disabled={busy}
                        className="text-xs font-semibold text-white bg-accent hover:bg-indigo-600 rounded px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {busy ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={busy}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={log.id}
                className="px-5 py-3 flex items-center justify-between gap-3 bg-fine-soft/40 group"
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
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <p className="text-sm font-mono-num font-semibold text-fine">
                      {formatVNDExact(log.total_fine)}
                    </p>
                    <p className="text-xs text-slate-400 font-mono-num">
                      {formatBlocks(log.fine_blocks)} blocks
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => startEdit(log)}
                      disabled={busy}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteLog(log)}
                      disabled={busy}
                      className="text-xs font-medium text-slate-400 hover:text-fine hover:underline disabled:opacity-50"
                    >
                      {busy ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

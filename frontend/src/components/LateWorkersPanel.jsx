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
  const [draft, setDraft] = useState({ check_in_time: '', check_out_time: '', note: '', is_exempt: false });
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
      is_exempt: log.is_exempt || false, // Khởi tạo dữ liệu
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  async function saveEdit(log) {
    if (!draft.check_in_time && !draft.is_exempt) {
      setRowError('Check-in time is required unless exempt.');
      return;
    }
    setRowBusy(log.id);
    setRowError(null);
    try {
      await api.logAttendance({
        employee_code: log.employee_code,
        work_date: log.work_date,
        check_in_time: draft.check_in_time || null,
        check_out_time: draft.check_out_time || null,
        note: draft.note || null,
        is_exempt: draft.is_exempt, // Đẩy cờ exempt xuống Backend
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
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isToday ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`} aria-hidden="true" />
            Late Employees {isToday ? 'Today' : 'on this date'}
          </h3>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Edit or delete incorrect attendance logs directly here.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-slate-300 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</span>
            <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs font-mono font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            />
        </div>
      </div>

      {rowError && (
        <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 shadow-sm">
          {rowError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
      ) : error ? (
        <p className="px-6 py-8 text-sm font-bold text-red-500">{error}</p>
      ) : logs.length === 0 ? (
        <p className="px-6 py-12 text-sm font-medium text-slate-400 text-center bg-slate-50 border border-dashed border-slate-200 m-6 rounded-xl">
          No late employees found for this date.
        </p>
      ) : (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-white border-b-2 border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                        <th className="px-6 py-3 font-bold">Employee</th>
                        <th className="px-6 py-3 font-bold text-center">Check-in Time</th>
                        <th className="px-6 py-3 font-bold text-center">Log Update</th>
                        <th className="px-6 py-3 font-bold text-right">Total Fine</th>
                        <th className="px-6 py-3 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                    const isEditing = editingId === log.id;
                    const busy = rowBusy === log.id;

                    if (isEditing) {
                    return (
                        <tr key={log.id} className="bg-indigo-50/30">
                            <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-900">{log.employee_name}</p>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{log.employee_code}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <input
                                    type="time"
                                    value={draft.check_in_time}
                                    onChange={(e) => setDraft((d) => ({ ...d, check_in_time: e.target.value }))}
                                    disabled={draft.is_exempt}
                                    className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 mx-auto block"
                                />
                            </td>
                            <td className="px-6 py-4 text-center">
                                <label className="text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={draft.is_exempt}
                                    onChange={(e) => setDraft(d => ({ ...d, is_exempt: e.target.checked, check_in_time: e.target.checked ? '' : d.check_in_time }))}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Exempt Status
                                </label>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Editing...</span>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                                <button onClick={() => saveEdit(log)} disabled={busy} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-3 py-1.5 disabled:opacity-50 shadow-sm transition">
                                    Save
                                </button>
                                <button onClick={cancelEdit} disabled={busy} className="text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-md shadow-sm transition">
                                    Cancel
                                </button>
                            </td>
                        </tr>
                    );
                    }

                    return (
                    <tr key={log.id} className="hover:bg-red-50/30 transition-colors group">
                        <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-900">{log.employee_name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{log.employee_code}</p>
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-slate-700">
                            {formatTime(log.check_in_time)} <span className="text-red-500 text-[11px] ml-1">({log.minutes_late}m late)</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            {log.is_exempt ? <span className="bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200">Exempt</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <p className="text-sm font-mono font-black text-red-600">{formatVNDExact(log.total_fine)}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formatBlocks(log.fine_blocks)} blocks</p>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity space-x-3">
                                <button onClick={() => startEdit(log)} disabled={busy} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 underline">Edit</button>
                                <button onClick={() => deleteLog(log)} disabled={busy} className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50 underline">Delete</button>
                            </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
      )}
    </section>
  );
}
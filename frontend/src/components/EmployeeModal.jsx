import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, formatDate, formatTime } from '../utils/format';

export default function EmployeeModal({ employeeId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ check_in_time: '', check_out_time: '', note: '' });
  const [rowBusy, setRowBusy] = useState(null); // id currently saving/deleting
  const [rowError, setRowError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return api
      .getEmployeeAnalytics(employeeId)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  function startEdit(h) {
    setEditingId(h.id);
    setRowError(null);
    setDraft({
      check_in_time: (h.check_in_time || '').slice(0, 5),
      check_out_time: (h.check_out_time || '').slice(0, 5),
      note: h.note || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  async function saveEdit(h) {
    if (!draft.check_in_time) {
      setRowError('Check-in time is required.');
      return;
    }
    setRowBusy(h.id);
    setRowError(null);
    try {
      // Re-submitting with the same employee_id + work_date upserts the
      // existing row (see backend ON CONFLICT) — this is the "just edit
      // it" path instead of deleting and re-logging from scratch.
      await api.logAttendance({
        employee_id: data.employee.id,
        work_date: h.work_date,
        check_in_time: draft.check_in_time,
        check_out_time: draft.check_out_time || null,
        note: draft.note || null,
      });
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  async function deleteLog(h) {
    if (!window.confirm(`Delete the ${formatDate(h.work_date)} log for ${data.employee.name}?`)) {
      return;
    }
    setRowBusy(h.id);
    setRowError(null);
    try {
      await api.deleteAttendanceLog(h.id);
      await load();
      onChanged?.();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !data ? (
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

              {rowError && (
                <div className="mx-6 mt-4 rounded-lg border border-fine/30 bg-fine-soft px-3 py-2 text-sm text-fine">
                  {rowError}
                </div>
              )}

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
                        <th className="px-6 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.history.map((h) => {
                        const late = h.minutes_late > 0;
                        const isEditing = editingId === h.id;
                        const busy = rowBusy === h.id;

                        if (isEditing) {
                          return (
                            <tr key={h.id} className="bg-accent-soft/50">
                              <td className="px-6 py-2.5 text-slate-700 font-mono-num">
                                {formatDate(h.work_date)}
                              </td>
                              <td className="px-6 py-2.5">
                                <input
                                  type="time"
                                  value={draft.check_in_time}
                                  onChange={(e) =>
                                    setDraft((d) => ({ ...d, check_in_time: e.target.value }))
                                  }
                                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
                                />
                              </td>
                              <td className="px-6 py-2.5">
                                <input
                                  type="time"
                                  value={draft.check_out_time}
                                  onChange={(e) =>
                                    setDraft((d) => ({ ...d, check_out_time: e.target.value }))
                                  }
                                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
                                />
                              </td>
                              <td className="px-6 py-2.5 text-right text-xs text-slate-400" colSpan={2}>
                                recalculated on save
                              </td>
                              <td className="px-6 py-2.5 text-right whitespace-nowrap">
                                <button
                                  onClick={() => saveEdit(h)}
                                  disabled={busy}
                                  className="text-xs font-semibold text-white bg-accent hover:bg-indigo-600 rounded px-2.5 py-1 disabled:opacity-50 mr-1.5"
                                >
                                  {busy ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={busy}
                                  className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={h.id} className={`group ${late ? 'bg-fine-soft/40' : ''}`}>
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
                            <td className="px-6 py-2.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => startEdit(h)}
                                disabled={busy}
                                className="text-xs font-medium text-accent hover:underline mr-3 disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteLog(h)}
                                disabled={busy}
                                className="text-xs font-medium text-fine hover:underline disabled:opacity-50"
                              >
                                {busy ? '…' : 'Delete'}
                              </button>
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

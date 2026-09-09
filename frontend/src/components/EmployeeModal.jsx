import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, formatDate, formatTime } from '../utils/format';

export default function EmployeeModal({ employeeCode, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ check_in_time: '', check_out_time: '', note: '', is_exempt: false});
  const [rowBusy, setRowBusy] = useState(null);
  const [rowError, setRowError] = useState(null);

  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const [auditData, setAuditData] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return api
      .getEmployeeAnalytics(employeeCode)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [employeeCode]);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function startEdit(h) {
    setEditingId(h.id);
    setRowError(null);
    setDraft({
      check_in_time: (h.check_in_time || '').slice(0, 5),
      check_out_time: (h.check_out_time || '').slice(0, 5),
      note: h.note || '',
      is_exempt: h.is_exempt || false,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  async function saveEdit(h) {
    if (!draft.check_in_time && !draft.is_exempt) {
      setRowError('Check-in time is required unless marked as exempt.');
      return;
    }
    setRowBusy(h.id);
    try {
      await api.logAttendance({
        employee_code: data.employee.employee_code,
        work_date: h.work_date,
        check_in_time: draft.check_in_time || null,
        check_out_time: draft.check_out_time || null,
        note: draft.note || null,
        is_exempt: draft.is_exempt,
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
    if (!window.confirm(`Xóa bản ghi ngày ${formatDate(h.work_date)} của ${data.employee.name}?`)) return;
    setRowBusy(h.id);
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

  async function toggleAudit(logId) {
    if (expandedAuditId === logId) {
      setExpandedAuditId(null);
      return;
    }
    setExpandedAuditId(logId);
    setAuditLoading(true);
    try {
      const audits = await api.getAttendanceAudit(logId);
      setAuditData(audits);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm anim-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden anim-slide-up border border-slate-200">
        
        {/* Header Modal */}
        <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <h3 className="text-2xl font-black tracking-tight text-slate-900">
            {data ? `${data.employee.name} ` : 'Loading...'} 
            {data && <span className="font-mono text-slate-400 text-lg font-semibold ml-2">#{data.employee.employee_code}</span>}
          </h3>
          <button onClick={onClose} className="text-xs font-bold uppercase tracking-widest bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-md transition-colors shadow-sm">
             Close
          </button>
        </div>

        {/* Nội dung Modal */}
        <div className="flex-1 overflow-auto p-8">
          {loading && !data ? (
             <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : error ? (
            <p className="text-center text-red-500 font-bold">{error}</p>
          ) : (
            <>
              {/* Box Thống kê - Giao diện Data-Driven */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                <Stat label="Late" value={data.stats.times_late} emphasize={data.stats.times_late > 0} suffix="times" />
                <Stat label="Total Minutes Late" value={data.stats.total_minutes_late} emphasize={false} suffix="min" />
                <Stat label="Fine Blocks" value={formatBlocks(data.stats.total_fine_blocks)} emphasize={false} suffix="blocks" />
                <Stat label="Total Fine" value={formatVNDExact(data.stats.total_fine)} emphasize={data.stats.total_fine > 0} isMoney />
              </div>

              {/* Bảng lịch sử */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest font-bold border-b-2 border-slate-200">
                    <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-center">Check-in</th>
                        <th className="px-6 py-4 text-center">Check-out</th>
                        <th className="px-6 py-4">Notes</th>
                        <th className="px-6 py-4 text-center">Exempt from Fine</th>
                        <th className="px-6 py-4 text-right">Minutes Late</th>
                        <th className="px-6 py-4 text-right">Fine Amount</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                  {data.history.map((h) => {
                    const late = h.minutes_late > 0;
                    const busy = rowBusy === h.id;
                    const isEditing = editingId === h.id;

                    if (isEditing) {
                      return (
                        <tr key={h.id} className="bg-blue-50/30 border-y border-blue-100">
                          <td className="px-6 py-3 font-mono-num text-slate-700">{formatDate(h.work_date)}</td>
                          <td className="px-6 py-3">
                            <input 
                              type="time" 
                              className="border border-slate-300 rounded px-2 py-1 text-sm w-full bg-white disabled:bg-slate-100" 
                              value={draft.check_in_time} 
                              onChange={(e) => setDraft({ ...draft, check_in_time: e.target.value })} 
                              disabled={draft.is_exempt || busy} />
                          </td>
                          <td className="px-6 py-3">
                            <input 
                              type="time" 
                              className="border border-slate-300 rounded px-2 py-1 text-sm w-full bg-white" 
                              value={draft.check_out_time} 
                              onChange={(e) => setDraft({ ...draft, check_out_time: e.target.value })} 
                              disabled={busy} />
                          </td>
                          <td colSpan="2" className="px-6 py-3">
                            <input 
                              type="text" 
                              className="border border-slate-300 rounded px-2 py-1 text-sm w-full bg-white" 
                              placeholder="Note (reason...)" 
                              value={draft.note} 
                              onChange={(e) => setDraft({ ...draft, note: e.target.value })} 
                              disabled={busy} />
                            {rowError && <p className="text-red-500 text-xs mt-1">{rowError}</p>}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                              checked={draft.is_exempt} 
                              onChange={(e) => setDraft({ ...draft, is_exempt: e.target.checked })} 
                              disabled={busy} />
                          </td>
                          <td colSpan="2" className="px-6 py-3 text-right">
                            <button onClick={() => saveEdit(h)} disabled={busy} className="text-xs font-bold text-green-600 hover:underline mr-3">Lưu</button>
                            <button onClick={cancelEdit} disabled={busy} className="text-xs text-slate-500 hover:underline">Hủy</button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <React.Fragment key={h.id}>
                        <tr className={`group ${late ? 'bg-fine-soft/40' : 'hover:bg-slate-50'}`}>
                          <td className="px-6 py-3 font-mono-num">{formatDate(h.work_date)}</td>
                          <td className="px-6 py-3 font-mono-num">{h.is_exempt ? '—' : formatTime(h.check_in_time)}</td>
                          <td className="px-6 py-3 font-mono-num">{formatTime(h.check_out_time)}</td>
                          <td className="px-6 py-3 text-slate-600 text-xs italic">{h.note || '—'}</td>
                          <td className="px-6 py-3 text-center">
                            {h.is_exempt ? (
                              <span className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">Yes</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className={`px-6 py-3 text-right font-mono-num ${late ? 'text-fine font-semibold' : 'text-slate-500'}`}>
                            {late ? `${h.minutes_late} min` : (h.is_exempt ? '—' : 'On time')}
                          </td>
                          <td className="px-6 py-3 text-right font-mono-num">
                            {late ? formatVNDExact(h.total_fine) : '—'}
                          </td>
                          <td className="px-6 py-3 text-right whitespace-nowrap">
                            <button onClick={() => startEdit(h)} disabled={busy} className="text-xs text-blue-600 hover:underline mr-3 disabled:opacity-50">Edit</button>
                            <button onClick={() => deleteLog(h)} disabled={busy} className="text-xs text-red-600 hover:underline mr-3 disabled:opacity-50">Delete</button>
                            <button onClick={() => toggleAudit(h.id)} disabled={busy} className="text-xs font-bold text-indigo-600 hover:underline disabled:opacity-50">History</button>
                          </td>
                        </tr>

                        {/* Dropdown Lịch sử chỉnh sửa */}
                        {expandedAuditId === h.id && (
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <td colSpan="8" className="p-4">
                              <div className="pl-6 border-l-2 border-indigo-200 ml-4 space-y-4">
                                {auditLoading ? (
                                  <p className="text-xs text-slate-400 font-medium">Loading history data...</p>
                                ) : auditData.length === 0 ? (
                                  <p className="text-xs text-slate-500 font-medium">No history data available on this day.</p>
                                ) : (
                                  auditData.map((audit) => (
                                    <div key={audit.audit_id} className="relative">
                                      <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-indigo-400 ring-4 ring-slate-50"></span>
                                      <div className="text-sm text-slate-800 flex items-center gap-2">
                                        <span className="font-bold">{audit.changed_by || 'Admin'}</span> 
                                        <span>performed</span> 
                                        <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-bold">{audit.action_type}</span>
                                        <span className="text-slate-500 text-xs ml-1">at {new Date(audit.changed_at).toLocaleString('vi-VN')}</span>
                                      </div>
                                      <div className="mt-1.5 text-xs text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200 w-fit shadow-sm">
                                        <p>Check-in: <span className="font-mono font-semibold text-slate-900">{audit.check_in_time ? audit.check_in_time.slice(0,5) : 'Empty'}</span></p>
                                        <p>Exempt: <span className={`font-semibold ${audit.is_exempt ? 'text-indigo-600' : 'text-slate-900'}`}>{audit.is_exempt ? 'YES' : 'NO'}</span></p>
                                        <p className="col-span-2">Note: <span className={audit.note ? "italic text-slate-800" : "italic text-slate-400"}>{audit.note || 'No notes'}</span></p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                    </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize, suffix, isMoney }) {
  return (
    <div className={`p-5 rounded-xl border ${emphasize ? 'bg-red-50/50 border-red-100' : 'bg-white border-slate-200'}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
          <p className={`text-3xl font-black tracking-tight ${isMoney ? 'font-mono' : ''} ${emphasize ? 'text-red-600' : 'text-slate-900'}`}>
            {value}
          </p>
          {suffix && <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{suffix}</span>}
      </div>
    </div>
  );
}

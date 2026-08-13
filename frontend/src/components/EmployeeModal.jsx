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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">
            {data ? `${data.employee.name} (${data.employee.employee_code})` : 'Loading...'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold">✕ Đóng</button>
        </div>

        {/* Nội dung Modal */}
        <div className="flex-1 overflow-auto p-6">
          {loading && !data ? (
            <p className="text-center text-slate-500">Đang tải dữ liệu...</p>
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : (
            <>
              {/* Box Thống kê */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <Stat label="Số lần đi muộn" value={data.stats.times_late} emphasize={data.stats.times_late > 0} />
                <Stat label="Tổng phút muộn" value={`${data.stats.total_minutes_late} min`} emphasize={false} />
                <Stat label="Số Block phạt" value={formatBlocks(data.stats.total_fine_blocks)} emphasize={false} />
                <Stat label="Tổng Tiền Phạt" value={formatVNDExact(data.stats.total_fine)} emphasize={data.stats.total_fine > 0} />
              </div>

              {/* Bảng lịch sử */}
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Check-in Time</th>
                    <th className="px-6 py-3">Check-out Time</th>
                    <th className="px-6 py-3">Note</th>
                    <th className="px-6 py-3 text-center">Exempt</th>
                    <th className="px-6 py-3 text-right">Minutes Late</th>
                    <th className="px-6 py-3 text-right">Fine</th>
                    <th className="px-6 py-3 text-right">Actions</th>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-mono-num font-bold ${emphasize ? 'text-red-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
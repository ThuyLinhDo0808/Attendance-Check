import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, formatDate, formatTime } from '../utils/format';

export default function EmployeeModal({ employeeCode, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ check_in_time: '', check_out_time: '', note: '', is_exempt: false});
  const [rowBusy, setRowBusy] = useState(null); // id currently saving/deleting
  const [rowError, setRowError] = useState(null);

  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const [auditData, setAuditData] = useState([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeCode]);

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
    setRowError(null);
    try {
      // Re-submitting with the same employee_code + work_date upserts the
      // existing row (see backend ON CONFLICT) — this is the "just edit
      // it" path instead of deleting and re-logging from scratch. employee_id
      // (the specific SCD2 version) stays frozen to whatever it was when
      // this log was first created — the backend never rewrites it here.
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

  async function toggleAudit(logId) {
    if (expandedAuditId === logId) {
      setExpandedAuditId(null);
      return;
    }
    setExpandedAuditId(logId);
    try {
      const audits = await api.getAttendanceAudit(logId);
      setAuditData(audits);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <React.Fragment key={h.id}>
      <tr className={`group ${late ? 'bg-fine-soft/40' : ''}`}>
        <td className="px-6 py-2.5 text-slate-700 font-mono-num">
          {formatDate(h.work_date)}
        </td>
        <td className="px-6 py-2.5 font-mono-num text-slate-700">
          {h.is_exempt ? '—' : formatTime(h.check_in_time)}
        </td>
        <td className="px-6 py-2.5 font-mono-num text-slate-500">
          {formatTime(h.check_out_time)}
        </td>
        {/* Hiển thị trạng thái Exempt bằng huy hiệu (Badge) */}
        <td className="px-6 py-2.5 text-center">
          {h.is_exempt ? (
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Yes
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td
          className={`px-6 py-2.5 text-right font-mono-num ${
            late ? 'text-fine font-semibold' : 'text-ok'
          }`}
        >
          {late ? `${h.minutes_late} min` : (h.is_exempt ? '—' : 'On time')}
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
            className="text-xs font-medium text-fine hover:underline disabled:opacity-50 mr-3"
          >
            {busy ? '…' : 'Delete'}
          </button>
          {/* NÚT MỚI: Bật/Tắt xem lịch sử */}
          <button
            onClick={() => toggleAudit(h.id)}
            disabled={busy}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-50"
          >
            Edit History
          </button>
        </td>
      </tr>

      {/* GIAO DIỆN AUDIT TRAIL (Chỉ hiện khi bấm vào nút Lịch sử) */}
      {expandedAuditId === h.id && (
        <tr className="bg-slate-50/80 border-b border-slate-200">
          <td colSpan="7" className="p-4">
            <div className="pl-6 border-l-2 border-indigo-200 ml-4 space-y-4">
              {auditData.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">Loading audit data...</p>
              ) : (
                auditData.map((audit) => (
                  <div key={audit.audit_id} className="relative">
                    {/* Dấu chấm Timeline */}
                    <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-indigo-400 ring-4 ring-slate-50"></span>
                    
                    {/* Người sửa & Thời gian */}
                    <div className="text-sm text-slate-800 flex items-center gap-2">
                      <span className="font-bold">{audit.changed_by || 'Admin'}</span> 
                      <span>performed</span> 
                      <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-bold">
                        {audit.action_type}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">
                        at {new Date(audit.changed_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    
                    {/* Chi tiết dữ liệu tại thời điểm đó */}
                    <div className="mt-1.5 text-xs text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200 w-fit shadow-sm">
                      <p>Check-in: <span className="font-mono font-semibold text-slate-900">{audit.check_in_time ? audit.check_in_time.slice(0,5) : 'Empty'}</span></p>
                      <p>Exempt: <span className={`font-semibold ${audit.is_exempt ? 'text-indigo-600' : 'text-slate-900'}`}>{audit.is_exempt ? 'YES' : 'NO'}</span></p>
                      <p className="col-span-2">
                        Note: <span className={audit.note ? "italic text-slate-800" : "italic text-slate-400"}>
                          {audit.note || 'No notes'}
                        </span>
                      </p>
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

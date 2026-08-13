import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { formatDate } from '../utils/format';

export default function PendingExcuses({ onResolved }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPendingExcuses();
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleResolve = async (id, status) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${status === 'APPROVED' ? 'DUYỆT' : 'TỪ CHỐI'} đơn này?`)) return;
    
    try {
      await api.resolveExcuse({ request_id: id, status });
      await loadRequests();
      onResolved?.(); // Gọi ngược lên App.jsx để cập nhật lại số đếm chuông báo
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Pending Excuses</h2>
        <p className="text-sm text-slate-500 mt-1">
          Danh sách giải trình đi muộn/vắng mặt đang chờ xét duyệt.
        </p>
      </header>

      {error && <div className="mb-6 text-red-500 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-6 text-slate-500 text-sm">Đang tải dữ liệu...</p>
        ) : requests.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm italic">Không có đơn xin phép nào đang chờ duyệt.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Ngày</th>
                <th className="px-6 py-3">Nhân viên</th>
                <th className="px-6 py-3">Lý do</th>
                <th className="px-6 py-3">AI Đề xuất</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono-num font-medium text-slate-700 whitespace-nowrap">
                    {formatDate(req.work_date)}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {req.employee_name} <br/>
                    <span className="text-xs text-slate-500 font-mono-num">{req.employee_code}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 italic max-w-xs break-words">
                    "{req.reason}"
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      req.ai_suggestion.includes('Duyệt') 
                        ? 'bg-green-50 text-green-700 ring-green-600/20' 
                        : 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                    }`}>
                      {req.ai_suggestion}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button 
                      onClick={() => handleResolve(req.id, 'APPROVED')}
                      className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition"
                    >
                      Duyệt (Miễn phạt)
                    </button>
                    <button 
                      onClick={() => handleResolve(req.id, 'REJECTED')}
                      className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-300 transition"
                    >
                      Từ chối
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
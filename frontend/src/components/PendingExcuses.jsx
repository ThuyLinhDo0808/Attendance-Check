import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { formatDate } from '../utils/format';
import { BellAlertIcon } from '@heroicons/react/24/outline';

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
    if (!window.confirm(`Confirm ${status === 'APPROVED' ? 'Approval' : 'Rejection (with penalty)'} for this request?`)) return;
    
    try {
      await api.resolveExcuse({ request_id: id, status });
      await loadRequests();
      onResolved?.(); 
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <header className="border-b border-slate-200 pb-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <BellAlertIcon className="h-8 w-8 text-indigo-600"/>
            Pending Resolutions
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-2">
          List of pending late explanations awaiting approval. AI has already analyzed and provided suggestions below.
        </p>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-40">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 bg-slate-50 text-slate-500">
              <CheckCircleIcon className="h-10 w-10 text-emerald-500 mb-3" />
              <p className="text-sm font-bold">Empty inbox. All incidents have been resolved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Violation Date</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Explanation</th>
                  <th className="px-6 py-4">AI Analysis</th>
                  <th className="px-6 py-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                   const isRecommendApprove = req.ai_suggestion.includes('Duyệt');
                   return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5 font-mono text-sm font-semibold text-slate-700 whitespace-nowrap">
                            {formatDate(req.work_date)}
                        </td>
                        <td className="px-6 py-5">
                            <p className="font-bold text-slate-900">{req.employee_name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{req.employee_code}</p>
                        </td>
                        <td className="px-6 py-5">
                            <p className="text-slate-700 font-medium italic max-w-sm break-words border-l-2 border-slate-300 pl-3">"{req.reason}"</p>
                        </td>
                        <td className="px-6 py-5">
                            <span className={`inline-flex rounded border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
                            isRecommendApprove 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                            {req.ai_suggestion}
                            </span>
                        </td>
                        <td className="px-6 py-5 text-right whitespace-nowrap space-x-2">
                            <button 
                            onClick={() => handleResolve(req.id, 'APPROVED')}
                            className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-indigo-700 transition"
                            >
                            Duyệt (Miễn)
                            </button>
                            <button 
                            onClick={() => handleResolve(req.id, 'REJECTED')}
                            className="text-xs font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md shadow-sm hover:bg-slate-50 transition"
                            >
                            Từ chối
                            </button>
                        </td>
                    </tr>
                   )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    )
}
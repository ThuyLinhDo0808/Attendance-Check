import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { formatVND, formatBlocks, currentMonthValue, formatMonthLabel } from '../utils/format';
import EmployeeModal from './EmployeeModal.jsx';
import { ArrowsUpDownIcon, TableCellsIcon } from '@heroicons/react/24/outline';

export default function EmployeeFineSheet() {
  const [month, setMonth] = useState(''); 
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  
  const [sortConfig, setSortConfig] = useState({ key: 'total_fine', direction: 'desc' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getFineSheet(month || undefined)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  const sortedRows = useMemo(() => {
    let sortableItems = [...rows];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [rows, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ label, sortKey, align = 'left' }) => (
      <th 
        className={`px-5 py-4 cursor-pointer group select-none transition-colors hover:bg-slate-200/50 ${align === 'right' ? 'text-right' : 'text-left'}`}
        onClick={() => requestSort(sortKey)}
      >
        <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
            <span className="font-bold text-slate-700 tracking-wide">{label}</span>
            <ArrowsUpDownIcon className={`h-3.5 w-3.5 transition-all duration-200 ${sortConfig.key === sortKey ? 'opacity-100 text-indigo-600' : 'opacity-0 group-hover:opacity-40 text-slate-500'}`} />
        </div>
      </th>
  );

  return (
    <div className="space-y-6 py-2">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
             <TableCellsIcon className="h-8 w-8 text-indigo-600"/>
             Fine Ledger Sheet
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Fine Details of employees for the selected month. You can sort the table by clicking on the column headers.
          </p>
        </div>
        <div className="flex items-end gap-4 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Month</label>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-mono-num font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
              />
              {month && (
                <button onClick={() => setMonth('')} className="text-xs font-bold text-slate-500 hover:text-indigo-600 underline px-2">
                  All Time
                </button>
              )}
            </div>
          </div>
          <div>
             <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Export Data</label>
             <div className="flex gap-2">
                 <a href={api.exportMonthlyUrl({ month, format: 'xlsx' })} className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors">
                    Download Excel
                 </a>
             </div>
          </div>
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 font-medium">{error}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {month ? `Sheet: ${formatMonthLabel(month)}` : 'Sheet: All Time'}
            </span>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
                Sort by: {sortConfig.key} ({sortConfig.direction.toUpperCase()})
            </span>
        </div>

        {loading ? (
           <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b-2 border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <SortableHeader label="Employee" sortKey="name" />
                  <SortableHeader label="Employee ID" sortKey="employee_code" />
                  <SortableHeader label="Late Times" sortKey="times_late" align="right" />
                  <SortableHeader label="Late Minutes" sortKey="total_minutes_late" align="right" />
                  <SortableHeader label="Fine Blocks" sortKey="total_fine_blocks" align="right" />
                  <SortableHeader label="Total Fine" sortKey="total_fine" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((r) => {
                  const isLate = r.times_late > 0;
                  return (
                    <tr
                      key={r.employee_code}
                      onClick={() => setSelectedCode(r.employee_code)}
                      className={`cursor-pointer transition-colors ${
                        isLate ? 'hover:bg-red-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-5 py-4 font-bold text-slate-900">
                        <span className="flex items-center gap-3">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${isLate ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-slate-300'}`} />
                          {r.name}
                          {r.status === 'INACTIVE' && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 border border-slate-200 bg-slate-100 rounded px-1.5 py-0.5">Inactive</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-mono text-xs font-semibold">{r.employee_code}</td>
                      <td className={`px-5 py-4 text-right font-mono text-sm ${isLate ? 'text-red-600 font-bold' : 'text-slate-400 font-medium'}`}>
                        {r.times_late}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-slate-700">
                        {r.total_minutes_late} min
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-slate-700">
                        {formatBlocks(r.total_fine_blocks)}
                      </td>
                      <td className={`px-5 py-4 text-right font-mono text-base tracking-tight ${isLate ? 'text-red-600 font-black' : 'text-slate-400 font-semibold'}`}>
                        {formatVND(r.total_fine)}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-400 bg-slate-50">
                      No data available for reconciliation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCode && (
        <EmployeeModal
          employeeCode={selectedCode}
          onClose={() => setSelectedCode(null)}
          onChanged={() => api.getFineSheet(month || undefined).then(setRows).catch((err) => setError(err.message))}
        />
      )}
    </div>
  );
}
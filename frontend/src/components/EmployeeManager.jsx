import React, { useState } from 'react';
import { api } from '../api';
import LiveOfficeMap from './LiveOfficeMap.jsx';
import { PlusIcon, UserGroupIcon, MapIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const StatusBadge = ({ status }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
      isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
    }`}>
      {status}
    </span>
  );
};

export default function EmployeeManager({ employees, onEmployeeAdded }) {
  const [form, setForm] = useState({ name: '', employee_code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', status: '' });
  const [rowBusy, setRowBusy] = useState(null);
  
  const [viewMode, setViewMode] = useState('list');
  const [timeTravelDate, setTimeTravelDate] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.employee_code) {
      setError('Name and Employee Code are mandatory fields.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createEmployee(form);
      setForm({ name: '', employee_code: '' });
      onEmployeeAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditForm({ name: emp.name, status: emp.status });
  }

  async function saveEdit(emp) {
    if (!editForm.name) return;
    setRowBusy(emp.id);
    try {
      await api.updateEmployee(emp.employee_code, {
        name: editForm.name,
        status: editForm.status
      });
      setEditingId(null);
      onEmployeeAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || emp.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 py-2">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
             <UserGroupIcon className="h-8 w-8 text-indigo-600"/>
             Staff Directory
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Manage employee profiles, operational statuses, and seating configurations.
          </p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
          <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <UserGroupIcon className="h-4 w-4" /> List View
          </button>
          <button onClick={() => setViewMode('map')} className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <MapIcon className="h-4 w-4" /> Map View
          </button>
        </div>
      </header>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Registration Form */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-6">
          <form onSubmit={handleAdd} className="space-y-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">New Onboarding</h3>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g., Nguyen Van A" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee ID / Code</label>
              <input type="text" value={form.employee_code} onChange={(e) => updateForm('employee_code', e.target.value.toUpperCase())} placeholder="e.g., EMP001" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none uppercase placeholder:normal-case placeholder:font-sans placeholder:font-medium" />
            </div>

            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-2 rounded-md bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm">
              <PlusIcon className="h-4 w-4 shrink-0" />
              {submitting ? 'Processing...' : 'Register Employee'}
            </button>
          </form>
        </div>

        {/* Directory/Map Rendering Area */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[500px] overflow-hidden">
          
          {viewMode === 'map' ? (
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Office Floor Plan</h3>
               <div className='flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md'>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time Travel:</span>
                  <input type="date" value={timeTravelDate} onChange={(e) => setTimeTravelDate(e.target.value)} className="text-xs font-mono font-bold text-slate-800 outline-none bg-transparent" />
                  {timeTravelDate && <button onClick={() => setTimeTravelDate('')} className="text-[10px] font-bold text-indigo-600 uppercase hover:underline ml-2">Reset</button>}
               </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200 shadow-inner">
                  {['ALL', 'ACTIVE', 'INACTIVE'].map(status => (
                    <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-1 text-[11px] font-bold rounded transition-all tracking-wider ${filterStatus === status ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                      {status}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search ID or Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            {viewMode === 'map' ? (
              <div className="p-4 flex-1">
                <div className='h-full border border-slate-200 rounded-xl bg-slate-50 overflow-hidden relative'>
                    {timeTravelDate && <div className="absolute top-3 left-3 bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest z-10 shadow-sm">Audit Mode Active</div>}
                    <LiveOfficeMap employees={employees} isEditMode={!timeTravelDate} date={timeTravelDate} />
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className='bg-white border-b-2 border-slate-200 text-slate-500 text-[11px] uppercase tracking-widest font-bold'>
                    <tr>
                      <th className="px-6 py-4">Employee Identity</th>
                      <th className="px-6 py-4">Auth Code</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => {
                      const isEditing = editingId === emp.id;
                      const isBusy = rowBusy === emp.id;

                      if (isEditing) {
                        return (
                          <tr key={emp.id} className="bg-indigo-50/40">
                            <td className="px-6 py-3">
                              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 outline-none font-bold text-slate-900" />
                            </td>
                            <td className="px-6 py-3 text-slate-500 font-mono text-xs font-semibold">{emp.employee_code}</td>
                            <td className="px-6 py-3">
                              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none">
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                              </select>
                            </td>
                            <td className="px-6 py-3 text-right space-x-2">
                              <button onClick={() => saveEdit(emp)} disabled={isBusy} className="text-xs font-bold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-md disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingId(null)} disabled={isBusy} className="text-xs font-bold text-slate-500 hover:underline">Cancel</button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className={`font-bold ${emp.status === 'INACTIVE' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}>{emp.name}</div>
                          </td>
                          <td className={`px-6 py-4 font-mono text-xs font-semibold ${emp.status === 'INACTIVE' ? 'text-slate-400' : 'text-slate-600'}`}>{emp.employee_code}</td>
                          <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => startEdit(emp)} className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 opacity-0 group-hover:opacity-100 hover:underline">Modify</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
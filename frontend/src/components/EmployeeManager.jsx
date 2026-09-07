import React, { useState } from 'react';
import { api } from '../api';
import LiveOfficeMap from './LiveOfficeMap.jsx';
import { PlusIcon, UserGroupIcon, MapIcon, PencilSquareIcon, CheckIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';

const StatusBadge = ({ status }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${
      isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
    }`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
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

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.employee_code) {
      setError('Name and Employee Code are required.');
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

  return (
    <div className="space-y-6 py-6 max-w-7xl mx-auto">
      {/* Header professional */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Employee Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Add new employees, update statuses, or view the seating chart.
          </p>
        </div>
        
        {/* View Switcher Professional */}
        <div className="flex rounded-lg bg-slate-100 p-1 shadow-inner border border-slate-200/60">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              viewMode === 'list'
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <UserGroupIcon className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              viewMode === 'map'
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm flex items-start gap-3">
          <XMarkIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className='font-bold text-red-900'>An error occurred</h4>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Card Add New (Left) */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-6">
          <form onSubmit={handleAdd} className="space-y-5">
            <div className='flex items-center gap-3 mb-2'>
              <div className='bg-indigo-50 p-2.5 rounded-lg text-indigo-600 border border-indigo-100'>
                <PlusIcon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Add Employee</h3>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="e.g., John Doe"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Employee Code</label>
              <input
                type="text"
                value={form.employee_code}
                onChange={(e) => updateForm('employee_code', e.target.value.toUpperCase())}
                placeholder="e.g., JD123"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none uppercase placeholder:normal-case"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm hover:shadow"
            >
              <PlusIcon className="h-4 w-4" />
              {submitting ? 'Adding...' : 'Save Employee'}
            </button>
          </form>
        </div>

        {/* Main Content (Right) */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[500px] overflow-hidden">
          {viewMode === 'map' ? (
            <div className="p-6 flex-1 flex flex-col">
              <div className='flex flex-wrap items-center justify-between mb-5 gap-4'>
                  <h3 className="text-lg font-bold text-slate-800">Office Map</h3>
                  
                  {/* Time-Travel Toolbar */}
                  <div className='flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm'>
                    <ClockIcon className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">History:</span>
                    <input 
                        type="date" 
                        value={timeTravelDate}
                        onChange={(e) => setTimeTravelDate(e.target.value)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                    {timeTravelDate && (
                      <button onClick={() => setTimeTravelDate('')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded">
                        Back to Present
                      </button>
                    )}
                  </div>
              </div>
              <div className='flex-1 border border-slate-200 rounded-xl bg-slate-50 overflow-hidden'>
                  <LiveOfficeMap employees={employees} isEditMode={!timeTravelDate} date={timeTravelDate} />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className='bg-slate-50 border-b border-slate-200'>
                  <tr className='text-xs text-slate-500 uppercase tracking-wider font-bold'>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Emp Code</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const isEditing = editingId === emp.id;
                    const isBusy = rowBusy === emp.id;

                    if (isEditing) {
                      return (
                        <tr key={emp.id} className="bg-indigo-50/40">
                          <td className="px-6 py-3">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-semibold text-slate-800"
                            />
                          </td>
                          <td className="px-6 py-3 text-slate-500 font-mono text-xs font-medium">{emp.employee_code}</td>
                          <td className="px-6 py-3">
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td className="px-6 py-3 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => saveEdit(emp)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                              {isBusy ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                            >
                              <XMarkIcon className="h-3.5 w-3.5 text-slate-500" />
                              Cancel
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className='flex items-center gap-3'>
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm border ${emp.status === 'INACTIVE' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-transparent'}`}>
                                {emp.name.split(' ').pop().substring(0,2).toUpperCase()}
                            </div>
                            <div className={`font-semibold ${emp.status === 'INACTIVE' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}`}>
                                {emp.name}
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 font-mono text-xs font-medium ${emp.status === 'INACTIVE' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {emp.employee_code}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={emp.status} />
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => startEdit(emp)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-md"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {employees.length === 0 && (
                <div className='text-center py-20 text-slate-500 space-y-3 flex flex-col items-center justify-center bg-slate-50/50 m-4 rounded-xl border border-dashed border-slate-200'>
                    <div className="bg-white p-3 rounded-full shadow-sm border border-slate-100">
                      <UserGroupIcon className='h-8 w-8 text-slate-400'/>
                    </div>
                    <p className="font-medium text-sm">No employees found in the list.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
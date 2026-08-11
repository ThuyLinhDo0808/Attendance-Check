import React, { useState } from 'react';
import { api } from '../api';
import LiveOfficeMap from './LiveOfficeMap.jsx';
import { PlusIcon, UserGroupIcon, MapIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const StatusBadge = ({ status }) => {
  const isActive = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
    }`}>
      <span className={`mr-1.5 h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
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

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.employee_code) {
      setError('Tên và mã nhân viên là bắt buộc.');
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
    <div className="space-y-8 py-6">
      {/* Header professional */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Employee Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Add new employee or update status. Switch to Map View to see seating arrangement.
          </p>
        </div>
        
        {/* View Switcher Professional (Segmented Control) */}
        <div className="flex rounded-full bg-slate-100 p-1 shadow-inner border border-slate-200">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              viewMode === 'list'
                ? 'bg-white text-indigo-700 shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserGroupIcon className="h-5 w-5" />
            List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              viewMode === 'map'
                ? 'bg-white text-indigo-700 shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapIcon className="h-5 w-5" />
            Map
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm flex items-start gap-3">
          <XMarkIcon className="h-6 w-6 text-red-500 shrink-0" />
          <div>
            <h4 className='font-bold'>An error occurred</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        {/* Card Thêm mới (Left) */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 p-7 shadow-sm sticky top-6">
          <form onSubmit={handleAdd} className="space-y-6">
            <div className='flex items-center gap-3 border-b border-slate-100 pb-4 mb-4'>
              <div className='bg-indigo-50 p-3 rounded-xl text-indigo-600'>
                <PlusIcon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-950">Add new employee</h3>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Employee Code</label>
              <input
                type="text"
                value={form.employee_code}
                onChange={(e) => updateForm('employee_code', e.target.value.toUpperCase())}
                placeholder="NVA123"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              {submitting ? 'Adding…' : 'Add to list'}
            </button>
          </form>
        </div>

        {/* Nội dung chính (Right) */}
        <div className="xl:col-span-3 bg-white rounded-3xl border border-slate-100 p-2 shadow-sm flex flex-col min-h-[500px]">
          {viewMode === 'map' ? (
            <div className="p-6 flex-1 flex flex-col">
               <div className='flex items-center justify-between mb-6'>
                  <h3 className="text-lg font-bold text-slate-950">Office Layout</h3>
                  <div className='text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full'>Edit Mode</div>
               </div>
               <div className='flex-1 border border-slate-100 rounded-2xl bg-slate-50/50'>
                  <LiveOfficeMap employees={employees} isEditMode={true} />
               </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm data-table">
                <thead className='border-b border-slate-100'>
                  <tr className='text-left text-xs text-slate-500 uppercase tracking-wider'>
                    <th className="px-6 py-5 font-medium">Employee</th>
                    <th className="px-6 py-5 font-medium">Employee Code</th>
                    <th className="px-6 py-5 font-medium">Status</th>
                    <th className="px-6 py-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const isEditing = editingId === emp.id;
                    const isBusy = rowBusy === emp.id;

                    if (isEditing) {
                      return (
                        <tr key={emp.id} className="bg-indigo-50/50 anim-pulse">
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                            />
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-xs">{emp.employee_code}</td>
                          <td className="px-6 py-4">
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-indigo-400"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => saveEdit(emp)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckIcon className="h-4 w-4" />
                              {isBusy ? '...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                            >
                              <XMarkIcon className="h-4 w-4" />
                              Cancel
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className='flex items-center gap-3'>
                            <div className='h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200'>
                                {emp.name.split(' ').pop().substring(0,2).toUpperCase()}
                            </div>
                            <div className={`font-semibold text-slate-950 ${emp.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                                {emp.name}
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-5 font-mono text-xs ${emp.status === 'INACTIVE' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {emp.employee_code}
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={emp.status} />
                        </td>
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                          <button
                            onClick={() => startEdit(emp)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition hover:text-indigo-800"
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
                <div className='text-center py-16 text-slate-500 space-y-3 flex flex-col items-center flex-1 justify-center'>
                    <UserGroupIcon className='h-12 w-12 text-slate-300'/>
                    <p>No employees in the list.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { api } from '../api';

export default function EmployeeManager({ employees, onEmployeeAdded }) {
  const [form, setForm] = useState({ name: '', employee_code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // State cho việc Edit
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', status: '' });
  const [rowBusy, setRowBusy] = useState(null);

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
      await api.updateEmployee(emp.id, { 
        name: editForm.name, 
        status: editForm.status 
      });
      setEditingId(null);
      onEmployeeAdded?.(); // Gọi hàm này để App.jsx tải lại danh sách
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Employee Management</h2>
        <p className="text-sm text-slate-500 mt-1">
          Add new employee or update status (ACTIVE / INACTIVE) for existing employees.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form thêm mới */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleAdd}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Add New Employee</h3>
            
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Employee Code</label>
              <input
                type="text"
                value={form.employee_code}
                onChange={(e) => updateForm('employee_code', e.target.value.toUpperCase())}
                placeholder="VD: NVA123"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 transition-colors mt-2"
            >
              {submitting ? 'Adding…' : 'Add Employee'}
            </button>
          </form>
        </div>

        {/* Danh sách hiện tại */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50">
            Employee List ({employees.length})
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const isEditing = editingId === emp.id;
                  const isBusy = rowBusy === emp.id;

                  // Trạng thái đang chỉnh sửa (Edit Mode)
                  if (isEditing) {
                    return (
                      <tr key={emp.id} className="bg-accent-soft/50">
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
                          />
                        </td>
                        <td className="px-5 py-3 text-slate-500 font-mono-num">
                          {emp.employee_code}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold focus:border-accent"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => saveEdit(emp)}
                            disabled={isBusy}
                            className="text-xs font-semibold text-white bg-accent hover:bg-indigo-600 rounded px-2.5 py-1.5 mr-2 disabled:opacity-50"
                          >
                            {isBusy ? 'Saving…' : 'Lưu'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={isBusy}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800"
                          >
                            Hủy
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Trạng thái hiển thị bình thường
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 group">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        <span className={`inline-flex items-center gap-2 ${emp.status === 'INACTIVE' ? 'opacity-50' : ''}`}>
                          {emp.name}
                        </span>
                      </td>
                      <td className={`px-5 py-3 font-mono-num ${emp.status === 'INACTIVE' ? 'text-slate-300' : 'text-slate-500'}`}>
                        {emp.employee_code}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          emp.status === 'ACTIVE' ? 'bg-ok-soft text-ok' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(emp)}
                          className="text-xs font-medium text-accent hover:underline"
                        >
                          Modify
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
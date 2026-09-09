import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, MapPinIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function AssignSeatModal({ isOpen, onClose, seat, employees, onSave }) {
  const [selectedCode, setSelectedCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeEmployees = useMemo(() => {
    return employees
      .filter(emp => emp.status === 'ACTIVE')
      .sort((a, b) => a.name.localeCompare(b.name)); 
  }, [employees]);

  useEffect(() => {
    if (isOpen && seat) setSelectedCode(seat.currentEmpCode || '');
    if(!isOpen) setIsSubmitting(false);
  }, [isOpen, seat]);

  if (!isOpen || !seat) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(seat.id, selectedCode || null);
      onClose();
    } catch (error) {
      alert(error.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearSeat = async () => {
    if (window.confirm(`Confirm revocation of seat ${seat.id}?`)) {
      setIsSubmitting(true);
      try {
        await onSave(seat.id, null);
        onClose();
      } catch (error) {
        alert(error.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm anim-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform anim-slide-up border border-slate-200">
        
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className='flex items-center gap-2'>
            <MapPinIcon className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Seat Allocation</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className='bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm flex items-center justify-between'>
             <span className="font-medium text-slate-600">Target Node:</span> 
             <span className="font-bold text-slate-900 font-mono tracking-widest bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{seat.id}</span>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Assign Personnel
            </label>
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition"
            >
              <option value="">-- Vacate this seat --</option>
              {activeEmployees.map((emp) => (
                <option key={emp.employee_code} value={emp.employee_code}>
                  {emp.name} ({emp.employee_code})
                </option>
              ))}
            </select>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
              * Conflicts will trigger automatic reassignment.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            {seat.currentEmpCode ? (
              <button type="button" onClick={handleClearSeat} disabled={isSubmitting} className="text-[11px] text-red-600 hover:underline font-bold uppercase tracking-widest">
                Revoke Seat
              </button>
            ) : <div></div>}
            
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-100 transition">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm">
                <CheckIcon className="h-4 w-4 shrink-0" /> {isSubmitting ? 'Syncing...' : 'Commit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
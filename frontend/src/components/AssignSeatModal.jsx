import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, UserPlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function AssignSeatModal({ isOpen, onClose, seat, employees, onSave }) {
  const [selectedCode, setSelectedCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chỉ lấy danh sách nhân viên đang ACTIVE để gán ghế
  const activeEmployees = useMemo(() => {
    return employees
      .filter(emp => emp.status === 'ACTIVE')
      .sort((a, b) => a.name.localeCompare(b.name)); // Sắp xếp tên A-Z
  }, [employees]);

  useEffect(() => {
    if (isOpen && seat) {
      setSelectedCode(seat.currentEmpCode || '');
    }
    // Reset trạng thái khi đóng/mở
    if(!isOpen) {
        setIsSubmitting(false);
    }
  }, [isOpen, seat]);

  if (!isOpen || !seat) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(seat.id, selectedCode || null);
      onClose();
    } catch (error) {
      alert(error.message); // Có thể thay bằng toast message Pro hơn
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearSeat = async () => {
    if (window.confirm(`Bạn có chắc muốn bỏ trống vị trí ${seat.id}?`)) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-in">
      
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden transform transition-all z-10 border border-slate-100 anim-slide-up">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className='flex items-center gap-3'>
            <div className='bg-indigo-50 p-2.5 rounded-xl text-indigo-600 border border-indigo-100'>
                <UserPlusIcon className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-950">
              Thiết lập chỗ ngồi
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className='bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-950'>
             Bạn đang chỉnh sửa vị trí ghế: <span className="font-bold text-indigo-700 font-mono bg-white px-2 py-0.5 rounded border border-indigo-200">{seat.id}</span>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              Chọn nhân sự cho vị trí này
            </label>
            <div className="relative">
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition transition-all duration-200"
              >
                <option value="">-- Để trống ghế --</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.employee_code} value={emp.employee_code}>
                    {emp.name} ({emp.employee_code})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 pl-1">
              * Hệ thống tự động chuyển nhân sự từ ghế cũ sang ghế này (nếu có).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-100">
            {seat.currentEmpCode ? (
              <button
                type="button"
                onClick={handleClearSeat}
                disabled={isSubmitting}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-red-50 transition"
              >
                <TrashIcon className="h-5 w-5" />
                Xóa người ngồi
              </button>
            ) : (
              <div></div> // Spacer
            )}
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm"
              >
                <CheckIcon className="h-5 w-5" />
                {isSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
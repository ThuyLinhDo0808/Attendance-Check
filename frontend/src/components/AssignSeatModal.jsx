import React, { useState, useEffect, useMemo } from 'react';

export default function AssignSeatModal({ isOpen, onClose, seat, employees, onSave }) {
  const [selectedCode, setSelectedCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chỉ lấy danh sách nhân viên đang ACTIVE để gán ghế
  const activeEmployees = useMemo(() => {
    return employees.filter(emp => emp.status === 'ACTIVE');
  }, [employees]);

  // Khi mở modal, set giá trị mặc định là người đang ngồi ở ghế đó (nếu có)
  useEffect(() => {
    if (isOpen && seat) {
      setSelectedCode(seat.currentEmpCode || '');
    }
  }, [isOpen, seat]);

  if (!isOpen || !seat) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Gọi hàm onSave truyền từ component cha (truyền employee_code hoặc null nếu chọn bỏ trống)
      await onSave(seat.id, selectedCode || null);
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearSeat = async () => {
    if (window.confirm('Bạn có chắc muốn bỏ trống vị trí này?')) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            Cập nhật vị trí ghế: <span className="text-accent">{seat.id}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Chọn nhân sự cho vị trí này
            </label>
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="">-- Trống (Không có người ngồi) --</option>
              {activeEmployees.map((emp) => (
                <option key={emp.employee_code} value={emp.employee_code}>
                  {emp.name} ({emp.employee_code})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              * Nếu nhân sự này đang ngồi ở ghế khác, hệ thống sẽ tự động chuyển họ sang ghế này và bỏ trống ghế cũ.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {seat.currentEmpCode ? (
              <button
                type="button"
                onClick={handleClearSeat}
                disabled={isSubmitting}
                className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Bỏ trống ghế
              </button>
            ) : (
              <div></div> // Spacer để đẩy cụm nút Lưu sang phải
            )}
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
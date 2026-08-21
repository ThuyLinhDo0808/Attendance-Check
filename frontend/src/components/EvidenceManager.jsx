import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function EvidenceManager() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null); // Lưu ID của record đang được upload

  const fetchLateLogs = useCallback(async () => {
    try {
      setLoading(true);
      // Gọi API lấy danh sách đi muộn (đã định nghĩa trong api.js)
      const data = await api.getAttendanceLogs({ lateOnly: true });
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLateLogs();
  }, [fetchLateLogs]);

  const handleFileUpload = async (event, log) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    if (files.length > 5) {
      alert("Chỉ được chọn tối đa 5 file một lúc!");
      return;
    }

    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 2000 * 1024 * 1024) {
      alert("Tổng dung lượng các file quá lớn! Vui lòng chọn dưới 2GB.");
      return;
    }

    setUploadingId(log.id);
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('media', file);
    });

    formData.append('employee_code', log.employee_code);
    formData.append('work_date', log.work_date.split('T')[0]); // Đảm bảo format YYYY-MM-DD

    try {
      await api.uploadEvidence(formData);
      alert('Tải bằng chứng lên thành công!');
      fetchLateLogs(); 
    } catch (err) {
      console.error(err);
      alert(`Lỗi upload: ${err.message}`);
    } finally {
      setUploadingId(null);
      event.target.value = ''; // Reset input
    }
  };

  if (loading) return <div className="p-4">Đang tải dữ liệu...</div>;
  if (error) return <div className="p-4 text-red-600">Lỗi: {error}</div>;

  return (
    <div className="bg-white shadow-sm rounded-lg border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">Quản lý Bằng Chứng (Đi muộn)</h2>
        <p className="text-sm text-slate-500">Hỗ trợ chọn nhiều ảnh/video cùng lúc (tối đa 5 file).</p>
      </div>

      <div className="p-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
        {logs.map((log) => {
          // Lấy mảng ID từ DB (phải parse nếu nó là chuỗi, tuỳ thư viện kết nối SQL)
          const evidenceFiles = Array.isArray(log.evidence_files) 
            ? log.evidence_files 
            : (typeof log.evidence_files === 'string' ? JSON.parse(log.evidence_files) : []);

          return (
          <div key={log.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{log.employee_name} ({log.employee_code})</h3>
                <div className="text-sm text-slate-500">Ngày: {new Date(log.work_date).toLocaleDateString('vi-VN')}</div>
                <div className="text-sm text-red-600 font-medium mt-1">Muộn: {log.minutes_late} phút</div>
              </div>
            </div>

            <div className="flex-1 mt-2">
              {/* NÚT UPLOAD LUÔN HIỂN THỊ ĐỂ CÓ THỂ BỔ SUNG THÊM FILE */}
              <div className="mb-4">
                {uploadingId === log.id ? (
                  <div className="text-blue-600 font-medium animate-pulse text-sm">
                    Đang xử lý tải lên...
                  </div>
                ) : (
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 px-3 rounded inline-block">
                    + Thêm Ảnh/Video
                    <input 
                      type="file" 
                      accept="video/*, image/*" 
                      multiple 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, log)}
                    />
                  </label>
                )}
              </div>

              {/* GRID HIỂN THỊ CÁC FILE ĐÃ UPLOAD */}
              {evidenceFiles.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {evidenceFiles.map((fileId, index) => (
                    <div key={fileId} className="relative w-full overflow-hidden rounded bg-black" style={{ paddingTop: '56.25%' }}>
                      <iframe 
                        src={`https://drive.google.com/file/d/${fileId}/preview`} 
                        className="absolute top-0 left-0 w-full h-full border-0"
                        allow="autoplay"
                        title={`Bằng chứng ${index + 1}`}
                      ></iframe>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">Chưa có bằng chứng nào.</div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { api } from '../api';

const EvidenceUpload = ({ employeeCode, workDate, onUploadSuccess }) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      if (files.length > 5) {
        setMessage({ type: 'error', text: 'Chỉ được chọn tối đa 5 file cùng lúc!' });
        return;
      }
      
      // Kiểm tra tổng dung lượng (ví dụ: giới hạn 200MB cho an toàn trên mobile)
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);
      if (totalSize > 200 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Tổng dung lượng quá lớn. Vui lòng chọn dưới 200MB.' });
        return;
      }

      setMediaFiles(files);
      setMessage({ type: 'info', text: `Đã chọn ${files.length} tệp. Sẵn sàng tải lên.` });
    }
  };

  const handleUpload = async () => {
    if (mediaFiles.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 hình ảnh hoặc video!' });
      return;
    }

    setIsUploading(true);
    setMessage({ type: 'info', text: 'Đang tải dữ liệu lên hệ thống, vui lòng đợi...' });

    const formData = new FormData();
    // Vòng lặp nối tất cả các file vào cùng một biến 'media' để khớp với Backend
    mediaFiles.forEach(file => formData.append('media', file));
    formData.append('employee_code', employeeCode);
    formData.append('work_date', workDate);

    try {
      const data = await api.uploadEvidence(formData);
      setMessage({ type: 'success', text: 'Đã tải lên bằng chứng thành công!' });
      setMediaFiles([]); // Xóa rỗng input sau khi up xong
      if (onUploadSuccess) onUploadSuccess(data.fileIds);
    } catch (error) {
      console.error('Lỗi upload:', error);
      setMessage({ type: 'error', text: error.message || 'Không thể kết nối đến máy chủ.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white mt-2">
      <h4 className="text-sm font-semibold mb-2 text-slate-800">Bổ sung Bằng chứng</h4>
      
      <div className="mb-2">
        <input 
          type="file" 
          accept="video/*, image/*" 
          multiple // Đã thêm thuộc tính cho phép chọn nhiều file
          onChange={handleFileChange}
          className="block w-full text-xs text-slate-500
            file:mr-3 file:py-1 file:px-3
            file:rounded file:border-0
            file:text-xs file:font-medium
            file:bg-slate-100 file:text-slate-700
            hover:file:bg-slate-200"
        />
      </div>

      {message.text && (
        <p className={`text-xs mb-2 ${
          message.type === 'error' ? 'text-red-600' : 
          message.type === 'success' ? 'text-green-600' : 'text-blue-600'
        }`}>
          {message.text}
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={mediaFiles.length === 0 || isUploading}
        className={`w-full py-1.5 px-3 rounded text-xs font-medium text-white transition-colors
          ${(mediaFiles.length === 0 || isUploading) 
            ? 'bg-slate-300 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isUploading ? 'Đang xử lý...' : 'Tải lên tất cả'}
      </button>
    </div>
  );
};

export default EvidenceUpload;
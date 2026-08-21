import React, { useState } from 'react';
import { api } from '../api';

const EvidenceUpload = ({ employeeCode, workDate, onUploadSuccess }) => {
  const [videoFile, setVideoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Video quá lớn. Vui lòng quay video ngắn hơn (dưới 50MB).' });
        return;
      }
      setVideoFile(file);
      setMessage({ type: '', text: '' });
    }
  };

  const handleUpload = async () => {
    if (!videoFile) {
      setMessage({ type: 'error', text: 'Vui lòng quay hoặc chọn video!' });
      return;
    }

    setIsUploading(true);
    setMessage({ type: 'info', text: 'Đang tải video lên, vui lòng đợi...' });

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('employee_code', employeeCode);
    formData.append('work_date', workDate);

    try {
      const data = await api.uploadEvidence(formData);
      setMessage({ type: 'success', text: 'Tải video lên thành công!' });
      setVideoFile(null);
      if (onUploadSuccess) onUploadSuccess(data.fileId);
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
          accept="video/*" 
          capture="environment"
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
        disabled={!videoFile || isUploading}
        className={`w-full py-1.5 px-3 rounded text-xs font-medium text-white transition-colors
          ${(!videoFile || isUploading) 
            ? 'bg-slate-300 cursor-not-allowed' 
            : 'bg-accent hover:bg-accent-dark'}`}
      >
        {isUploading ? 'Đang xử lý...' : 'Tải lên'}
      </button>
    </div>
  );
};

export default EvidenceUpload;
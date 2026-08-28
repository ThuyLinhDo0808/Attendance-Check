import React, { useState } from 'react';
import { api } from '../api';

const EvidenceUpload = ({ employeeCode, workDate, onUploadSuccess }) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const combinedFiles = [...mediaFiles, ...newFiles];

    if (combinedFiles.length > 5) {
      return setMessage({ type: 'error', text: 'You can only upload up to 5 files at a time!' });
    }
    
    // Giới hạn 2GB (2000MB)
    const totalSize = combinedFiles.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 2000 * 1024 * 1024) {
      return setMessage({ type: 'error', text: 'Total file size exceeds 2GB.' });
    }

    setMediaFiles(combinedFiles);
    setMessage({ type: '', text: '' }); // Xóa thông báo lỗi cũ nếu có
    
    // Reset input file để có thể chọn lại đúng file đó nếu vừa xóa
    e.target.value = null; 
  };

  // Nút xóa file khỏi danh sách chờ tải lên
  const removeSelectedFile = (indexToRemove) => {
    setMediaFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (mediaFiles.length === 0) return setMessage({ type: 'error', text: 'Please select a file!' });

    setIsUploading(true);
    setMessage({ type: 'info', text: 'Uploading, please wait (this may take a few minutes for large files)...' });

    const formData = new FormData();
    mediaFiles.forEach(file => formData.append('media', file));
    formData.append('employee_code', employeeCode);
    formData.append('work_date', workDate);

    try {
      const data = await api.uploadEvidence(formData);
      setMessage({ type: 'success', text: 'Upload successful!' });
      setMediaFiles([]);
      if (onUploadSuccess) onUploadSuccess(data.fileIds);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error connecting to server.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border border-slate-200 rounded-lg shadow-sm bg-slate-50 mt-2">
      <h4 className="text-sm font-semibold mb-3 text-slate-800">Add more evidence</h4>
      
      {/* Nút Chọn File */}
      <div className="relative mb-3">
        <input 
          type="file" 
          accept="video/*, image/*" 
          multiple 
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-medium file:bg-white file:text-slate-700 file:shadow-sm hover:file:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Hiển thị danh sách file đang chờ tải lên */}
      {mediaFiles.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {mediaFiles.map((file, idx) => (
            <li key={idx} className="flex justify-between items-center bg-white px-2 py-1.5 rounded border border-slate-200 text-xs shadow-sm">
              <span className="truncate max-w-[80%] text-slate-600 font-medium">{file.name}</span>
              <button 
                onClick={() => removeSelectedFile(idx)} 
                disabled={isUploading}
                className="text-slate-400 hover:text-red-500 font-bold px-1 transition-colors disabled:opacity-50"
                title="Remove this file"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Thông báo trạng thái */}
      {message.text && (
        <p className={`text-xs mb-3 font-medium ${message.type === 'error' ? 'text-red-600' : message.type === 'success' ? 'text-green-600' : 'text-blue-600'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={mediaFiles.length === 0 || isUploading}
        className="w-full py-2 px-3 rounded-md text-xs font-semibold text-white transition-all disabled:bg-slate-300 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-sm"
      >
        {isUploading ? 'Processing...' : `Upload ${mediaFiles.length} files`}
      </button>
    </div>
  );
};

export default EvidenceUpload;
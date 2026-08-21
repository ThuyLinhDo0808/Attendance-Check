import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { MagnifyingGlassIcon, CheckCircleIcon, ExclamationCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function EvidenceManager() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [selectedLogIds, setSelectedLogIds] = useState([]); // Đổi sang quản lý bằng logId
  const [isUploading, setIsUploading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchLateLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceLogs({ lateOnly: true });
      setLogs(data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLateLogs(); }, [fetchLateLogs]);

  // Hàm gom nhóm danh sách đi muộn theo Ngày
  const logsByDate = logs.reduce((acc, log) => {
    const dateStr = new Date(log.work_date).toLocaleDateString('vi-VN');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {});

  const toggleTag = (logId) => {
    setSelectedLogIds(prev => prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]);
  };

  const handleUpload = async (files, logIdsArray) => {
    if (files.length === 0 || files.length > 5) return alert("Chọn từ 1 đến 5 file!");
    
    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('media', file));
    // Truyền mảng log_ids thay vì mã nhân viên
    formData.append('log_ids', JSON.stringify(logIdsArray)); 

    try {
      await api.uploadEvidence(formData);
      alert('Tải bằng chứng và Tag tên thành công!');
      setBulkMode(false);
      setBulkFiles([]);
      setSelectedLogIds([]);
      fetchLateLogs();
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally { setIsUploading(false); }
  };

  const getEvidenceArray = (evidence_files) => {
    if (!evidence_files) return [];
    if (Array.isArray(evidence_files)) return evidence_files;
    try { return JSON.parse(evidence_files); } catch { return []; }
  };

  const filteredLogs = logs.filter(log => {
    const hasEvidence = getEvidenceArray(log.evidence_files).length > 0;
    if (filterStatus === 'MISSING' && hasEvidence) return false;
    if (filterStatus === 'UPLOADED' && !hasEvidence) return false;
    if (searchTerm && !log.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) && !log.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-4">Đang tải dữ liệu...</div>;

  return (
    <div className="bg-white shadow-sm rounded-lg border border-slate-200">
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Quản lý Bằng Chứng</h2>
            <p className="text-sm text-slate-500">Video sẽ được lưu thẳng vào thư mục gốc của Drive.</p>
          </div>
          <button 
            onClick={() => setBulkMode(!bulkMode)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <UserGroupIcon className="w-5 h-5" />
            {bulkMode ? 'Đóng chế độ Tag' : 'Up Video Chung & Tag Tên'}
          </button>
        </div>

        {bulkMode && (
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-lg mb-6 shadow-inner">
            <h3 className="font-semibold text-blue-800 mb-3">1. Chọn video (Dùng chung cho nhóm):</h3>
            <input 
              type="file" multiple accept="video/*, image/*" 
              onChange={e => setBulkFiles(Array.from(e.target.files))}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 mb-5"
            />
            
            <h3 className="font-semibold text-blue-800 mb-3">2. Đánh dấu những người có trong video:</h3>
            <div className="bg-white p-4 rounded border border-blue-100 max-h-72 overflow-y-auto">
              {Object.keys(logsByDate).map(date => (
                <div key={date} className="mb-5 last:mb-0">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
                    Đi muộn ngày: <span className="text-blue-600">{date}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {logsByDate[date].map(log => {
                      const hasEvd = getEvidenceArray(log.evidence_files).length > 0;
                      return (
                        <label key={log.id} className={`flex items-center gap-2 cursor-pointer text-sm p-2 rounded border ${hasEvd ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white hover:bg-blue-50 border-blue-100'}`}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer" 
                            checked={selectedLogIds.includes(log.id)} 
                            onChange={() => toggleTag(log.id)} 
                          />
                          <div className="flex flex-col">
                            <span className="truncate font-medium text-slate-700">{log.employee_name}</span>
                            {hasEvd && <span className="text-[10px] text-green-600">Đã có bằng chứng</span>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end items-center gap-4 border-t border-blue-100 pt-4">
              <span className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                Đã tag: {selectedLogIds.length} bản ghi
              </span>
              <button 
                onClick={() => handleUpload(bulkFiles, selectedLogIds)}
                disabled={selectedLogIds.length === 0 || bulkFiles.length === 0 || isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Đang tải lên...' : 'Xác nhận Upload & Tag'}
              </button>
            </div>
          </div>
        )}
        
        <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-md">
            {['ALL', 'MISSING', 'UPLOADED'].map(status => (
              <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-1.5 text-sm font-medium rounded ${filterStatus === status ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>
                {status === 'ALL' ? 'Tất cả' : status === 'MISSING' ? 'Chưa có' : 'Đã tải lên'}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Tìm kiếm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 border rounded-md text-sm" />
          </div>
        </div>
      </div>

      <div className="p-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
        {filteredLogs.map(log => {
          const evidenceFiles = getEvidenceArray(log.evidence_files);
          return (
            <div key={log.id} className={`border rounded-lg p-5 flex flex-col ${evidenceFiles.length > 0 ? 'border-green-200 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 text-base">{log.employee_name} <span className="text-slate-500 font-normal">({log.employee_code})</span></h3>
                  <div className="text-sm text-slate-600 mt-1">Ngày vi phạm: <span className="font-medium text-slate-800">{new Date(log.work_date).toLocaleDateString('vi-VN')}</span></div>
                  <div className="text-sm text-red-600 font-medium">Muộn: {log.minutes_late} phút</div>
                </div>
                <div>
                  {evidenceFiles.length > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-semibold"><CheckCircleIcon className="w-4 h-4" /> Đã có ({evidenceFiles.length})</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full text-xs font-semibold"><ExclamationCircleIcon className="w-4 h-4" /> Trống</span>
                  )}
                </div>
              </div>
              <div className="flex-1 border-t border-slate-100 pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tệp đính kèm</span>
                  <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 text-xs py-1.5 px-3 rounded font-medium transition-colors">
                    + Cập nhật riêng
                    <input type="file" multiple className="hidden" onChange={(e) => handleUpload(Array.from(e.target.files), [log.id])} />
                  </label>
                </div>
                {evidenceFiles.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {evidenceFiles.map((fileId, index) => (
                      <div key={fileId} className="relative w-full rounded-md border border-slate-200 bg-slate-100 overflow-hidden shadow-sm" style={{ paddingTop: '56.25%' }}>
                        <iframe title={`video-${index}`} src={`https://drive.google.com/file/d/${fileId}/preview`} className="absolute top-0 left-0 w-full h-full border-0"></iframe>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-sm text-slate-400 py-6 text-center italic border border-dashed border-slate-200 rounded-md">Chưa có video/hình ảnh nào.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
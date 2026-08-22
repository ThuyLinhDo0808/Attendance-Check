import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { MagnifyingGlassIcon, CheckCircleIcon, ExclamationCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function EvidenceManager() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const [uploadLogs, setUploadLogs] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const logsByDate = logs.reduce((acc, log) => {
    const dateStr = new Date(log.work_date).toLocaleDateString('vi-VN');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {});

  const toggleTag = (logId) => {
    setSelectedLogIds(prev => prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]);
  };

  // Tính năng 2: Đánh dấu thủ công không cần file
  const handleManualMark = async (logIdsArray) => {
    if (logIdsArray.length === 0) return alert("Chưa chọn bản ghi nào!");
    if (!window.confirm("Are you sure you want to mark these logs as having evidence without uploading a video?")) return;

    setIsUploading(true);
    try {
        const res = await fetch('/api/attendance/mark-manual-evidence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_ids: logIdsArray })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        alert('Confirmed!');
        setBulkMode(false);
        setSelectedLogIds([]);
        fetchLateLogs();
    } catch (err) {
        alert(`Lỗi: ${err.message}`);
    } finally { setIsUploading(false); }
  };

  const handleUpload = async (files, logIdsArray) => {
    if (files.length === 0 || files.length > 5) return alert("Please select between 1 and 5 files!");
    
    setIsUploading(true);
    setUploadLogs(["⏳ Preparing files and connecting to server..."]);
    setUploadProgress(10);

    const formData = new FormData();
    files.forEach(file => formData.append('media', file));
    formData.append('log_ids', JSON.stringify(logIdsArray)); 

    const firstLog = logs.find(l => logIdsArray.includes(l.id));
    const dateString = firstLog ? new Date(firstLog.work_date).toLocaleDateString('vi-VN') : 'Evidence';
    formData.append('custom_name', dateString);

    // Giả lập Progress Bar để user biết hệ thống vẫn đang chạy
    const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 85 ? prev + 3 : prev));
    }, 2000);

    setTimeout(() => {
        setUploadLogs(prev => [...prev, "🚀 Uploading files to Google Drive... (This may take 1-3 minutes depending on file size)"]);
        setUploadProgress(30);
    }, 1500);

    try {
      await api.uploadEvidence(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadLogs(prev => [...prev, "✅ Successfully uploaded and tagged!"]);

      setTimeout(() => {
          setBulkMode(false);
          setBulkFiles([]);
          setSelectedLogIds([]);
          setUploadLogs([]);
          setUploadProgress(0);
          fetchLateLogs();
      }, 2500);
    } catch (err) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setUploadLogs(prev => [...prev, `❌ Error: ${err.message}`]);
      setIsUploading(false);
    } 
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

  if (loading) return <div className="p-4">Data Uploading...</div>;

  return (
    <div className="bg-white shadow-sm rounded-lg border border-slate-200">
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Evidence Manager</h2>
            <p className="text-sm text-slate-500">The system will automatically rename video files according to the date of lateness.</p>
          </div>
          <button 
            onClick={() => setBulkMode(!bulkMode)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <UserGroupIcon className="w-5 h-5" />
            {bulkMode ? 'Close Bulk Mode' : 'Upload Common Video & Tag Names'}
          </button>
        </div>

        {bulkMode && (
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-lg mb-6 shadow-inner">
            <h3 className="font-semibold text-blue-800 mb-3">1. Select Video (Maximum 5 files):</h3>
            <input 
              type="file" multiple accept="video/*, image/*" 
              onChange={e => setBulkFiles(Array.from(e.target.files))}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 mb-5"
            />
            
            <h3 className="font-semibold text-blue-800 mb-3">2. Mark individuals in the video:</h3>
            <div className="bg-white p-4 rounded border border-blue-100 max-h-72 overflow-y-auto">
              {Object.keys(logsByDate).map(date => (
                <div key={date} className="mb-5 last:mb-0">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
                    Late day: <span className="text-blue-600">{date}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {logsByDate[date].map(log => {
                      const hasEvd = getEvidenceArray(log.evidence_files).length > 0;
                      return (
                        <label key={log.id} className={`flex items-center gap-2 cursor-pointer text-sm p-2 rounded border ${hasEvd ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white hover:bg-blue-50 border-blue-100'}`}>
                          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded cursor-pointer" 
                            checked={selectedLogIds.includes(log.id)} onChange={() => toggleTag(log.id)} />
                          <div className="flex flex-col">
                            <span className="truncate font-medium text-slate-700">{log.employee_name}</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col md:flex-row justify-end items-center gap-4 border-t border-blue-100 pt-4">
              <span className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                Selected: {selectedLogIds.length} records
              </span>
              
              {/* Nút đánh dấu không cần file */}
              <button 
                onClick={() => handleManualMark(selectedLogIds)}
                disabled={selectedLogIds.length === 0 || isUploading}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm underline disabled:opacity-50"
              >
                Skip (Mark as Having Evidence)
              </button>

              <button 
                onClick={() => handleUpload(bulkFiles, selectedLogIds)}
                disabled={selectedLogIds.length === 0 || bulkFiles.length === 0 || isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Processing...' : 'Confirm Upload & Tag'}
              </button>
            </div>

            {/* Khung Console hiển thị Log & Progress Bar */}
            {isUploading && (
              <div className="mt-4 bg-slate-900 p-4 rounded-lg shadow-inner">
                <div className="font-mono text-xs text-green-400 space-y-1 mb-3">
                  {uploadLogs.map((logMsg, idx) => <div key={idx}>{logMsg}</div>)}
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-md">
            {['ALL', 'MISSING', 'UPLOADED'].map(status => (
              <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-1.5 text-sm font-medium rounded ${filterStatus === status ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}>
                {status === 'ALL' ? 'All' : status === 'MISSING' ? 'Missing' : 'Uploaded'}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 border rounded-md text-sm" />
          </div>
        </div>
      </div>

      <div className="p-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
        {filteredLogs.map(log => {
          const evidenceFiles = getEvidenceArray(log.evidence_files);
          const isManualMark = evidenceFiles.includes("MANUAL_MARK_NO_FILE");
          const driveFiles = evidenceFiles.filter(id => id !== "MANUAL_MARK_NO_FILE");
          const hasEvidence = evidenceFiles.length > 0;

          return (
            <div key={log.id} className={`border rounded-lg p-5 flex flex-col ${hasEvidence ? 'border-green-200 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 text-base">{log.employee_name} <span className="text-slate-500 font-normal">({log.employee_code})</span></h3>
                  <div className="text-sm text-slate-600 mt-1">Violation Date: <span className="font-medium text-slate-800">{new Date(log.work_date).toLocaleDateString('vi-VN')}</span></div>
                  <div className="text-sm text-red-600 font-medium">Late: {log.minutes_late} minutes</div>
                </div>
                <div>
                  {hasEvidence ? (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full text-xs font-semibold"><CheckCircleIcon className="w-4 h-4" /> Has Evidence</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full text-xs font-semibold"><ExclamationCircleIcon className="w-4 h-4" /> Missing</span>
                  )}
                </div>
              </div>
              <div className="flex-1 border-t border-slate-100 pt-4">
                
                {isManualMark && (
                  <div className="text-sm text-green-600 font-medium mb-3">✓ Marked manually (No video saved)</div>
                )}

                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Drive Files</span>
                  <label className="cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 text-xs py-1.5 px-3 rounded font-medium transition-colors">
                    + Update Video
                    <input type="file" multiple className="hidden" onChange={(e) => handleUpload(Array.from(e.target.files), [log.id])} />
                  </label>
                </div>
                
                {driveFiles.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {driveFiles.map((fileId, index) => (
                      <div key={fileId} className="relative w-full rounded-md border border-slate-200 bg-slate-100 overflow-hidden shadow-sm" style={{ paddingTop: '56.25%' }}>
                        <iframe title={`video-${index}`} src={`https://drive.google.com/file/d/${fileId}/preview`} className="absolute top-0 left-0 w-full h-full border-0"></iframe>
                      </div>
                    ))}
                  </div>
                ) : (
                  !isManualMark && <div className="text-sm text-slate-400 py-6 text-center italic border border-dashed border-slate-200 rounded-md">No video/images available.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
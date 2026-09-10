import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { 
  MagnifyingGlassIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  UserGroupIcon,
  ArchiveBoxIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

export default function EvidenceManager() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const [uploadLogs, setUploadLogs] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cardUploadStatus, setCardUploadStatus] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchLateLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceLogs({ lateOnly: true, month: selectedMonth });
      setLogs(data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, [selectedMonth]); 

  useEffect(() => { fetchLateLogs(); }, [fetchLateLogs]);

  const getEvidenceArray = (evidence_files) => {
    if (!evidence_files) return [];
    if (Array.isArray(evidence_files)) return evidence_files;
    try { return JSON.parse(evidence_files); } catch { return []; }
  };

  const toggleTag = (logId) => {
    setSelectedLogIds(prev => prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]);
  };

  const handleBulkFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const combinedFiles = [...bulkFiles, ...newFiles];

    if (combinedFiles.length > 5) {
      return alert('You can only select up to 5 files at a time!');
    }
    
    const totalSize = combinedFiles.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 2000 * 1024 * 1024) {
      return alert('Total file size exceeds 2GB.');
    }

    setBulkFiles(combinedFiles);
    e.target.value = null; // Reset input để có thể chọn lại file vừa xóa
  };

  const removeBulkFile = (indexToRemove) => {
    setBulkFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleManualMark = async (logIdsArray) => {
    if (logIdsArray.length === 0) return alert("Please select at least one record!");
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

        alert('Confirmed manually!');
        setBulkMode(false);
        setSelectedLogIds([]);
        fetchLateLogs();
    } catch (err) { alert(`Error: ${err.message}`); } 
    finally { setIsUploading(false); }
  };

  const handleArchiveMonth = async () => {
    const month = window.prompt("Enter the month to archive offline (Format: YYYY-MM):", selectedMonth);
    if (!month) return;
    if (!/^\d{4}-\d{2}$/.test(month)) return alert("Invalid format! Please use YYYY-MM (e.g., 2026-08)");

    if (!window.confirm(`⚠️ IMPORTANT:\nThis action will freeze all evidence for ${month}.\n\nHave you ALREADY DOWNLOADED the ZIP file of this month's videos from Google Drive to your local computer?`)) return;

    try {
        const res = await fetch('/api/attendance/archive-month', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        alert(data.message + "\nYou can now safely delete this month's videos on Google Drive to free up space!");
        fetchLateLogs();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
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

    const progressInterval = setInterval(() => {
        setUploadProgress(prev => (prev < 85 ? prev + 3 : prev));
    }, 2000);

    setTimeout(() => {
        setUploadLogs(prev => [...prev, "🚀 Uploading files to Google Drive... (This may take 1-3 minutes)"]);
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

  const handleIndividualUpload = async (files, logId) => {
    if (files.length === 0 || files.length > 5) return alert("Please select between 1 and 5 files!");
    
    // Đặt trạng thái thẻ thành đang tải lên
    setCardUploadStatus(prev => ({
      ...prev,
      [logId]: { status: 'uploading', message: 'Uploading...' }
    }));

    const formData = new FormData();
    files.forEach(file => formData.append('media', file));
    formData.append('log_ids', JSON.stringify([logId])); 

    const targetLog = logs.find(l => l.id === logId);
    const dateString = targetLog ? new Date(targetLog.work_date).toLocaleDateString('vi-VN') : 'Evidence';
    formData.append('custom_name', dateString);

    try {
      await api.uploadEvidence(formData);
      
      // Thành công: Hiển thị thông báo xanh
      setCardUploadStatus(prev => ({
        ...prev,
        [logId]: { status: 'success', message: 'Upload successful!' }
      }));

      // Tự động xóa thông báo và tải lại danh sách sau 2 giây
      setTimeout(() => {
        setCardUploadStatus(prev => {
          const newState = { ...prev };
          delete newState[logId];
          return newState;
        });
        fetchLateLogs();
      }, 2000);
      
    } catch (err) {
      // Thất bại: Hiển thị lỗi đỏ
      setCardUploadStatus(prev => ({
        ...prev,
        [logId]: { status: 'error', message: err.message || 'Upload failed.' }
      }));
    }
  };

  // 3. Filter và Sorting logic
  let filteredLogs = logs.filter(log => {
    const hasEvidence = getEvidenceArray(log.evidence_files).length > 0;
    if (filterStatus === 'MISSING' && hasEvidence) return false;
    if (filterStatus === 'UPLOADED' && !hasEvidence) return false;
    if (searchTerm && !log.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) && !log.employee_code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Sort by Date (Descending) -> then by Evidence Status (Missing first)
  filteredLogs = filteredLogs.sort((a, b) => {
    const dateA = new Date(a.work_date).getTime();
    const dateB = new Date(b.work_date).getTime();
    if (dateA !== dateB) return dateB - dateA; 
    
    const aHasEvd = getEvidenceArray(a.evidence_files).length > 0;
    const bHasEvd = getEvidenceArray(b.evidence_files).length > 0;
    return aHasEvd === bHasEvd ? 0 : (aHasEvd ? 1 : -1);
  });

  // Group by Date for both Bulk Upload and Main List
  const logsByDate = filteredLogs.reduce((acc, log) => {
    const dateStr = new Date(log.work_date).toLocaleDateString('en-GB'); // Format: DD/MM/YYYY
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {});

  const handleDeleteFile = async (logId, fileId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa video này khỏi hệ thống và Google Drive?")) return;
    
    try {
        const res = await fetch('/api/attendance/delete-evidence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_id: logId, file_id: fileId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        fetchLateLogs(); // Refresh lại danh sách sau khi xóa
    } catch (err) {
        alert(`Lỗi khi xóa file: ${err.message}`);
    }
  };

  if (loading) return <div className="p-4 flex justify-center items-center h-40 text-slate-500 font-medium">Data is loading...</div>;

  return (
    <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Evidence Manager</h2>
            <p className="text-sm text-slate-500 mt-1">Manage attendance evidence records</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleArchiveMonth}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-slate-300 shadow-sm"
            >
              <ArchiveBoxIcon className="w-4 h-4" />
              Archive {selectedMonth}
            </button>

            <button 
              onClick={() => setBulkMode(!bulkMode)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <UserGroupIcon className="w-4 h-4" />
              {bulkMode ? 'Close Bulk Mode' : 'Upload Bulk Evidence'}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 p-2 rounded-lg border border-slate-200">
          <div className="flex flex-wrap items-center gap-3 w-full">
            <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-300 rounded-md shadow-sm">
              <CalendarIcon className="w-5 h-5 text-slate-400" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm outline-none text-slate-700 font-semibold cursor-pointer bg-transparent"
              />
            </div>

            <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-md">
              {['ALL', 'MISSING', 'UPLOADED'].map(status => (
                <button 
                  key={status} 
                  onClick={() => setFilterStatus(status)} 
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${filterStatus === status ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  {status === 'ALL' ? 'All' : status === 'MISSING' ? 'Missing Video' : 'Uploaded'}
                </button>
              ))}
            </div>

            <div className="relative flex-1 md:max-w-xs ml-auto">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search by name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
          </div>
        </div>
      </div>

      {bulkMode && (
          <div className="m-6 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 mb-2">1. Select Evidence Files (Max 5 files)</h3>
              <div className="relative border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg p-4 text-center">
                <input 
                  type="file" multiple accept="video/*, image/*" 
                  onChange={handleBulkFileChange}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="text-sm font-medium text-slate-600 pointer-events-none">Drag and drop files here or click to select</span>
              </div>

              {bulkFiles.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {bulkFiles.map((file, idx) => (
                    <li key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded-md border border-slate-200 text-sm shadow-sm">
                      <span className="truncate max-w-[90%] text-slate-700 font-medium">{file.name}</span>
                      <button onClick={() => removeBulkFile(idx)} disabled={isUploading} className="text-slate-400 hover:text-red-500 font-bold px-2 transition-colors disabled:opacity-50">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
                    
            <div>
              <h3 className="font-bold text-slate-800 mb-3">2. Tag Violating Employees</h3>
              <div className="bg-slate-50/50 p-5 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                {Object.keys(logsByDate).map(date => (
                  <div key={date} className="mb-6 last:mb-0">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      Violation Date <span className="text-slate-700 bg-slate-200 px-2 py-0.5 rounded">{date}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {logsByDate[date].map(log => {
                        const hasEvd = getEvidenceArray(log.evidence_files).length > 0;
                        const isChecked = selectedLogIds.includes(log.id);
                        
                        return (
                          <label key={log.id} className={`flex items-start gap-3 cursor-pointer text-sm p-3 rounded-lg border transition-all duration-200 ${hasEvd ? 'bg-slate-100 border-slate-200 opacity-60' : isChecked ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                            <input type="checkbox" className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                              checked={isChecked} onChange={() => toggleTag(log.id)} />
                            <div className="flex flex-col">
                              <span className="truncate font-semibold text-slate-800">{log.employee_name}</span>
                              {!hasEvd && <span className="text-[11px] text-red-500 font-medium mt-0.5">No video</span>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col md:flex-row justify-end items-center gap-4 border-t border-slate-200 pt-5">
              <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
                Selected: {selectedLogIds.length} employees
              </span>
              
              <button 
                onClick={() => handleManualMark(selectedLogIds)}
                disabled={selectedLogIds.length === 0 || isUploading}
                className="text-slate-500 hover:text-slate-800 font-semibold text-sm underline disabled:opacity-50"
              >
                Manual Mark (No file)
              </button>

              <button 
                onClick={() => handleUpload(bulkFiles, selectedLogIds)}
                disabled={selectedLogIds.length === 0 || bulkFiles.length === 0 || isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Processing...' : 'Upload & Attach Tags'}
              </button>
            </div>

            {isUploading && (
              <div className="mt-5 bg-slate-800 p-4 rounded-lg shadow-inner">
                <div className="font-mono text-xs text-emerald-400 space-y-1 mb-3">
                  {uploadLogs.map((logMsg, idx) => <div key={idx}>{logMsg}</div>)}
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}
          </div>
        )}

      <div className="p-6 bg-slate-50/50">
        {Object.keys(logsByDate).length === 0 && (
          <div className="py-12 text-center text-slate-500 bg-white border border-dashed rounded-xl border-slate-300">
            No matching violation records found.
          </div>
        )}
        
        {Object.keys(logsByDate).map(date => (
          <div key={date} className="mb-8 last:mb-0">
            {/* Cấu trúc ngăn cách bằng Line và Date */}
            <div className="flex items-center gap-4 mb-5">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                {date}
              </h3>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              {logsByDate[date].map(log => {
                const evidenceFiles = getEvidenceArray(log.evidence_files);
                const isArchived = evidenceFiles.includes("ARCHIVED_OFFLINE");
                const isManualMark = evidenceFiles.includes("MANUAL_MARK_NO_FILE");
                const driveFiles = evidenceFiles.filter(id => id !== "MANUAL_MARK_NO_FILE" && id !== "ARCHIVED_OFFLINE");
                const hasEvidence = evidenceFiles.length > 0;

                return (
                  <div key={log.id} className={`border rounded-xl p-5 flex flex-col transition-all ${hasEvidence ? 'border-slate-200 bg-white shadow-sm hover:shadow' : 'border-red-200 bg-red-50/30 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{log.employee_name} <span className="text-slate-400 font-medium text-sm">({log.employee_code})</span></h3>
                        <div className="flex gap-2 mt-2">
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">{new Date(log.work_date).toLocaleDateString('en-GB')}</span>
                          <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-semibold border border-red-100">{log.minutes_late} mins late</span>
                        </div>
                      </div>
                      <div>
                        {hasEvidence ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-bold"><CheckCircleIcon className="w-4 h-4" /> Has Evidence</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-md text-xs font-bold animate-pulse"><ExclamationCircleIcon className="w-4 h-4" /> Missing Video</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 border-t border-slate-100 pt-4">
                      
                      {isArchived ? (
                        <div className="text-sm text-slate-600 font-medium mb-3 flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <ArchiveBoxIcon className="w-5 h-5 text-slate-400" />
                          Evidence has been ZIP archived.
                        </div>
                      ) : isManualMark ? (
                        <div className="text-sm text-emerald-600 font-semibold mb-3 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">✓ Manually verified (No file)</div>
                      ) : null}

                      {!isArchived && (
                        <>
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Drive Files</span>
                            
                            <div className="flex items-center gap-2">
                              {/* Hiển thị thông báo trạng thái */}
                              {cardUploadStatus[log.id]?.status === 'error' && (
                                <span className="text-[11px] text-red-600 font-semibold bg-red-50 px-2 py-1 rounded border border-red-100 max-w-[150px] truncate" title={cardUploadStatus[log.id].message}>
                                  {cardUploadStatus[log.id].message}
                                </span>
                              )}
                              {cardUploadStatus[log.id]?.status === 'success' && (
                                <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                  {cardUploadStatus[log.id].message}
                                </span>
                              )}

                              <label className={`cursor-pointer bg-white text-slate-600 border border-slate-300 text-xs py-1.5 px-3 rounded-md font-semibold transition-colors shadow-sm ${cardUploadStatus[log.id]?.status === 'uploading' ? 'opacity-50 cursor-wait' : 'hover:bg-slate-50 hover:text-blue-600'}`}>
                                {cardUploadStatus[log.id]?.status === 'uploading' ? 'Uploading...' : '+ Update Video'}
                                <input 
                                  type="file" 
                                  multiple 
                                  className="hidden" 
                                  disabled={cardUploadStatus[log.id]?.status === 'uploading'}
                                  onClick={(e) => (e.target.value = null)}
                                  onChange={(e) => handleIndividualUpload(Array.from(e.target.files), log.id)} 
                                />
                              </label>
                            </div>
                          </div>
                          
                          {driveFiles.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                              {driveFiles.map((fileId, index) => (
                                <div key={fileId} className="relative w-full rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shadow-sm flex-col group" style={{ paddingTop: '56.25%' }}>
                                  <button 
                                    onClick={() => handleDeleteFile(log.id, fileId)}
                                    className="absolute top-2 right-2 z-10 bg-red-500/90 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100"
                                    title="Delete video"
                                  >✕</button>
                                  <iframe title={`video-${index}`} src={`https://drive.google.com/file/d/${fileId}/preview`} className="absolute top-0 left-0 w-full h-full border-0"></iframe>
                                </div>
                              ))}
                            </div>
                          ) : (
                            !isManualMark && <div className="text-sm text-slate-400 py-6 text-center font-medium border border-dashed border-slate-200 rounded-lg bg-slate-50">No evidence video uploaded.</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
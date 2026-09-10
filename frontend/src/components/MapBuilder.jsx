import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { 
  PlusIcon, 
  CheckIcon, 
  ArchiveBoxIcon, 
  MapIcon, 
  CursorArrowRaysIcon, 
  SparklesIcon, 
  XMarkIcon, 
  PhotoIcon,
  InformationCircleIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

export default function MapBuilder() {
  const svgRef = useRef(null);
  const [layout, setLayout] = useState({ tables: [], seats: [] });
  const [dragging, setDragging] = useState(null); 
  const [saving, setSaving] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]); 

  // Trạng thái lưu lịch sử (History Stack) cho tính năng Undo
  const [history, setHistory] = useState([]);
  const layoutBeforeDrag = useRef(null);

  // States cho AI Ingestion & Guide Panel
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processLogs, setProcessLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    api.getOfficeLayout().then(setLayout).catch(console.error);
  }, []);

  // Hàm phục hồi trạng thái (Undo)
  const handleUndo = useCallback(() => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;
      const newHistory = [...prevHistory];
      const previousState = newHistory.pop();
      setLayout(previousState);
      setSelectedNodes([]); // Xóa selection để tránh lỗi tham chiếu
      return newHistory;
    });
  }, []);

  const getMouseCoords = (e) => {
    const CTM = svgRef.current.getScreenCTM();
    return { x: (e.clientX - CTM.e) / CTM.a, y: (e.clientY - CTM.f) / CTM.d };
  };

  const handleMouseDown = (e, type, index) => {
    e.stopPropagation();
    const nodeId = `${type}-${index}`;
    
    if (e.shiftKey) {
      setSelectedNodes(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
    } else {
      if (!selectedNodes.includes(nodeId)) setSelectedNodes([nodeId]);
    }
    
    // Lưu trạng thái trước khi kéo thả
    layoutBeforeDrag.current = JSON.parse(JSON.stringify(layout));
    setDragging({ type, index, moved: false });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const coords = getMouseCoords(e);
    
    setLayout(prev => {
      const newLayout = { ...prev };
      const item = newLayout[dragging.type === 'table' ? 'tables' : 'seats'][dragging.index];
      
      const newX = Math.round(coords.x / 10) * 10;
      const newY = Math.round(coords.y / 10) * 10;
      const dx = newX - item.x;
      const dy = newY - item.y;

      const draggingId = `${dragging.type}-${dragging.index}`;
      if (selectedNodes.includes(draggingId)) {
        selectedNodes.forEach(nodeStr => {
          const [nType, nIdx] = nodeStr.split('-');
          const t = newLayout[nType === 'table' ? 'tables' : 'seats'][parseInt(nIdx)];
          t.x += dx;
          t.y += dy;
        });
      } else {
        item.x = newX;
        item.y = newY;
      }
      return newLayout;
    });

    setDragging(d => ({ ...d, moved: true }));
  };

  const handleMouseUp = () => {
    // Chỉ lưu vào lịch sử nếu người dùng thực sự đã kéo (di chuyển) đối tượng
    if (dragging && dragging.moved && layoutBeforeDrag.current) {
      setHistory(prev => [...prev, layoutBeforeDrag.current]);
    }
    setDragging(null);
  };
  
  const handleCanvasClick = () => setSelectedNodes([]);

  const handleKeyDown = useCallback((e) => {
    // Bắt sự kiện Ctrl + Z hoặc Cmd + Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Auto-Alignment
    if (selectedNodes.length < 2 || !e.altKey) return;
    e.preventDefault();
    
    // Lưu lịch sử trước khi căn dóng
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(layout))]);

    setLayout(prev => {
      const newLayout = { tables: [...prev.tables], seats: [...prev.seats] };
      const nodes = selectedNodes.map(nodeStr => {
        const [type, idx] = nodeStr.split('-');
        return { type, idx: parseInt(idx), ref: newLayout[type === 'table' ? 'tables' : 'seats'][parseInt(idx)] };
      });

      const minX = Math.min(...nodes.map(n => n.ref.x));
      const maxX = Math.max(...nodes.map(n => n.ref.x));
      const minY = Math.min(...nodes.map(n => n.ref.y));
      const maxY = Math.max(...nodes.map(n => n.ref.y));

      nodes.forEach(n => {
        if (e.key === 'ArrowLeft') n.ref.x = minX;
        else if (e.key === 'ArrowRight') n.ref.x = maxX;
        else if (e.key === 'ArrowUp') n.ref.y = minY;
        else if (e.key === 'ArrowDown') n.ref.y = maxY;
      });

      return newLayout;
    });
  }, [selectedNodes, layout, handleUndo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const addTable = () => {
    setHistory(prev => [...prev, layout]);
    setLayout(prev => ({ ...prev, tables: [...prev.tables, { id: `table_${Date.now()}`, x: 100, y: 100, width: 200, height: 20 }] }));
  };

  const addSeat = () => {
    setHistory(prev => [...prev, layout]);
    setLayout(prev => ({ ...prev, seats: [...prev.seats, { id: `SEAT_${Date.now()}`, x: 100, y: 130, align: 'top' }] }));
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      await fetch('/api/seats/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layout })
      });
      alert('Floor plan committed to database.');
    } catch (err) {
      alert('Error syncing layout constraints.');
    } finally {
      setSaving(false);
    }
  };

  const handleAIUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessLogs(["[Sys] Initiating payload transfer to Vision API..."]);
    setProgress(15);

    const formData = new FormData();
    formData.append('blueprint', file);

    const progressInterval = setInterval(() => {
      setProgress(p => (p < 85 ? p + 5 : p));
      setProcessLogs(p => {
        if (p.length < 2) return [...p, "[AI] Loading Segment Anything (SAM) weights..."];
        if (p.length < 3) return [...p, "[AI] Extracting bounding boxes and anchor points..."];
        return p;
      });
    }, 1500);

    try {
      const response = await fetch('/api/seats/analyze-blueprint', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Computer vision pipeline failed.');
      }

      const aiGeneratedLayout = await response.json(); 

      clearInterval(progressInterval);
      setProgress(100);
      setProcessLogs(p => [...p, "[Data] Tensors mapped to grid. Applying coordinates..."]);

      // Đẩy state hiện tại vào History Stack trước khi đắp tọa độ của AI lên
      setLayout(prev => {
        setHistory(h => [...h, prev]); 
        return { 
          tables: [...prev.tables, ...(aiGeneratedLayout.tables || [])], 
          seats: [...prev.seats, ...(aiGeneratedLayout.seats || [])] 
        };
      });

      setTimeout(() => {
        setAiModalOpen(false);
        setIsProcessing(false);
        setProcessLogs([]);
        setProgress(0);
      }, 1500);

    } catch (err) {
      clearInterval(progressInterval);
      setProcessLogs(p => [...p, `[Error] ${err.message}`]);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <header className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
             <MapIcon className="h-8 w-8 text-indigo-600"/>
             Spatial Map Builder
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Design and orchestrate the office floor plan. Changes sync directly to the Live Map.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleUndo} disabled={history.length === 0} className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-lg transition-colors border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent">
            <ArrowUturnLeftIcon className="h-4 w-4" /> Undo
          </button>
          
          <button onClick={() => setShowGuide(!showGuide)} className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold rounded-lg transition-colors border shadow-sm ${showGuide ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}>
            <InformationCircleIcon className="h-4 w-4" /> {showGuide ? 'Hide Guide' : 'Show Guide'}
          </button>
          
          <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1"></div>
          
          <button onClick={() => setAiModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-xs bg-indigo-50 font-bold text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-sm">
            <SparklesIcon className="h-4 w-4" /> AI Auto-Gen
          </button>
          <button onClick={addTable} className="flex items-center gap-2 px-4 py-2.5 text-xs bg-slate-100 font-bold text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm">
            <ArchiveBoxIcon className="h-4 w-4 text-slate-500" /> Spawn Table
          </button>
          <button onClick={addSeat} className="flex items-center gap-2 px-4 py-2.5 text-xs bg-slate-100 font-bold text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm">
            <PlusIcon className="h-4 w-4 text-slate-500" /> Spawn Seat
          </button>
          <button onClick={saveLayout} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-xs bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon className="h-4 w-4 shrink-0" /> {saving ? 'Syncing...' : 'Commit Layout'}
          </button>
        </div>
      </header>

      {/* Quick Operation Guide Panel */}
      {showGuide && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 shadow-sm anim-fade-in">
          <h3 className="text-xs font-black uppercase tracking-widest text-indigo-800 mb-4 flex items-center gap-2">
            <CursorArrowRaysIcon className="h-4 w-4" /> Keyboard-First Operation Guide
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-slate-700">
            <div>
              <strong className="block text-slate-900 font-bold mb-1.5">1. Multi-Select & Drag</strong>
              Hold <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold shadow-sm">Shift</kbd> + Click to group nodes. Dragging translates the entire cluster.
            </div>
            <div>
              <strong className="block text-slate-900 font-bold mb-1.5">2. Auto-Alignment</strong>
              Select nodes, hold <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold shadow-sm">Alt</kbd> + press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold shadow-sm">Arrows</kbd> to instantly align to the bounding edge.
            </div>
            <div>
              <strong className="block text-slate-900 font-bold mb-1.5">3. State Recovery (Undo)</strong>
              Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold shadow-sm">Ctrl + Z</kbd> to revert mistakes (including bad AI generations).
            </div>
            <div>
              <strong className="block text-slate-900 font-bold mb-1.5">4. Blueprint Ingestion</strong>
              Use <strong>AI Auto-Gen</strong> to extract grids from 2D floorplans via Vision API.
            </div>
          </div>
        </div>
      )}

      {/* AI Ingestion Modal Overlay */}
      {aiModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm anim-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-indigo-600" /> AI Floorplan Ingestion
                    </h3>
                    <button onClick={() => !isProcessing && setAiModalOpen(false)} className="text-slate-400 hover:text-slate-800">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-8">
                    {!isProcessing ? (
                        <div className="relative border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl p-10 text-center cursor-pointer">
                            <input type="file" accept="image/*" onChange={handleAIUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <PhotoIcon className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                            <span className="text-sm font-bold text-indigo-600">Click to upload 2D Blueprint (PNG/JPG)</span>
                            <p className="text-xs text-slate-500 mt-2 font-medium">Model will auto-detect desks and map grid coordinates.</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900 p-5 rounded-xl shadow-inner border border-slate-800">
                            <div className="font-mono text-[11px] text-emerald-400 space-y-1.5 mb-5 h-24 overflow-y-auto">
                                {processLogs.map((logMsg, idx) => <div key={idx}>{logMsg}</div>)}
                                <span className="animate-pulse">_</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-300 rounded-xl overflow-hidden cursor-crosshair shadow-inner relative" onClick={handleCanvasClick}>
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 py-1.5 rounded-md border border-slate-200 pointer-events-none flex items-center gap-2 shadow-sm">
            <CursorArrowRaysIcon className="h-4 w-4 text-indigo-500" /> 
            {selectedNodes.length > 0 ? `${selectedNodes.length} nodes selected` : 'Canvas Active'}
        </div>
        
        <svg 
          ref={svgRef}
          viewBox="-150 0 1030 550" 
          className="w-full h-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {layout.tables.map((table, i) => {
            const isSelected = selectedNodes.includes(`table-${i}`);
            return (
              <rect 
                key={table.id} x={table.x} y={table.y} width={table.width} height={table.height} 
                fill="#f1f5f9" stroke={isSelected ? "#4F5FEA" : "#94a3b8"} strokeWidth={isSelected ? "3" : "2"} cursor="move" rx="2"
                onMouseDown={(e) => handleMouseDown(e, 'table', i)}
                className={`transition-colors ${isSelected ? 'drop-shadow-md' : 'hover:stroke-indigo-400'}`}
              />
            )
          })}
          
          {layout.seats.map((seat, i) => {
             const isSelected = selectedNodes.includes(`seat-${i}`);
             return (
              <g key={seat.id} cursor="move" onMouseDown={(e) => handleMouseDown(e, 'seat', i)} className="transition-opacity">
                <circle cx={seat.x} cy={seat.y} r="11" fill="#ffffff" stroke={isSelected ? "#4F5FEA" : "#64748b"} strokeWidth={isSelected ? "3" : "2"} className={isSelected ? 'drop-shadow-md' : ''}/>
                <text x={seat.x} y={seat.y + 4} textAnchor="middle" fontSize="10" fill={isSelected ? "#4F5FEA" : "#475569"} fontWeight="bold" className="pointer-events-none font-mono">
                  {seat.id.slice(0, 4)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  );
}
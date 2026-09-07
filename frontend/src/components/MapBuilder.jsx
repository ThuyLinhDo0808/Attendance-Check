import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { PlusIcon, CheckIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

export default function MapBuilder() {
  const svgRef = useRef(null);
  const [layout, setLayout] = useState({ tables: [], seats: [] });
  const [dragging, setDragging] = useState(null); // { type: 'table'|'seat', index }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getOfficeLayout().then(setLayout).catch(console.error);
  }, []);

  const getMouseCoords = (e) => {
    const CTM = svgRef.current.getScreenCTM();
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const handleMouseDown = (e, type, index) => {
    e.stopPropagation();
    setDragging({ type, index });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const coords = getMouseCoords(e);
    
    setLayout(prev => {
      const newLayout = { ...prev };
      const item = newLayout[dragging.type === 'table' ? 'tables' : 'seats'][dragging.index];
      item.x = Math.round(coords.x / 10) * 10; // Snap to grid 10px
      item.y = Math.round(coords.y / 10) * 10;
      return newLayout;
    });
  };

  const handleMouseUp = () => setDragging(null);

  const addTable = () => {
    setLayout(prev => ({
      ...prev,
      tables: [...prev.tables, { id: `table_${Date.now()}`, x: 100, y: 100, width: 200, height: 20 }]
    }));
  };

  const addSeat = () => {
    setLayout(prev => ({
      ...prev,
      seats: [...prev.seats, { id: `SEAT_${Date.now()}`, x: 100, y: 130, align: 'top' }]
    }));
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      await fetch('/api/seats/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_json: layout })
      });
      alert('Layout saved successfully!');
    } catch (err) {
      alert('Error saving layout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Office Map Builder</h2>
        <div className="flex gap-3">
          <button onClick={addTable} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 font-semibold rounded-lg hover:bg-slate-200">
            <ArchiveBoxIcon className="h-4 w-4" /> Add Table
          </button>
          <button onClick={addSeat} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 font-semibold rounded-lg hover:bg-slate-200">
            <PlusIcon className="h-4 w-4" /> Add Seat
          </button>
          <button onClick={saveLayout} disabled={saving} className="flex items-center gap-1 px-4 py-1.5 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
            <CheckIcon className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-300 rounded-2xl overflow-hidden cursor-crosshair">
        <svg 
          ref={svgRef}
          viewBox="-150 0 1030 550" 
          className="w-full h-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {layout.tables.map((table, i) => (
            <rect 
              key={table.id} x={table.x} y={table.y} width={table.width} height={table.height} 
              fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" cursor="move"
              onMouseDown={(e) => handleMouseDown(e, 'table', i)}
            />
          ))}
          {layout.seats.map((seat, i) => (
            <g key={seat.id} cursor="move" onMouseDown={(e) => handleMouseDown(e, 'seat', i)}>
              <circle cx={seat.x} cy={seat.y} r="11" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
              <text x={seat.x} y={seat.y + 4} textAnchor="middle" fontSize="10" fill="#64748b" className="pointer-events-none">
                {seat.id.slice(0, 4)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
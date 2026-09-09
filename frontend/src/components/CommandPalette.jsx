import React, { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, ArrowRightIcon, CalculatorIcon, 
  MapIcon, BellAlertIcon, TableCellsIcon, ClockIcon 
} from '@heroicons/react/24/outline';
import { useShortcuts } from '../hooks/useShortcuts';

export default function CommandPalette({ setActiveTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  
  const { shortcuts } = useShortcuts();
  const paletteKey = shortcuts.open_palette;

  const COMMANDS = [
    { id: 'logger', label: 'Log Attendance (Ghi nhận điểm danh)', icon: ClockIcon },
    { id: 'excuses', label: 'Review Pending Excuses (Duyệt đơn)', icon: BellAlertIcon },
    { id: 'map-builder', label: 'Open Map Builder (Sửa sơ đồ)', icon: MapIcon },
    { id: 'analytics', label: 'View Company Analytics (Báo cáo tổng)', icon: CalculatorIcon },
    { id: 'sheet', label: 'Employee Fine Sheet (Bảng phạt cá nhân)', icon: TableCellsIcon },
    { id: 'settings', label: 'System Settings (Cài đặt hệ thống)', icon: ArrowRightIcon },
  ];

  const filteredCommands = query === '' 
    ? COMMANDS 
    : COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
        // 1. Loại bỏ các phím đơn lẻ nếu đang gõ chữ vào input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        const keys = [];
        if (e.ctrlKey) keys.push('ctrl');
        if (e.metaKey) keys.push('meta');
        if (e.altKey) keys.push('alt');
        if (e.shiftKey) keys.push('shift');
        
        if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
        keys.push(e.key.toLowerCase());
        }
        
        const pressedCombo = keys.join('+');
        
        // 2. So sánh chuỗi đã định dạng
        if (pressedCombo === paletteKey) {
        e.preventDefault();
        setIsOpen(true);
        }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [paletteKey]);

  useEffect(() => {
    if (!isOpen) return;
    if (inputRef.current) inputRef.current.focus();
    
    const handleModalKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          setActiveTab(filteredCommands[selectedIndex].id);
          setIsOpen(false);
          setQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, setActiveTab]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 anim-fade-in">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center px-4 py-4 border-b border-slate-100">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-slate-900 text-lg focus:outline-none placeholder:text-slate-400"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <li className="px-6 py-8 text-center text-sm text-slate-500">No commands found.</li>
          ) : (
            filteredCommands.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={cmd.id}
                  className={`flex items-center px-6 py-3 cursor-pointer ${isSelected ? 'bg-indigo-50' : ''}`}
                  onClick={() => {
                    setActiveTab(cmd.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <cmd.icon className={`h-5 w-5 mr-3 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{cmd.label}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
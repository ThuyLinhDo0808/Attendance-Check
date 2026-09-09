import { useState } from 'react';

// Từ điển cấu hình tập trung
export const SHORTCUT_REGISTRY = [
  { id: 'open_palette', label: 'Mở Command Palette', defaultKey: 'alt+p' },
  { id: 'tab_logger', label: 'Chuyển đến: Attendance Logger', defaultKey: 'alt+1', targetTab: 'logger' },
  { id: 'tab_analytics', label: 'Chuyển đến: Company Analytics', defaultKey: 'alt+2', targetTab: 'analytics' },
  { id: 'tab_sheet', label: 'Chuyển đến: Employee Fine Sheet', defaultKey: 'alt+3', targetTab: 'sheet' },
  { id: 'tab_excuses', label: 'Chuyển đến: Pending Excuses', defaultKey: 'alt+4', targetTab: 'excuses' },
  { id: 'tab_settings', label: 'Chuyển đến: Settings', defaultKey: 'alt+s', targetTab: 'settings' },
];

const DEFAULT_MAP = SHORTCUT_REGISTRY.reduce((acc, curr) => ({...acc, [curr.id]: curr.defaultKey}), {});

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState(() => {
    const saved = localStorage.getItem('app_shortcuts');
    return saved ? JSON.parse(saved) : DEFAULT_MAP;
  });

  const updateShortcut = (actionId, newKey) => {
    const updated = { ...shortcuts, [actionId]: newKey };
    setShortcuts(updated);
    localStorage.setItem('app_shortcuts', JSON.stringify(updated));
  };

  return { shortcuts, updateShortcut };
}
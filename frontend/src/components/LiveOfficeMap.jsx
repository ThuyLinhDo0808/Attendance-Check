import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../api';
import AssignSeatModal from './AssignSeatModal';
import { UserIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Hàm tự động viết tắt tên (VD: "Lê Thành Đạt" -> "ĐẠT LT")
function getShortName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0].toUpperCase();
  const name = parts.pop();
  const initials = parts.map(p => p[0]).join('');
  return `${name} ${initials}`.toUpperCase();
}

// Cấu hình vị trí ghế static (vẫn giữ nguyên)
const SEAT_LAYOUT = [
  // --- BÀN BOSS ---
  { id: 'BOSS', x: 40, y: 170, align: 'left' },
  // --- DÃY 1 ---
  { id: 'R1_T1', x: 260, y: 110, align: 'top'},
  { id: 'R1_T2', x: 360, y: 110, align: 'top'},
  { id: 'R1_T3', x: 460, y: 110, align: 'top'},
  { id: 'R1_T4', x: 560, y: 110, align: 'top'},
  { id: 'R1_T5', x: 660, y: 110, align: 'top'},
  { id: 'R1_B1', x: 260, y: 150, align: 'bottom'},
  { id: 'R1_B2', x: 360, y: 150, align: 'bottom'},
  { id: 'R1_B3', x: 460, y: 150, align: 'bottom'},
  { id: 'R1_B4', x: 560, y: 150, align: 'bottom'},
  { id: 'R1_B5', x: 660, y: 150, align: 'bottom'},
  // --- DÃY 2 ---
  { id: 'R2_T1', x: 260, y: 260, align: 'top'},
  { id: 'R2_T2', x: 360, y: 260, align: 'top'},
  { id: 'R2_T3', x: 460, y: 260, align: 'top'},
  { id: 'R2_T4', x: 560, y: 260, align: 'top'},
  { id: 'R2_B1', x: 260, y: 300, align: 'bottom'},
  { id: 'R2_B2', x: 360, y: 300, align: 'bottom'},
  { id: 'R2_B3', x: 460, y: 300, align: 'bottom'},
  { id: 'R2_B4', x: 560, y: 300, align: 'bottom' },
  // --- DÃY 3 ---
  { id: 'R3_T1', x: 260, y: 410, align: 'top'},
  { id: 'R3_T2', x: 360, y: 410, align: 'top'},
  { id: 'R3_T3', x: 460, y: 410, align: 'top'},
  { id: 'R3_T4', x: 560, y: 410, align: 'top'},
  { id: 'R3_B1', x: 260, y: 450, align: 'bottom'},
  { id: 'R3_B2', x: 360, y: 450, align: 'bottom'},
  { id: 'R3_B3', x: 460, y: 450, align: 'bottom'},
  { id: 'R3_B4', x: 560, y: 450, align: 'bottom' },
  // --- DÃY NHỎ ---
  { id: 'SMALL_T2', x: 55, y: 310, align: 'top'},
  { id: 'SMALL_T1', x: 135, y: 310, align: 'top'},
  { id: 'SMALL_B2', x: 55, y: 350, align: 'bottom'},
  { id: 'SMALL_B1', x: 135, y: 350, align: 'bottom'},
];

// Component Legend cho chuyên nghiệp
const MapLegend = () => (
    <div className="flex flex-wrap gap-x-5 gap-y-2 p-4 bg-white rounded-xl border border-slate-100 shadow-inner text-xs text-slate-600 mt-4 mx-4">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f1f5f9] border border-slate-300"></span> Blank / Inactive</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#cbd5e1]"></span> Active / No logging</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#22c55e]"></span> On Time</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]"></span> Late</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#4F5FEA]"></span> Selected</div>
    </div>
);

export default function LiveOfficeMap({ date, onSeatClick, selectedCode, employees = [], isEditMode = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seatAssignments, setSeatAssignments] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, seat: null });

  const activeEmployeesMap = useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      if (emp.status === 'ACTIVE') {
        map[emp.employee_code] = emp;
      }
    });
    return map;
  }, [employees]);

  const fetchMapData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, seatsData] = await Promise.all([
        date ? api.getAttendanceLogs({ date, lateOnly: false }) : Promise.resolve([]),
        api.getSeats(date)
      ]);
      
      setLogs(logsData);
      
      const assignmentMap = {};
      seatsData.forEach(seat => {
        assignmentMap[seat.seat_id] = seat.employee_code;
      });
      setSeatAssignments(assignmentMap);
      
    } catch (err) {
      console.error("Error loading map data:", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const attendanceMap = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      map[log.employee_code] = {
        isLate: log.minutes_late > 0,
        time: String(log.check_in_time).slice(0,5),
        name: log.employee_name
      };
    });
    return map;
  }, [logs]);

  const getSeatColor = (code, isOccupied) => {
    if (code && selectedCode && selectedCode === code) return '#4F5FEA';
    if (!isOccupied) return '#f1f5f9';
    
    const status = attendanceMap[code];
    if (!status) return '#cbd5e1';
    return status.isLate ? '#ef4444' : '#22c55e';
  };

  const handleSeatInteract = (seatId, currentEmpCode) => {
    if (isEditMode) {
      setModalConfig({ 
        isOpen: true, 
        seat: { id: seatId, currentEmpCode } 
      });
    } else {
      if (currentEmpCode && onSeatClick) {
        onSeatClick(currentEmpCode);
      }
    }
  };

  const handleSaveAssignment = async (seatId, newEmpCode) => {
    await api.assignSeat(seatId, newEmpCode);
    await fetchMapData(); 
  };

  return (
    <div className='flex flex-col h-full'>
      <div className="p-4 flex-1 overflow-x-auto relative flex justify-center items-center">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl gap-2 text-indigo-600">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full anim-spin"></div>
            <span className="text-xs font-semibold">Updating...</span>
          </div>
        )}

        <svg viewBox="-150 0 1030 550" className="w-full max-w-5xl h-auto" style={{ minWidth: '700px' }}>
          <defs>
            
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1"/>
            </filter>
            
            <pattern id="tablePattern" patternUnits="userSpaceOnUse" width="4" height="4">
                <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#e2e8f0" strokeWidth="0.5"/>
            </pattern>
          </defs>

          {/* Vẽ Bàn (Static) - Chuyển sang màu xám nhẹ */}
          <g filter="url(#softShadow)">
            <rect x="60" y="130" width="40" height="80" rx="4" fill="url(#tablePattern)" stroke="#cbd5e1" strokeWidth="1" /> {/* Bàn Boss */}
            <rect x="20" y="320" width="140" height="20" rx="2" fill="url(#tablePattern)" stroke="#cbd5e1" strokeWidth="1" /> {/* Dãy nhỏ */}
            <rect x="220" y="120" width="480" height="20" rx="2" fill="url(#tablePattern)" stroke="#cbd5e1" strokeWidth="1" /> {/* Dãy 1 */}
            <rect x="220" y="270" width="380" height="20" rx="2" fill="url(#tablePattern)" stroke="#cbd5e1" strokeWidth="1" /> {/* Dãy 2 */}
            <rect x="220" y="420" width="380" height="20" rx="2" fill="url(#tablePattern)" stroke="#cbd5e1" strokeWidth="1" /> {/* Dãy 3 */}
          </g>

          {/* Vẽ Ghế (Dynamic) */}
          {SEAT_LAYOUT.map((seat) => {
            const empCode = seatAssignments[seat.id];
            const empInfo = empCode ? activeEmployeesMap[empCode] : null;
            const isOccupied = !!empInfo;
            
            const isSelected = selectedCode === empCode;
            const seatColor = getSeatColor(empCode, isOccupied);
            const displayName = isOccupied ? getShortName(empInfo.name) : 'TRỐNG';
            const status = attendanceMap[empCode];

            return (
              <g 
                key={seat.id} 
                onClick={() => handleSeatInteract(seat.id, empCode)}
                className={`transition-all duration-200 origin-center ${isOccupied || isEditMode ? 'cursor-pointer hover:scale-110' : 'opacity-40'}`}
                style={{ transformOrigin: `${seat.x}px ${seat.y}px` }}
              >
                {/* Custom Tooltip */}
                <title>
                    {isOccupied 
                        ? `${empInfo.name} (${empCode})\n${status ? (status.isLate ? `Muộn: ${status.time}` : `Đúng giờ: ${status.time}`) : 'Chưa điểm danh'}`
                        : `Ghế trống (${seat.id})`}
                </title>
                
                {/* Lưng ghế */}
                <path 
                  d={seat.align === 'top' || seat.align === 'left' 
                      ? `M ${seat.x-12} ${seat.y-10} Q ${seat.x} ${seat.y-18} ${seat.x+12} ${seat.y-10}`
                      : `M ${seat.x-12} ${seat.y+10} Q ${seat.x} ${seat.y+18} ${seat.x+12} ${seat.y+10}`
                    }
                  stroke={isSelected ? '#4F5FEA' : '#94a3b8'} 
                  strokeWidth="2.5" 
                  fill="none" 
                  strokeLinecap="round"
                />
                
                {/* Mặt ghế */}
                <circle 
                  cx={seat.x} cy={seat.y} r="11" 
                  fill={seatColor} 
                  stroke={isSelected ? '#4F5FEA' : (isOccupied ? '#94a3b8' : '#cbd5e1')} 
                  strokeWidth={isSelected ? "2" : "1"} 
                  strokeDasharray={!isOccupied ? "3 2" : "none"}
                  filter={isOccupied ? "url(#softShadow)" : ""} 
                />

                {/* Icon trạng thái nhỏ */}
                {isOccupied && status && (
                    <circle cx={seat.x + 8} cy={seat.y - 8} r="4" fill={status.isLate ? '#ef4444' : '#22c55e'} stroke="white" strokeWidth="1"/>
                )}
                
                {/* Tên nhân viên */}
                <text 
                  x={seat.align === 'left' ? seat.x - 20 : seat.x} 
                  y={seat.align === 'top' ? seat.y - 25 : (seat.align === 'left' ? seat.y + 4 : seat.y + 35)} 
                  textAnchor={seat.align === 'left' ? 'end' : 'middle'} 
                  fill={isSelected ? '#4F5FEA' : (isOccupied ? '#1e293b' : '#94a3b8')} 
                  fontSize="11" 
                  fontWeight={isSelected ? "700" : "600"}
                  className="select-none pointer-events-none font-sans"
                >
                  {displayName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <MapLegend />

      <AssignSeatModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, seat: null })}
        seat={modalConfig.seat}
        employees={employees}
        onSave={handleSaveAssignment}
      />
    </div>
  );
}
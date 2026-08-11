import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../api';
import AssignSeatModal from './AssignSeatModal';

// Hàm tự động viết tắt tên (VD: "Lê Thành Đạt" -> "ĐẠT LT")
function getShortName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0].toUpperCase();
  const name = parts.pop();
  const initials = parts.map(p => p[0]).join('');
  return `${name} ${initials}`.toUpperCase();
}

const SEATS = [
  // --- BÀN BOSS ---
  { id: 'BOSS', x: 40, y: 170, align: 'left' },

  // --- DÃY 1 (5 người / bên) ---
  // Phía trong
  { id: 'R1_T1', x: 260, y: 110, align: 'top'},
  { id: 'R1_T2', x: 360, y: 110, align: 'top'},
  { id: 'R1_T3', x: 460, y: 110, align: 'top'},
  { id: 'R1_T4', x: 560, y: 110, align: 'top'},
  { id: 'R1_T5', x: 660, y: 110, align: 'top'},
  // Phía đối diện
  { id: 'R1_B1', x: 260, y: 150, align: 'bottom'},
  { id: 'R1_B2', x: 360, y: 150, align: 'bottom'},
  { id: 'R1_B3', x: 460, y: 150, align: 'bottom'},
  { id: 'R1_B4', x: 560, y: 150, align: 'bottom'},
  { id: 'R1_B5', x: 660, y: 150, align: 'bottom'},

  // --- DÃY 2 (4 người / bên) ---
  // Phía trong
  { id: 'R2_T1', x: 260, y: 260, align: 'top'},
  { id: 'R2_T2', x: 360, y: 260, align: 'top'},
  { id: 'R2_T3', x: 460, y: 260, align: 'top'},
  { id: 'R2_T4', x: 560, y: 260, align: 'top'},
  // Đối diện
  { id: 'R2_B1', x: 260, y: 300, align: 'bottom'},
  { id: 'R2_B2', x: 360, y: 300, align: 'bottom'},
  { id: 'R2_B3', x: 460, y: 300, align: 'bottom'},
  { id: 'R2_B4', x: 560, y: 300, align: 'bottom' },

  // --- DÃY 3 (4 người / bên) ---
  // Phía trong
  { id: 'R3_T1', x: 260, y: 410, align: 'top'},
  { id: 'R3_T2', x: 360, y: 410, align: 'top'},
  { id: 'R3_T3', x: 460, y: 410, align: 'top'},
  { id: 'R3_T4', x: 560, y: 410, align: 'top'},
  // Đối diện
  { id: 'R3_B1', x: 260, y: 450, align: 'bottom'},
  { id: 'R3_B2', x: 360, y: 450, align: 'bottom'},
  { id: 'R3_B3', x: 460, y: 450, align: 'bottom'},
  { id: 'R3_B4', x: 560, y: 450, align: 'bottom' },

  // --- DÃY NHỎ ---
  // Phía trong đối diện (Gần Boss, quay lưng Boss)
  { id: 'SMALL_T2', x: 55, y: 310, align: 'top'},
  { id: 'SMALL_T1', x: 135, y: 310, align: 'top'},
  // Phía ngoài (Cửa ra vào)
  { id: 'SMALL_B2', x: 55, y: 350, align: 'bottom'},
  { id: 'SMALL_B1', x: 135, y: 350, align: 'bottom'},
];

// Chú ý: Đã thêm prop isEditMode
export default function LiveOfficeMap({ date, onSeatClick, selectedCode, employees = [], isEditMode = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seatAssignments, setSeatAssignments] = useState({});

  // State quản lý Modal
  const [modalConfig, setModalConfig] = useState({ isOpen: false, seat: null });

  // Lọc ra danh sách nhân sự đang ACTIVE để ánh xạ vào sơ đồ
  const activeEmployeesMap = useMemo(() => {
    const map = {};
    employees.forEach(emp => {
      if (emp.status === 'ACTIVE') {
        map[emp.employee_code] = emp;
      }
    });
    return map;
  }, [employees]);

  // Tách hàm fetchMapData ra bằng useCallback để có thể gọi lại sau khi lưu
  const fetchMapData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, seatsData] = await Promise.all([
        date ? api.getAttendanceLogs({ date, lateOnly: false }) : Promise.resolve([]),
        api.getSeats()
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
  }, [date]); // Phụ thuộc vào date

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
    if (selectedCode === code) return '#4F5FEA'; 
    if (!isOccupied) return '#f1f5f9'; // Ghế trống (nhân sự INACTIVE hoặc chưa gán)
    
    const status = attendanceMap[code];
    if (!status) return '#cbd5e1'; // Xám nhạt (Chưa đến)
    return status.isLate ? '#ef4444' : '#22c55e'; // Đỏ (Muộn) hoặc Xanh (Đúng giờ)
  };

  const handleSeatInteract = (seatId, currentEmpCode) => {
    if (isEditMode) {
      // Mở modal đổi chỗ
      setModalConfig({ 
        isOpen: true, 
        seat: { id: seatId, currentEmpCode } 
      });
    } else {
      // Chế độ chấm công bình thường: chỉ tương tác nếu ghế có người
      if (currentEmpCode && onSeatClick) {
        onSeatClick(currentEmpCode);
      }
    }
  };

  // Hàm thực thi gọi API lưu ghế (được gọi từ Modal)
  const handleSaveAssignment = async (seatId, newEmpCode) => {
    await api.assignSeat(seatId, newEmpCode);
    await fetchMapData(); // Refresh lại sơ đồ sau khi cập nhật thành công
  };

  // Bọc vào Fragment để có thể render cả Map và Modal
  return (
    <>
      <div className="p-6 overflow-x-auto relative flex justify-center bg-slate-50/50 rounded-xl border border-slate-200">
        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-xl">
            <span className="text-sm font-medium text-slate-500">Updating map...</span>
          </div>
        )}

        <svg viewBox="-150 0 1030 550" className="w-full max-w-5xl h-auto" style={{ minWidth: '750px' }}>
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
            </filter>
          </defs>

          <rect x="60" y="130" width="40" height="80" rx="8" fill="#e2e8f0" filter="url(#shadow)" /> {/* Bàn Boss */}
          <rect x="20" y="320" width="140" height="20" rx="4" fill="#e2e8f0" filter="url(#shadow)" /> {/* Dãy nhỏ */}
          <rect x="220" y="120" width="480" height="20" rx="4" fill="#e2e8f0" filter="url(#shadow)" /> {/* Dãy 1 */}
          <rect x="220" y="270" width="380" height="20" rx="4" fill="#e2e8f0" filter="url(#shadow)" /> {/* Dãy 2 */}
          <rect x="220" y="420" width="380" height="20" rx="4" fill="#e2e8f0" filter="url(#shadow)" /> {/* Dãy 3 */}

          {SEATS.map((seat) => {
            const empCode = seatAssignments[seat.id];
            const empInfo = empCode ? activeEmployeesMap[empCode] : null;
            const isOccupied = !!empInfo;
            
            const isSelected = selectedCode === empCode;
            const seatColor = getSeatColor(empCode, isOccupied);
            const displayName = isOccupied ? getShortName(empInfo.name) : 'TRỐNG';
            const hasData = empCode && attendanceMap[empCode];
            
            // Xây dựng tooltipText
            let tooltipText = `Vị trí trống (${seat.id})`;
            if (isOccupied) {
              tooltipText = hasData 
                ? `${empInfo.name} (${empCode}) - In: ${attendanceMap[empCode].time}`
                : `${empInfo.name} (${empCode}) - No data`;
            }

            return (
              <g 
                key={seat.id} 
                onClick={() => handleSeatInteract(seat.id, empCode)}
                className={`${isOccupied || isEditMode ? 'cursor-pointer hover:scale-110' : 'opacity-50'} transition-transform`}
                style={{ transformOrigin: `${seat.x}px ${seat.y}px` }}
              >
                <title>{tooltipText}</title>
                
                <path 
                  d={seat.align === 'top' || seat.align === 'left' 
                      ? `M ${seat.x-10} ${seat.y-8} Q ${seat.x} ${seat.y-15} ${seat.x+10} ${seat.y-8}`
                      : `M ${seat.x-10} ${seat.y+8} Q ${seat.x} ${seat.y+15} ${seat.x+10} ${seat.y+8}`
                    }
                  stroke={seatColor} 
                  strokeWidth="4" 
                  fill="none" 
                  strokeLinecap="round"
                />
                
                <circle 
                  cx={seat.x} cy={seat.y} r="10" 
                  fill={seatColor} 
                  stroke={isSelected ? '#fff' : '#fff'} 
                  strokeWidth={isSelected ? "3" : "2"} 
                  strokeDasharray={!isOccupied ? "3 3" : "none"} // Nét đứt nếu ghế trống
                  filter={isOccupied ? "url(#shadow)" : ""} 
                />
                
                <text 
                  x={seat.align === 'left' ? seat.x - 18 : seat.x} 
                  y={seat.align === 'top' ? seat.y - 20 : (seat.align === 'left' ? seat.y + 4 : seat.y + 30)} 
                  textAnchor={seat.align === 'left' ? 'end' : 'middle'} 
                  fill={isSelected ? '#4F5FEA' : (isOccupied ? '#64748b' : '#cbd5e1')} 
                  fontSize="12" 
                  fontWeight={isSelected ? "700" : "600"}
                  className="select-none"
                >
                  {displayName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <AssignSeatModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, seat: null })}
        seat={modalConfig.seat}
        employees={employees}
        onSave={handleSaveAssignment}
      />
    </>
  );
}
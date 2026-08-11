import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';

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
  { id: 'BOSS', code: 'DUNGVK', x: 40, y: 170, align: 'left', label: 'Dung VTK' },

  // --- DÃY 1 (5 người / bên) ---
  // Phía trong
  { id: 'R1_T1', code: 'DATLT7', x: 260, y: 110, align: 'top', label: 'Đạt LT' },
  { id: 'R1_T2', code: 'HIEUTV4', x: 360, y: 110, align: 'top', label: 'Hiếu TV' },
  { id: 'R1_T3', code: 'PHAMTHITHUHIEN', x: 460, y: 110, align: 'top', label: 'Hiền PTT' },
  { id: 'R1_T4', code: 'PHUONGVT6', x: 560, y: 110, align: 'top', label: 'Phượng VT' },
  { id: 'R1_T5', code: 'THUYPT', x: 660, y: 110, align: 'top', label: 'Thủy PTT' },
  // Phía đối diện
  { id: 'R1_B1', code: 'THANGVC', x: 260, y: 150, align: 'bottom', label: 'Thắng VC' },
  { id: 'R1_B2', code: 'LONGDH2', x: 360, y: 150, align: 'bottom', label: 'Long ĐH' },
  { id: 'R1_B3', code: 'CANHTN', x: 460, y: 150, align: 'bottom', label: 'Cảnh TN' },
  { id: 'R1_B4', code: 'LONGLH6', x: 560, y: 150, align: 'bottom', label: 'Long LH' },
  { id: 'R1_B5', code: 'ANHLTN7', x: 660, y: 150, align: 'bottom', label: 'Anh LTN' },

  // --- DÃY 2 (4 người / bên) ---
  // Phía trong
  { id: 'R2_T1', code: 'HIENTT17', x: 260, y: 260, align: 'top', label: 'Hiền TT' },
  { id: 'R2_T2', code: 'PTT.NGUYEN', x: 360, y: 260, align: 'top', label: 'Nguyên PTT' },
  { id: 'R2_T3', code: 'NX.MINH', x: 460, y: 260, align: 'top', label: 'Minh NX' },
  { id: 'R2_T4', code: 'LINHTPM', x: 560, y: 260, align: 'top', label: 'Linh TPM' },
  // Đối diện
  { id: 'R2_B1', code: 'LINHDT15', x: 260, y: 300, align: 'bottom', label: 'Linh ĐT' },
  { id: 'R2_B2', code: 'HUY.PX', x: 360, y: 300, align: 'bottom', label: 'Huy PX' },
  { id: 'R2_B3', code: 'VIETTQ3', x: 460, y: 300, align: 'bottom', label: 'Việt TQ' },
  { id: 'R2_B4', code: 'SONNH14', x: 560, y: 300, align: 'bottom', label: 'Sơn NH' },

  // --- DÃY 3 (4 người / bên) ---
  // Phía trong
  { id: 'R3_T1', code: 'MINHPH4', x: 260, y: 410, align: 'top', label: 'Minh PH' },
  { id: 'R3_T2', code: 'PHUCNH7', x: 360, y: 410, align: 'top', label: 'Phúc NH' },
  { id: 'R3_T3', code: 'DVKHANH', x: 460, y: 410, align: 'top', label: 'Khánh ĐV' },
  { id: 'R3_T4', code: 'DUNGND11', x: 560, y: 410, align: 'top', label: 'Dũng NĐ' },
  // Đối diện
  { id: 'R3_B1', code: 'SYVH', x: 260, y: 450, align: 'bottom', label: 'Sỹ VH' },
  { id: 'R3_B2', code: 'HUYBA', x: 360, y: 450, align: 'bottom', label: 'Huy BA' },
  { id: 'R3_B3', code: 'MANHTV1', x: 460, y: 450, align: 'bottom', label: 'Mạnh TV' },
  { id: 'R3_B4', code: 'NHATNL', x: 560, y: 450, align: 'bottom', label: 'Nhật NL' },

  // --- DÃY NHỎ ---
  // Phía trong đối diện (Gần Boss, quay lưng Boss)
  { id: 'SMALL_T2', code: 'TT.KY', x: 55, y: 310, align: 'top', label: 'Kỳ TT' },
  { id: 'SMALL_T1', code: 'DUCTM13', x: 135, y: 310, align: 'top', label: 'Đức TM' },
  // Phía ngoài (Cửa ra vào)
  { id: 'SMALL_B2', code: 'VUONG.TV', x: 55, y: 350, align: 'bottom', label: 'Vượng TV' },
  { id: 'SMALL_B1', code: 'HAIDUONG', x: 135, y: 350, align: 'bottom', label: 'Đường NTH' },
];

export default function LiveOfficeMap({ date, onSeatClick, selectedCode, employees = [] }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    api.getAttendanceLogs({ date, lateOnly: false })
      .then(setLogs)
      .catch((err) => console.error("Error loading map data:", err))
      .finally(() => setLoading(false));
  }, [date]);

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
    if (!isOccupied) return '#f1f5f9'; // Ghế trống (nhân sự INACTIVE)
    
    const status = attendanceMap[code];
    if (!status) return '#cbd5e1'; // Xám nhạt (Chưa đến)
    return status.isLate ? '#ef4444' : '#22c55e'; // Đỏ (Muộn) hoặc Xanh (Đúng giờ)
  };

  return (
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
          const empInfo = activeEmployeesMap[seat.code];
          const isOccupied = !!empInfo; // Nếu nhân sự ACTIVE, ghế này có người
          const isSelected = selectedCode === seat.code;
          const hasData = !!attendanceMap[seat.code];
          
          const seatColor = getSeatColor(seat.code, isOccupied);
          const displayName = isOccupied ? getShortName(empInfo.name) : 'TRỐNG';
          
          const tooltipText = isOccupied 
            ? (hasData ? `${empInfo.name} (${seat.code}) - In: ${attendanceMap[seat.code].time}` : `${empInfo.name} (${seat.code}) - No data`)
            : `Vị trí trống`;

          return (
            <g 
              key={seat.id} 
              onClick={() => isOccupied && onSeatClick && onSeatClick(seat.code)}
              className={`${isOccupied ? 'cursor-pointer hover:scale-110' : 'opacity-50'} transition-transform`} 
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
  );
}
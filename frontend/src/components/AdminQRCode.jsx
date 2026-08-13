import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function AdminQRCode() {
  const [qrData, setQrData] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    // Hàm sinh dữ liệu mới
    const generateNewQR = () => {
      // Đóng gói dữ liệu bảo mật (bao gồm tên văn phòng và thời gian hiện tại)
      const payload = JSON.stringify({
        location: 'HQ_HANOI',
        timestamp: Date.now(),
        secret_token: 'viettinbank_auth_xyz'
      });
      setQrData(payload);
      setTimeLeft(30); // Reset đồng hồ đếm ngược
    };

    generateNewQR();

    // Cập nhật đồng hồ đếm ngược mỗi giây
    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateNewQR();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-lg w-fit mx-auto mt-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Check-in Điện Tử</h2>
      <p className="text-gray-500 mb-6 text-sm">Yêu cầu nhân viên mở App để quét mã này</p>
      
      {/* Khung chứa mã QR */}
      <div className="p-4 border-4 border-blue-500 rounded-lg bg-white">
        {qrData && (
          <QRCodeCanvas 
            value={qrData} 
            size={250} 
            level={"H"} // Mức độ sửa lỗi cao, dễ quét
            includeMargin={true}
          />
        )}
      </div>

      <div className="mt-6 flex items-center space-x-2">
        <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
        <p className="text-gray-600 font-medium">
          Mã sẽ làm mới sau: <span className="text-red-500 font-bold">{timeLeft}s</span>
        </p>
      </div>
    </div>
  );
}
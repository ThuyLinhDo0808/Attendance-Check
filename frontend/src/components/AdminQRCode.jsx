import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCodeIcon } from '@heroicons/react/24/outline';

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

  const progress = (timeLeft / 30) * 100;

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h2 className="page-title">
          <QrCodeIcon className="page-title-icon" />
          QR Check-in
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Display this screen at the entrance. Employees scan it with the mobile app to check in.
        </p>
      </header>

      <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-slate-200/80 bg-white px-8 pb-8 pt-7 shadow-lg">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live · Check-in open
        </span>
        <p className="mt-3 text-sm text-slate-500">Yêu cầu nhân viên mở App để quét mã này</p>

        {/* Khung chứa mã QR */}
        <div className="relative mt-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-indigo-50 p-4 ring-1 ring-indigo-100">
          <div className="rounded-xl bg-white p-2 shadow-sm">
            {qrData && (
              <QRCodeCanvas
                value={qrData}
                size={260}
                level={"H"} // Mức độ sửa lỗi cao, dễ quét
                includeMargin={true}
                fgColor="#0E1527"
              />
            )}
          </div>
        </div>

        <div className="mt-7 w-full">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Mã sẽ làm mới sau</span>
            <span className="font-mono-num font-semibold text-slate-900">{timeLeft}s</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

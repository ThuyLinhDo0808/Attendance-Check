import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import { api } from '../api';

const REFRESH_SECONDS = 30;

export default function AdminQRCode() {
  const [qrData, setQrData] = useState('');
  const [timeLeft, setTimeLeft] = useState(REFRESH_SECONDS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // The server signs a short-lived token; the QR code is a link to the
    // employee web app carrying it, so employees can scan it with the
    // phone camera or from inside the web app.
    const generateNewQR = async () => {
      try {
        const { token } = await api.getCheckinQrToken();
        if (cancelled) return;
        setQrData(`${window.location.origin}/checkin?t=${encodeURIComponent(token)}`);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    generateNewQR();

    const refresh = setInterval(() => {
      generateNewQR();
      setTimeLeft(REFRESH_SECONDS);
    }, REFRESH_SECONDS * 1000);
    const countdown = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 1));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(countdown);
    };
  }, []);

  const progress = (timeLeft / REFRESH_SECONDS) * 100;

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h2 className="page-title">
          <QrCodeIcon className="page-title-icon" />
          QR Check-in
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Display this screen at the entrance. Employees scan it with their phone camera (or the employee web app) to check in.
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
        <p className="mt-3 text-sm text-slate-500">Nhân viên dùng camera điện thoại quét mã này để điểm danh</p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            Không tạo được mã QR: {error}
          </p>
        )}

        {/* Khung chứa mã QR */}
        <div className="relative mt-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-indigo-50 p-4 ring-1 ring-indigo-100">
          <div className="rounded-xl bg-white p-2 shadow-sm">
            {qrData && (
              <QRCodeCanvas
                value={qrData}
                size={260}
                level="M" // Link dài: mức M cho mã thưa hơn, dễ quét hơn
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

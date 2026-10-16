import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  QrCodeIcon,
  ChatBubbleBottomCenterTextIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import { api, session } from '../api';
import { formatVND, formatTime } from '../utils/format';
import QrScanner from './QrScanner.jsx';

const TABS = [
  { id: 'checkin', label: 'Điểm danh', icon: QrCodeIcon },
  { id: 'excuse', label: 'Giải trình', icon: ChatBubbleBottomCenterTextIcon },
  { id: 'profile', label: 'Hồ sơ', icon: UserCircleIcon },
];

/**
 * The employee web app: check in by scanning the office QR code, send an
 * excuse for being late, and see your own lateness and fines. Opening the
 * QR link (/checkin?t=…) with the phone camera checks in straight away.
 */
export default function EmployeeApp({ user }) {
  const [initialQr] = useState(() => new URLSearchParams(window.location.search).get('t') ? window.location.href : null);
  const [tab, setTab] = useState('checkin');

  useEffect(() => {
    // Drop the one-time token from the address bar so a refresh doesn't resend it.
    if (initialQr) window.history.replaceState(null, '', '/checkin');
  }, [initialQr]);

  const isAdmin = user.role !== 'employee';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.employee_code}</p>
          </div>
          {isAdmin && (
            <a href="/" className="rounded-lg px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
              Trang quản trị
            </a>
          )}
          <button
            onClick={() => session.clear()}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-6">
        {tab === 'checkin' && <CheckInPanel user={user} initialQr={initialQr} onDone={() => setTab('profile')} />}
        {tab === 'excuse' && <ExcusePanel />}
        {tab === 'profile' && <ProfilePanel user={user} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                  active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <t.icon className="h-6 w-6" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Notice({ tone, children }) {
  const ok = tone === 'ok';
  const Icon = ok ? CheckCircleIcon : ExclamationTriangleIcon;
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ok ? 'text-emerald-500' : 'text-rose-500'}`} />
      <span>{children}</span>
    </div>
  );
}

function CheckInPanel({ user, initialQr, onDone }) {
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const sentRef = useRef(false);

  const submit = useCallback(async (qrData) => {
    setScanning(false);
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.checkIn(qrData);
      setResult({ tone: 'ok', text: res.message || 'Điểm danh thành công!' });
    } catch (err) {
      setResult({ tone: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }, []);

  useEffect(() => {
    // Opened from the QR link: check in once (StrictMode runs effects twice in dev).
    if (initialQr && !sentRef.current) {
      sentRef.current = true;
      submit(initialQr);
    }
  }, [initialQr, submit]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Điểm danh</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quét mã QR đang hiển thị tại văn phòng. Bạn có thể quét ngay tại đây, hoặc dùng camera điện thoại quét mã rồi mở đường link.
        </p>
      </div>

      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      {result?.tone === 'ok' && (
        <button onClick={onDone} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          Xem hồ sơ của tôi
        </button>
      )}

      {submitting && <p className="text-center text-sm text-slate-500">Đang gửi điểm danh cho {user.name}…</p>}

      {scanning ? (
        <div className="space-y-3">
          <QrScanner onScan={submit} />
          <button onClick={() => setScanning(false)} className="w-full rounded-xl py-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Huỷ
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setResult(null);
            setScanning(true);
          }}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <CameraIcon className="h-5 w-5" />
          {result ? 'Quét lại' : 'Mở camera để quét mã QR'}
        </button>
      )}
    </section>
  );
}

function ExcusePanel() {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.submitExcuse(reason.trim());
      setResult({ tone: 'ok', text: res.message || 'Đã gửi giải trình.' });
      setReason('');
    } catch (err) {
      setResult({ tone: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Giải trình đi muộn</h1>
        <p className="mt-1 text-sm text-slate-500">Nhập lý do đi muộn hôm nay. Quản trị viên sẽ xét duyệt.</p>
      </div>

      {result && <Notice tone={result.tone}>{result.text}</Notice>}

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        placeholder="Ví dụ: Sáng nay tuyến đường bị ngập nặng…"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
      />

      <button
        type="submit"
        disabled={submitting || !reason.trim()}
        className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Đang gửi…' : 'Gửi giải trình'}
      </button>
    </form>
  );
}

function ProfilePanel({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .getEmployeeAnalytics(user.employee_code)
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [user.employee_code]);

  const initial = (user.name || user.employee_code || '?').trim().charAt(0).toUpperCase();

  return (
    <section className="space-y-5">
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-2xl font-semibold text-white">
          {initial}
        </div>
        <p className="mt-3 text-lg font-semibold">{user.name}</p>
        <p className="text-sm text-slate-500">Mã NV: {user.employee_code}</p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <p className="text-center text-sm text-slate-500">Đang tải…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-rose-50 p-4 text-center">
              <p className="font-mono-num text-2xl font-semibold text-rose-700">{data.stats.times_late}</p>
              <p className="mt-1 text-xs text-slate-600">Lần đi muộn</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-center">
              <p className="font-mono-num text-lg font-semibold text-amber-800">{formatVND(data.stats.total_fine)}</p>
              <p className="mt-1 text-xs text-slate-600">Tiền phạt</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Lịch sử điểm danh gần đây</h2>
            {data.history.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có dữ liệu.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.history.slice(0, 15).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-mono-num text-slate-700">{row.work_date}</span>
                    <span className="font-mono-num text-slate-500">{formatTime(row.check_in_time)}</span>
                    <span
                      className={`font-mono-num w-24 text-right ${
                        row.is_exempt ? 'text-slate-400' : row.minutes_late > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {row.is_exempt ? 'Miễn' : row.minutes_late > 0 ? `+${row.minutes_late} phút` : 'Đúng giờ'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

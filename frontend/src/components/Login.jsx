import React, { useState } from 'react';
import { api, session } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.login(username.trim(), password);
      if (result.data.role === 'employee') {
        throw new Error('Tài khoản nhân viên chỉ dùng được trên ứng dụng di động.');
      }
      session.save(result.token, result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ledger-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(110,102,238,0.35),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <div className="relative w-full max-w-sm animate-page-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-700 shadow-glow ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" aria-hidden="true">
              <path d="M6 5v14h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="8.5" r="2" fill="currentColor" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-400">Sign in to Ledger · Attendance &amp; Fines</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-7 shadow-2xl ring-1 ring-white/10">
          {error && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Employee code</span>
            <input
              autoFocus
              autoComplete="username"
              placeholder="e.g. LINHDT15"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">Admin dashboard · Employees use the mobile app</p>
      </div>
    </div>
  );
}

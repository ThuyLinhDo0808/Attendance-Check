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

  return (
    <div className="min-h-screen flex items-center justify-center bg-ledger-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-xl p-8 space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">
            Attendance <span className="text-accent">&amp;</span> Fine Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Sign in with your admin account.</p>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Employee code</span>
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full rounded-md bg-accent text-white text-sm font-bold py-2.5 hover:bg-indigo-600 disabled:opacity-50 transition"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

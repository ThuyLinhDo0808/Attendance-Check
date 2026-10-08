import React, { useState } from 'react';
import { api, session } from '../api';

/** Sidebar block showing who is signed in, with change-password and sign-out. */
export default function AccountMenu({ user }) {
  const [changing, setChanging] = useState(false);
  const [form, setForm] = useState({ current: '', next: '' });
  const [message, setMessage] = useState(null);

  async function handleChange(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.changePassword(form.current, form.next);
      setForm({ current: '', next: '' });
      setChanging(false);
      setMessage({ tone: 'ok', text: 'Password changed.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    }
  }

  return (
    <div className="px-6 py-4 border-t border-white/5 text-xs text-slate-400">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-slate-200 font-bold truncate">{user.name}</div>
          <div className="font-mono-num text-[10px] uppercase tracking-widest">
            {user.employee_code} · {user.role}
          </div>
        </div>
        <button onClick={() => session.clear()} className="shrink-0 text-accent font-semibold hover:text-indigo-400">
          Sign out
        </button>
      </div>

      {message && (
        <p className={`mt-2 ${message.tone === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>
      )}

      {changing ? (
        <form onSubmit={handleChange} className="mt-3 space-y-2">
          <input
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
            className="w-full rounded bg-white/10 px-2 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="New password (min 6)"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
            className="w-full rounded bg-white/10 px-2 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <div className="flex gap-3">
            <button type="submit" className="text-accent font-semibold hover:text-indigo-400">Save</button>
            <button type="button" onClick={() => setChanging(false)} className="hover:text-slate-200">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setChanging(true)} className="mt-2 hover:text-slate-200">
          Change password
        </button>
      )}
    </div>
  );
}

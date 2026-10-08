import React, { useState } from 'react';
import { api, session } from '../api';
import { ArrowRightOnRectangleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

/** Sidebar block showing who is signed in, with change-password and sign-out. */
export default function AccountMenu({ user, status, statusDot, onOpenSettings }) {
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

  const initials = (user.name || user.employee_code || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative border-t border-white/5 p-4 text-xs text-slate-400">
      <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 text-xs font-semibold text-white ring-2 ring-white/10">
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
          {status ? (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              <span className="truncate">{status}</span>
            </p>
          ) : (
            <p className="truncate text-[11px] text-slate-400">
              {user.employee_code} · {user.role}
            </p>
          )}
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Open settings"
            title="Settings"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between px-2 text-[11px]">
        <span className="font-mono-num min-w-0 truncate text-slate-500">
          {user.employee_code} · {user.role}
        </span>
        <span className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          {!changing && (
            <button onClick={() => setChanging(true)} className="hover:text-slate-200">
              Password
            </button>
          )}
          <button
            onClick={() => session.clear()}
            className="inline-flex items-center gap-1 font-medium text-slate-300 hover:text-white"
          >
            <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
            Sign out
          </button>
        </span>
      </div>

      {message && (
        <p className={`mt-2 px-2 ${message.tone === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>
      )}

      {changing && (
        <form onSubmit={handleChange} className="mt-3 space-y-2 px-2">
          <input
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none"
          />
          <input
            type="password"
            placeholder="New password (min 6)"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:border-indigo-400/60 focus:outline-none"
          />
          <div className="flex gap-3">
            <button type="submit" className="font-semibold text-indigo-300 hover:text-indigo-200">Save</button>
            <button type="button" onClick={() => setChanging(false)} className="hover:text-slate-200">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

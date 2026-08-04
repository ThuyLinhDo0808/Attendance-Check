import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { formatVNDExact, formatBlocks, currentMonthValue } from '../utils/format';

const FIELD_META = {
  workday_start_time: {
    label: 'Workday start time',
    hint: 'Check-ins after this time (24h, HH:MM) count as late.',
    type: 'time',
  },
  block_minutes: {
    label: 'Block size (minutes)',
    hint: 'Lateness is measured in blocks of this many minutes.',
    type: 'number',
    min: 1,
  },
  fine_per_block_vnd: {
    label: 'Fine per block (VNĐ)',
    hint: 'Cash penalty charged for each full block of lateness.',
    type: 'number',
    min: 0,
  },
};

const ORDER = ['workday_start_time', 'block_minutes', 'fine_per_block_vnd'];

export default function Settings({ onSaved }) {
  const [settings, setSettings] = useState(null); // { key: {value, description, updated_at} }
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    return api
      .getSettings()
      .then((rows) => {
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
        setSettings(byKey);
        setForm(Object.fromEntries(rows.map((r) => [r.key, r.value])));
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.updateSettings(form);
      const byKey = Object.fromEntries(updated.map((r) => [r.key, r]));
      setSettings(byKey);
      setForm(Object.fromEntries(updated.map((r) => [r.key, r.value])));
      setSavedAt(new Date());
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Live example using the in-progress form values, so the admin sees the
  // effect of a change before saving.
  const example = (() => {
    const blockMinutes = Number(form.block_minutes) || 15;
    const rate = Number(form.fine_per_block_vnd) || 0;
    const minutesLate = 16;
    const blocks = minutesLate / blockMinutes;
    return {
      minutesLate,
      blocks,
      fine: blocks * rate,
    };
  })();

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-1">
          These constants drive every fine calculation and are stored in the database — change
          them here, no restart required.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-fine/30 bg-fine-soft px-4 py-3 text-sm text-fine">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading settings…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5"
          >
            {ORDER.map((key) => {
              const meta = FIELD_META[key];
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {meta.label}
                  </label>
                  <input
                    type={meta.type}
                    step={meta.type === 'number' ? '1' : undefined}
                    min={meta.min}
                    value={form[key] ?? ''}
                    onChange={(e) => update(key, e.target.value)}
                    className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-slate-400">{meta.hint}</p>
                  {settings?.[key]?.updated_at && (
                    <p className="mt-0.5 text-[11px] text-slate-300">
                      Current version since {new Date(settings[key].updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {savedAt && (
                <span className="text-xs text-ok">Saved at {savedAt.toLocaleTimeString()}</span>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              A change here never overwrites the old value — it closes the current version and
              opens a new one (SCD2). Past attendance records keep the fine that applied on the
              day they were logged, and the old rate stays permanently visible below for audit.
            </div>
          </form>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                Example with these values
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                An employee checking in {example.minutesLate} minutes late would be charged:
              </p>
              <dl className="space-y-2.5 text-sm">
                <Row label="Fine blocks" value={formatBlocks(example.blocks)} />
                <Row label="Total fine" value={formatVNDExact(example.fine)} emphasize />
              </dl>
            </div>

            <RateHistory />
          </div>
        </div>
      )}

      <div className="mt-6">
        <GoogleSheetsSyncPanel />
      </div>
    </div>
  );
}

function Row({ label, value, emphasize }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono-num ${emphasize ? 'text-fine font-semibold' : 'text-slate-800'}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Shows the full SCD2 version timeline for fine_per_block_vnd — the
 * direct, visible proof that changing the rate never erases the old
 * one: "what was the fine rate 3 years ago" is answerable right here.
 */
function RateHistory() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getSettingsHistory('fine_per_block_vnd')
      .then(setHistory)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        Fine rate history (audit trail)
      </h3>
      {error ? (
        <p className="text-xs text-fine">{error}</p>
      ) : !history ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {history.map((v) => (
            <li key={v.id} className="flex items-center justify-between">
              <span className={v.is_current ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                {formatVNDExact(v.value)} / block
              </span>
              <span className="text-xs text-slate-400 font-mono-num">
                {new Date(v.effective_start_date).toLocaleDateString()} –{' '}
                {v.effective_end_date ? new Date(v.effective_end_date).toLocaleDateString() : 'now'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Google Sheets auto-sync status + manual "sync now" control. Actual
 * sync happens automatically after every attendance log/edit/delete
 * (see backend/utils/googleSheetsSync.js) — this panel is just visibility
 * plus a manual trigger for the current month.
 */
function GoogleSheetsSyncPanel() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const month = currentMonthValue();

  useEffect(() => {
    api
      .getSyncStatus()
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.syncMonthNow(month);
      setLastResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-900">Google Sheets auto-sync</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        When configured, every attendance log/edit/delete automatically pushes to a Google
        Sheet — no need to download and re-upload an Excel file each time.
      </p>

      {error && <p className="text-xs text-fine mb-3">{error}</p>}

      {!status ? (
        <p className="text-xs text-slate-400">Checking status…</p>
      ) : status.configured ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft text-ok text-xs font-semibold px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Connected
          </span>
          <a
            href={status.sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Open sheet ↗
          </a>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="text-xs font-semibold text-white bg-accent hover:bg-indigo-600 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : `Sync ${month} now`}
          </button>
          {lastResult && !lastResult.skipped && (
            <span className="text-xs text-slate-400">
              Synced {lastResult.summaryRows} employees / {lastResult.detailRows} logs
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Not configured. Set <code>GOOGLE_SHEET_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,
          and <code>GOOGLE_PRIVATE_KEY</code> in <code>backend/.env</code> — see README.md "Google
          Sheets auto-sync" for the step-by-step setup.
        </div>
      )}
    </section>
  );
}

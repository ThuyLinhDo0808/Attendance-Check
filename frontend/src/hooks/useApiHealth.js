import { useEffect, useState } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const POLL_MS = 60_000;

// Polls GET /health so the sidebar can show whether the API and its
// database are reachable. Returns 'checking' | 'ok' | 'degraded' | 'offline'.
export function useApiHealth() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        const body = await res.json().catch(() => null);
        if (!cancelled) setStatus(res.ok && body?.status === 'ok' ? 'ok' : res.status === 503 ? 'degraded' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return status;
}

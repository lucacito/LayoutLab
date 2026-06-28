'use client';
import { useState } from 'react';

export function BillingButton() {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.assign(data.url);
      else setLoading(false);
    } catch { setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading}
      className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-base font-semibold text-paper hover:brightness-110 disabled:opacity-40">
      {loading ? 'Opening…' : 'Manage billing'}
    </button>
  );
}

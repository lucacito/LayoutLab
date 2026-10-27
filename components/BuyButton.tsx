'use client';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

/** Starts a Stripe Checkout for one paid theme pack. The server decides the price; this only sends the pack id. */
export function BuyButton({ packId, label }: { packId: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    trackEvent('checkout_started', { kind: 'pack', packId });
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'pack', packId }) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.assign(data.url);
      } else {
        setError(data.error === 'pack_unavailable' ? 'This pack is not available right now.' : 'Checkout is unavailable right now. Please try again in a moment.');
        setLoading(false);
      }
    } catch {
      setError('Could not reach checkout. Please try again.');
      setLoading(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={go}
        disabled={loading}
        className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-base font-semibold text-paper transition hover:brightness-110 disabled:opacity-40"
      >
        {loading ? 'Redirecting...' : label}
      </button>
      {error && <p className="max-w-xs text-small text-red-600">{error}</p>}
    </div>
  );
}

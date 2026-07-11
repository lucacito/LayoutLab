'use client';
import { useState } from 'react';

export function BuyProButton({ product, label }: { product: string; label: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const buy = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'plugin', product }),
      });
      const json = await res.json();
      if (json.url) { window.location.assign(json.url); return; }
      setState('error');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <button
        onClick={buy}
        disabled={state === 'loading'}
        className="inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
      >
        {state === 'loading' ? 'Redirecting…' : label}
      </button>
      {state === 'error' && (
        <p className="mt-2 text-small text-red-600">Something went wrong — please try again or email support@divi5lab.com.</p>
      )}
    </div>
  );
}

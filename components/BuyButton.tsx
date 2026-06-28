// components/BuyButton.tsx
'use client';
import { useState } from 'react';

type Props =
  | { kind: 'pack'; packId: string; label: string; plan?: never }
  | { kind: 'membership'; plan: 'monthly' | 'yearly'; label: string; packId?: never };

export function BuyButton(props: Props) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const body = props.kind === 'pack' ? { kind: 'pack', packId: props.packId } : { kind: 'membership', plan: props.plan };
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.assign(data.url);
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={go}
      disabled={loading}
      className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-base font-semibold text-paper transition hover:brightness-110 disabled:opacity-40"
    >
      {loading ? 'Redirecting…' : props.label}
    </button>
  );
}

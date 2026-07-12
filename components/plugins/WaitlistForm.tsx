'use client';
import { useState } from 'react';

export function WaitlistForm({ source, cta }: { source: string; cta: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return <p className="text-body font-medium text-navy">You're on the list — we'll email you at launch.</p>;
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-wrap gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-1 rounded-full border border-border bg-paper px-4 text-small text-navy outline-none focus:border-action"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
      >
        {state === 'loading' ? 'Joining…' : cta}
      </button>
      {state === 'error' && <p className="w-full text-small text-red-600">Something went wrong — please try again.</p>}
    </form>
  );
}

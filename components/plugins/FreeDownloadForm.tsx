'use client';
import { useState } from 'react';

// Email capture (Loops source ai_editor_free) that reveals the plugin download.
// Soft gate by design — the zip's premium tools are license-gated at runtime.
export function FreeDownloadForm({ product }: { product: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'ai_editor_free' }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div>
        <p className="text-body font-medium text-navy">You&rsquo;re in — download away.</p>
        <a
          href={`/api/plugin/free-download?product=${encodeURIComponent(product)}`}
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
        >
          Download the plugin (.zip)
        </a>
      </div>
    );
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
        {state === 'loading' ? 'One sec…' : 'Get the free download'}
      </button>
      {state === 'error' && <p className="w-full text-small text-red-600">Something went wrong — please try again.</p>}
    </form>
  );
}

'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

// One email per vote. The builder rides in the lead source
// (next_converter_<builder>), which email_captures stores, so demand can be
// counted with one GROUP BY and nothing new had to be built to hold it.
export const NEXT_CONVERTER_OPTIONS = [
  { key: 'wpbakery', label: 'WPBakery' },
  { key: 'bricks', label: 'Bricks' },
  { key: 'oxygen', label: 'Oxygen' },
  { key: 'breakdance', label: 'Breakdance' },
  { key: 'blocks', label: 'Gutenberg blocks (Kadence, GenerateBlocks)' },
  { key: 'other', label: 'Something else' },
] as const;
export type NextConverterKey = (typeof NEXT_CONVERTER_OPTIONS)[number]['key'];

export function NextConverterForm({ className = '' }: { className?: string }) {
  const [builder, setBuilder] = useState<NextConverterKey | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !builder) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: `next_converter_${builder}` }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  }

  const chosen = NEXT_CONVERTER_OPTIONS.find((o) => o.key === builder);

  if (status === 'done') {
    return (
      <p role="status" aria-live="polite" className={`flex items-center gap-2 text-body font-semibold text-navy ${className}`}>
        <Icon name="how_to_vote" size={20} className="text-action" />
        Vote counted for {chosen?.label ?? 'your builder'}. You&apos;ll hear from us the day it ships.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <fieldset>
        <legend className="text-small font-semibold text-navy">Which builder are you on?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {NEXT_CONVERTER_OPTIONS.map((o) => {
            const active = builder === o.key;
            return (
              <label
                key={o.key}
                className={`cursor-pointer rounded-pill border px-4 py-2 text-small font-semibold transition ${
                  active ? 'border-action bg-action text-paper' : 'border-border bg-paper text-navy hover:border-action hover:text-action'
                }`}
              >
                <input
                  type="radio"
                  name="builder"
                  value={o.key}
                  checked={active}
                  onChange={() => setBuilder(o.key)}
                  className="sr-only"
                />
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Your email"
          className="h-11 min-w-0 flex-1 rounded-pill border border-border bg-paper px-5 text-body text-navy outline-none focus:border-action"
        />
        <button
          type="submit"
          disabled={submitting || !builder}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-pill bg-action px-7 text-small font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? 'Counting…' : 'Cast my vote'}
        </button>
      </div>
      {status === 'error' && (
        <p role="status" aria-live="polite" className="mt-3 text-small text-red-600">
          Something went wrong. Try again.
        </p>
      )}
      <p className="mt-3 text-small text-muted">One email per vote. We write once, when that converter ships.</p>
    </form>
  );
}

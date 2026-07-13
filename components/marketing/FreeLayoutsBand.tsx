'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// Lead-magnet band ported from the (deleted) services homepage's ServicesFreeBand.
// Same lead endpoint (→ email_captures + Loops), reworded for the plugin-store pivot.
export function FreeLayoutsBand() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guard against double-submit on rapid clicks
    setSubmitting(true);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'homepage_free_band' }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-card border border-border bg-mist p-8 md:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-action/10 px-3 py-1 text-small font-semibold text-action">
            <Icon name="download" size={16} /> Free for Divi builders
          </span>
          <h2 className="mt-4 text-h3 text-navy">Free Divi 5 layouts, straight from the lab.</h2>
          <p className="mt-3 max-w-xl text-body text-muted">
            The catalog is the validator&apos;s proving ground: 190+ sections and pages generated, validated,
            rendered, and shipped — every one free. Drop your email and new ones land in your inbox.
          </p>

          {status === 'done' ? (
            <p role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-body font-semibold text-navy">
              <Icon name="mark_email_read" size={20} className="text-action" /> Check your inbox — you&apos;re on the list!
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Your email"
                className="min-w-0 flex-1 rounded-full border border-border bg-paper px-4 py-3 text-body text-navy outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="shrink-0 rounded-full bg-action px-6 py-3 text-small font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send me layouts'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p role="status" aria-live="polite" className="mt-2 text-small text-red-600">
              Something went wrong — try again.
            </p>
          )}

          <Link href="/browse" className="mt-5 inline-flex items-center gap-1 text-small font-semibold text-action hover:underline">
            Browse the free library <Icon name="arrow_forward" size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

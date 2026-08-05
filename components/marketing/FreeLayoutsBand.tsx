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
    <section className="bg-paper py-20">
      <div className="mx-auto max-w-5xl px-4">
        {/* Inset canvas panel — the lead magnet gets the brand ground even
            though the surrounding section stays light. */}
        <div className="canvas-deep relative overflow-hidden rounded-panel p-9 text-paper shadow-lift md:p-14">
          <div aria-hidden className="absolute inset-0">
            <span className="bloom -right-16 -top-16 h-80 w-80 bg-g-pink/30" />
            <span className="bloom -bottom-20 left-8 h-72 w-72 bg-g-purple/30" />
          </div>
          <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-paper/25 bg-paper/10 px-3.5 py-1.5 text-small font-semibold text-paper backdrop-blur">
            <Icon name="download" size={16} /> Free for Divi builders
          </span>
          <h2 className="mt-5 text-h3 text-paper">Free Divi 5 layouts, straight from the lab.</h2>
          <p className="mt-4 max-w-xl text-body text-paper/80">
            The catalog is the validator&apos;s proving ground: 190+ sections and pages generated, validated,
            rendered, and shipped — every one free. Drop your email and new ones land in your inbox.
          </p>

          {status === 'done' ? (
            <p role="status" aria-live="polite" className="mt-8 flex items-center gap-2 text-body font-semibold text-paper">
              <Icon name="mark_email_read" size={20} className="text-g-pink" /> Check your inbox — you&apos;re on the list!
            </p>
          ) : (
            /* One pill that contains the field and the button, Divi-Pixel style,
               rather than two separate controls sitting side by side. */
            <form
              onSubmit={submit}
              className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:gap-0 sm:rounded-pill sm:border sm:border-paper/25 sm:bg-paper/10 sm:p-1.5 sm:backdrop-blur"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Your email"
                className="min-w-0 flex-1 rounded-pill border border-paper/25 bg-paper/10 px-5 py-3 text-body text-paper outline-none backdrop-blur placeholder:text-paper/50 focus:border-paper/60 sm:border-transparent sm:bg-transparent sm:backdrop-blur-none sm:focus:border-transparent"
              />
              <button
                type="submit"
                disabled={submitting}
                className="shrink-0 rounded-pill bg-action px-7 py-3 text-small font-semibold text-paper shadow-glow transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send me layouts'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p role="status" aria-live="polite" className="mt-3 text-small text-g-amber">
              Something went wrong — try again.
            </p>
          )}

          <Link href="/browse" className="mt-7 inline-flex items-center gap-1.5 text-small font-semibold text-paper/90 transition hover:text-paper">
            Browse the free library <Icon name="arrow_forward" size={15} />
          </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

// Lead-gen for bespoke layout work — a navy card meant to sit beside the final CTA.
export function CustomBuildCta() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'custom_build' }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex h-full flex-col rounded-card bg-navy px-8 py-10 text-paper">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 text-small font-semibold">
        <Icon name="design_services" size={16} className="text-action" /> Custom work
      </span>
      <h2 className="mt-4 text-h2 text-paper">Need a custom layout built?</h2>
      <p className="mt-3 max-w-md text-lead text-paper/80">
        Want a section or a full page made to your brand — validated and import-ready? Tell us what you need and we’ll take it from there.
      </p>

      <div className="mt-auto pt-8">
        {status === 'done' ? (
          <div className="rounded-card bg-paper/10 p-5">
            <p className="flex items-center gap-2 text-body font-semibold text-paper">
              <Icon name="mark_email_read" size={20} className="text-action" /> Thanks — we’ll be in touch!
            </p>
            <p className="mt-1 text-small text-paper/70">We’ll reach out to scope your custom build.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              aria-label="Your email"
              className="min-w-0 flex-1 rounded-full bg-paper px-4 py-3 text-body text-navy outline-none"
            />
            <button type="submit" className="shrink-0 rounded-full bg-action px-6 py-3 text-small font-semibold text-paper transition hover:brightness-110">
              Request a build
            </button>
          </form>
        )}
        {status === 'error' && <p className="mt-2 text-small text-red-300">Something went wrong — try again.</p>}
      </div>
    </div>
  );
}

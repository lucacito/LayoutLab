'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

const SHOWN_KEY = 'll_offer_shown'; // shared with the scroll offer — only one offer per session

// Exit-intent lead capture: when the cursor leaves the top of the viewport (intent
// to leave), offer a free-pack lead magnet. Shows once per session; arms after a
// short delay so it never fires on load. (Desktop pointer behavior.)
export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
    } catch {
      return;
    }
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setOpen(true);
        try {
          sessionStorage.setItem(SHOWN_KEY, '1');
        } catch {
          /* ignore */
        }
        document.removeEventListener('mouseout', onLeave);
      }
    };
    const t = window.setTimeout(() => document.addEventListener('mouseout', onLeave), 5000);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mouseout', onLeave);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'exit_intent' }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Free Divi 5 sections offer"
      onClick={() => setOpen(false)}
    >
      <div className="relative w-full max-w-md rounded-card bg-paper p-8 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-mist hover:text-navy"
        >
          <Icon name="close" size={20} />
        </button>

        {status === 'done' ? (
          <div className="py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action">
              <Icon name="mark_email_read" size={26} />
            </span>
            <h2 className="mt-4 text-h3 text-navy">You&apos;re in 🎉</h2>
            <p className="mt-2 text-body text-muted">Check your inbox — your free Divi 5 starter pack is on the way.</p>
          </div>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action">
              <Icon name="bolt" size={26} />
            </span>
            <h2 className="mt-4 text-h3 text-navy">Wait — grab 10 free sections</h2>
            <p className="mt-2 text-body text-muted">
              Get a free Divi 5 starter pack (hero, pricing, CTA &amp; more) emailed to you. Import in seconds, no account needed.
            </p>
            <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Email address"
                className="min-w-0 flex-1 rounded-full border border-border px-4 py-2.5 text-body text-navy outline-none focus:border-action"
              />
              <button type="submit" className="rounded-full bg-action px-5 py-2.5 text-small font-semibold text-paper transition hover:brightness-110">
                Send it
              </button>
            </form>
            {status === 'error' && <p className="mt-2 text-small text-red-600">Something went wrong — try again.</p>}
            <p className="mt-3 text-center text-small text-muted">No spam. Unsubscribe anytime.</p>
          </>
        )}
      </div>
    </div>
  );
}

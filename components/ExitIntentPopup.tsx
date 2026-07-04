'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

const SHOWN_KEY = 'll_offer_shown'; // shared with the scroll offer — only one offer per session

// Exit-intent lead capture: when the cursor leaves the top of the viewport (intent
// to leave), offer a free-pack lead magnet. Shows once per session; arms after a
// short delay so it never fires on load. (Desktop pointer behavior.)
type TasterLayout = { id: string; slug: string; title: string };

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [layout, setLayout] = useState<TasterLayout | null>(null);

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
      const res = await fetch('/api/taster', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'exit_intent' }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const data = (await res.json()) as { layout?: TasterLayout | null };
      setLayout(data.layout ?? null);
      setStatus('done');
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
      aria-label="Free premium Divi 5 page offer"
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
          <div className="py-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action">
              <Icon name="workspace_premium" size={26} />
            </span>
            <h2 className="mt-4 text-h3 text-navy">Your page is ready 🎉</h2>
            {layout ? (
              <>
                <p className="mt-2 text-body text-muted">
                  Here&apos;s <span className="font-semibold text-navy">{layout.title}</span> — a full page from a premium pack, yours to keep.
                </p>
                <a
                  href={`/api/download/${layout.id}`}
                  download={`${layout.slug}.zip`}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-action px-6 py-2.5 text-small font-semibold text-paper transition hover:brightness-110"
                >
                  <Icon name="download" size={20} /> Download your free page
                </a>
                <p className="mt-3 text-small text-muted">Import the JSON into Divi 5 — commercial license included.</p>
              </>
            ) : (
              <p className="mt-2 text-body text-muted">Check your inbox — your free premium page is on the way.</p>
            )}
          </div>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action">
              <Icon name="workspace_premium" size={26} />
            </span>
            <h2 className="mt-4 text-h3 text-navy">Wait — take a full premium page, free</h2>
            <p className="mt-2 text-body text-muted">
              One complete page from our paid theme packs — yours to keep. See the quality before you buy the set. No account needed.
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
                Send my page
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

'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

const SHOWN_KEY = 'll_offer_shown'; // shared with the exit-intent — only one offer per session

// Non-modal lead nudge: after the visitor scrolls ~half the page (engaged), slide
// a compact offer in from the bottom-left. Once per session; same lead magnet as
// the exit-intent, lower friction.
type TasterLayout = { id: string; slug: string; title: string };

export function ScrollOffer() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [layout, setLayout] = useState<TasterLayout | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
    } catch {
      return;
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.5) {
        setOpen(true);
        try {
          sessionStorage.setItem(SHOWN_KEY, '1');
        } catch {
          /* ignore */
        }
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Trigger the slide-in transition on the tick after mount.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => setVisible(true), 20);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/taster', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'scroll_offer' }),
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

  function close() {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 300);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Free premium Divi 5 page offer"
      className={`fixed bottom-4 left-4 z-50 w-[330px] max-w-[calc(100vw-2rem)] rounded-card border border-border bg-paper p-5 shadow-lg transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'
      }`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-mist hover:text-navy"
      >
        <Icon name="close" size={18} />
      </button>

      {status === 'done' ? (
        <div className="py-1">
          <p className="flex items-center gap-2 text-body font-semibold text-navy">
            <Icon name="workspace_premium" size={20} className="text-action" /> Your page is ready 🎉
          </p>
          {layout ? (
            <>
              <p className="mt-1 text-small text-muted">{layout.title} — a full page from a premium pack.</p>
              <a
                href={`/api/download/${layout.id}`}
                download={`${layout.slug}.zip`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-2 text-small font-semibold text-paper transition hover:brightness-110"
              >
                <Icon name="download" size={18} /> Download free
              </a>
            </>
          ) : (
            <p className="mt-1 text-small text-muted">Your free premium page is on the way.</p>
          )}
        </div>
      ) : (
        <>
          <p className="flex items-center gap-2 text-body font-semibold text-navy">
            <Icon name="workspace_premium" size={20} className="text-action" /> Want a premium page, free?
          </p>
          <p className="mt-1 text-small text-muted">Take one full page from our paid theme packs — yours to keep.</p>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              aria-label="Email address"
              className="min-w-0 flex-1 rounded-full border border-border px-3 py-2 text-small text-navy outline-none focus:border-action"
            />
            <button type="submit" className="rounded-full bg-action px-4 py-2 text-small font-semibold text-paper transition hover:brightness-110">
              Get
            </button>
          </form>
          {status === 'error' && <p className="mt-1.5 text-small text-red-600">Try again.</p>}
        </>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { getRatedSlugs } from '@/lib/ratings/client';

const GOAL = 5;

// Gamified rating progress: rate elements → unlock a reward. Drives engagement +
// (at the reward) account creation. Count is client-side (the rater's own ratings).
export function RewardsProgress({ className = '' }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setCount(getRatedSlugs().length);
    update();
    window.addEventListener('ll-rated', update);
    return () => window.removeEventListener('ll-rated', update);
  }, []);

  if (count === null) return null; // avoid SSR/CSR mismatch before hydration
  const done = count >= GOAL;
  const pct = Math.min(100, Math.round((count / GOAL) * 100));

  return (
    <div className={`rounded-card border border-border bg-mist p-4 ${className}`}>
      {done ? (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action text-paper">
            <Icon name="emoji_events" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-navy">Reviewer reward unlocked 🎉</p>
            <p className="text-small text-muted">Thanks for rating {count} elements — claim a free premium pack.</p>
          </div>
          <Link href="/login" className="shrink-0 rounded-full bg-action px-4 py-2 text-small font-semibold text-paper transition hover:brightness-110">
            Claim
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-small font-medium text-navy">
              <Icon name="star" size={16} className="text-g-amber" />
              Rate {GOAL - count} more element{GOAL - count > 1 ? 's' : ''} to unlock a free premium pack
            </p>
            <span className="shrink-0 text-small tabular-nums text-muted">{count}/{GOAL}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-fog">
            <div className="h-full rounded-full bg-action transition-all" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

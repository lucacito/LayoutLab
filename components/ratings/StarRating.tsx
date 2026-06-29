'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { getRaterId, markRated } from '@/lib/ratings/client';

// Interactive rating widget for the element page. Anonymous; optimistic; persists
// the rater's choice and updates the live average.
export function StarRating({
  layoutId,
  slug,
  initialAverage,
  initialCount,
}: {
  layoutId: string;
  slug: string;
  initialAverage: number;
  initialCount: number;
}) {
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [yours, setYours] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  async function rate(stars: number) {
    if (busy) return;
    setBusy(true);
    const prev = yours;
    setYours(stars);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ layoutId, raterId: getRaterId(), stars }),
      });
      if (res.ok) {
        const d = (await res.json()) as { average: number; count: number; yourStars: number };
        setAverage(d.average);
        setCount(d.count);
        setYours(d.yourStars);
        markRated(slug);
      } else {
        setYours(prev);
      }
    } catch {
      setYours(prev);
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || yours;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="inline-flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            disabled={busy}
            aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => rate(i)}
            className="p-0.5 text-g-amber transition hover:scale-110 disabled:opacity-60"
          >
            <Icon name={shown >= i ? 'star' : 'star_border'} size={26} />
          </button>
        ))}
      </div>
      <span className="text-small text-muted">
        {count > 0 ? `${average.toFixed(1)} · ${count} rating${count > 1 ? 's' : ''}` : 'Be the first to rate'}
        {yours > 0 && <span className="font-medium text-navy"> · You rated</span>}
      </span>
    </div>
  );
}

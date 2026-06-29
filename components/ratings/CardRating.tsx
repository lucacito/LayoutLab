'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { getRaterId, markRated } from '@/lib/ratings/client';

function starName(i: number, fill: number): string {
  return fill >= i ? 'star' : fill >= i - 0.5 ? 'star_half' : 'star_border';
}

// Compact interactive rating for cards (homepage, browse). Rate in place without
// leaving the page; safe inside a card <Link> (stops navigation).
export function CardRating({
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

  async function rate(e: React.MouseEvent, stars: number) {
    e.preventDefault();
    e.stopPropagation();
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

  const fill = hover || yours || average;
  return (
    <div className="mt-2 flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
      <div className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            disabled={busy}
            aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(i)}
            onClick={(e) => rate(e, i)}
            className="text-g-amber transition hover:scale-110 disabled:opacity-60"
          >
            <Icon name={starName(i, fill)} size={15} />
          </button>
        ))}
      </div>
      <span className="text-small text-muted">
        {count > 0 ? (
          <>
            {average.toFixed(1)} <span className="font-normal">({count})</span>
          </>
        ) : yours > 0 ? (
          'Thanks!'
        ) : (
          'Rate'
        )}
      </span>
    </div>
  );
}

'use client';
import { useRef } from 'react';
import type { LayoutRow } from '@/lib/catalog/queries';
import { LayoutCard } from '@/components/LayoutCard';
import { Icon } from '@/components/ui/Icon';

export function RecentCarousel({ layouts }: { layouts: LayoutRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!layouts.length) return null;
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-navy">Listed recently</h2>
        <div className="flex gap-2">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={dir === -1 ? 'Scroll left' : 'Scroll right'}
              onClick={() => scroll(dir)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-paper text-navy transition hover:border-action hover:text-action"
            >
              <Icon name={dir === -1 ? 'chevron_left' : 'chevron_right'} size={22} />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        className="mt-6 flex snap-x gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {layouts.map((l) => (
          <div
            key={l.id}
            className="w-[72%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] md:w-[calc((100%-2*1.25rem)/3)] lg:w-[calc((100%-5*1.25rem)/6)]"
          >
            <LayoutCard layout={l} flat />
          </div>
        ))}
      </div>
    </div>
  );
}

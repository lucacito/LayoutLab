// components/ScreenshotGallery.tsx
'use client';
import { useState } from 'react';
import { PreviewImage } from '@/components/PreviewImage';

export function ScreenshotGallery({
  keys,
  title,
  type,
  color,
  layoutStyle,
}: {
  keys: string[];
  title: string;
  type?: string | null;
  color?: string | null;
  layoutStyle?: string | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!keys.length) return null;
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {keys.map((k, i) => (
          <button
            key={k}
            onClick={() => setActive(i)}
            className="overflow-hidden rounded-card border border-border bg-paper shadow-soft transition hover:-translate-y-0.5"
          >
            <PreviewImage src={k} alt={`${title} screenshot ${i + 1}`} type={type} color={color} layoutStyle={layoutStyle} sizes="(max-width: 768px) 100vw, 50vw" className="aspect-[4/3]" />
          </button>
        ))}
      </div>
      {active !== null && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4" onClick={() => setActive(null)}>
          <PreviewImage
            src={keys[active]}
            alt={`${title} full`}
            type={type}
            color={color}
            layoutStyle={layoutStyle}
            sizes="100vw"
            className="h-[80vh] w-full max-w-5xl rounded-card"
            imageClassName="!object-contain"
          />
        </div>
      )}
    </div>
  );
}

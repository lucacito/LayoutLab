// components/ScreenshotGallery.tsx
'use client';
import { useState } from 'react';
import Image from 'next/image';
import { assetUrl } from '@/lib/blob';

export function ScreenshotGallery({ keys, title }: { keys: string[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (!keys.length) return null;
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {keys.map((k, i) => (
          <button key={k} onClick={() => setActive(i)} className="relative aspect-[4/3] overflow-hidden rounded border border-gray-200">
            <Image src={assetUrl(k)} alt={`${title} screenshot ${i + 1}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </button>
        ))}
      </div>
      {active !== null && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setActive(null)}>
          <div className="relative h-[80vh] w-full max-w-5xl">
            <Image src={assetUrl(keys[active])} alt={`${title} full`} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

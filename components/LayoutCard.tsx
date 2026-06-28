// components/LayoutCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import type { LayoutRow } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob/url';

export function LayoutCard({ layout }: { layout: LayoutRow }) {
  const cover = layout.previewImageKeys[0];
  return (
    <Link href={`/layouts/${layout.slug}`} className="group block overflow-hidden rounded-lg border border-gray-200 transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gray-100">
        {cover && (
          <Image src={assetUrl(cover)} alt={layout.title} fill sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition group-hover:scale-[1.02]" />
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-gray-900">{layout.title}</h3>
        <p className="mt-1 text-xs text-gray-500">{layout.type} · {layout.niche} · {layout.style}</p>
      </div>
    </Link>
  );
}

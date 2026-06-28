// components/PackCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import type { PackRow } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';

export function PackCard({ pack }: { pack: PackRow }) {
  const price = pack.kind === 'free' ? 'Free'
    : pack.priceCents != null ? `$${(pack.priceCents / 100).toFixed(0)}` : '';
  return (
    <Link href={`/packs/${pack.slug}`} className="group block overflow-hidden rounded-lg border border-gray-200 transition hover:shadow-md">
      <div className="relative aspect-[3/2] bg-gray-100">
        {pack.coverImageKey && (
          <Image src={assetUrl(pack.coverImageKey)} alt={pack.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between p-3">
        <h3 className="truncate text-sm font-medium text-gray-900">{pack.title}</h3>
        <span className="ml-2 shrink-0 text-sm font-semibold text-gray-700">{price}</span>
      </div>
    </Link>
  );
}

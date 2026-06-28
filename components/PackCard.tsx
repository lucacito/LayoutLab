// components/PackCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import type { PackRow } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob/url';

export function PackCard({ pack }: { pack: PackRow }) {
  const price = pack.kind === 'free' ? 'Free' : pack.priceCents != null ? `$${(pack.priceCents / 100).toFixed(0)}` : '';
  return (
    <Link href={`/packs/${pack.slug}`} className="group block overflow-hidden rounded-card border border-border bg-paper shadow-soft transition hover:-translate-y-0.5">
      <div className="relative aspect-[3/2] bg-fog">
        {pack.coverImageKey && (
          <Image src={assetUrl(pack.coverImageKey)} alt={pack.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between p-5">
        <h3 className="truncate text-body font-semibold text-navy">{pack.title}</h3>
        <span className="ml-2 shrink-0 text-body font-bold text-action">{price}</span>
      </div>
    </Link>
  );
}

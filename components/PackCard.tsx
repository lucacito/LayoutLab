import { formatPriceCents } from '@/lib/format/price';
// components/PackCard.tsx
import Link from 'next/link';
import type { PackRow } from '@/lib/catalog/queries';
import { PreviewImage } from '@/components/PreviewImage';

export function PackCard({ pack, pageCount }: { pack: PackRow; pageCount?: number }) {
  const price = pack.kind === 'free' ? 'Free' : pack.priceCents != null ? formatPriceCents(pack.priceCents) : '';
  return (
    <Link href={`/packs/${pack.slug}`} className="group block overflow-hidden rounded-card border border-border bg-paper shadow-soft transition hover:-translate-y-0.5">
      <PreviewImage
        src={pack.coverImageKey}
        alt={pack.title}
        type="pack"
        color={pack.kind === 'free' ? 'green' : 'blue'}
        label={pack.kind === 'free' ? 'Free pack' : 'Pack'}
        sizes="(max-width: 768px) 100vw, 33vw"
        className="aspect-[3/2]"
      />
      <div className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-body font-semibold text-navy">{pack.title}</h3>
          {pageCount ? <p className="mt-1 text-small text-muted">{pageCount} pages · full site</p> : null}
        </div>
        <span className="ml-2 shrink-0 text-body font-bold text-action">{price}</span>
      </div>
    </Link>
  );
}

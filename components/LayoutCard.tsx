// components/LayoutCard.tsx
import Link from 'next/link';
import type { LayoutRow } from '@/lib/catalog/queries';
import { PreviewImage } from '@/components/PreviewImage';
import { BookmarkButton } from '@/components/bookmarks/BookmarkButton';

export function LayoutCard({ layout, flat = false }: { layout: LayoutRow; flat?: boolean }) {
  const cover = layout.previewImageKeys[0];
  return (
    <Link
      href={`/layouts/${layout.slug}`}
      className={`group relative block overflow-hidden rounded-card border border-border bg-paper transition hover:-translate-y-0.5 ${flat ? '' : 'shadow-soft'}`}
    >
      <BookmarkButton slug={layout.slug} className="absolute right-3 top-3 z-10" />
      <PreviewImage
        src={cover}
        alt={layout.title}
        label={layout.type}
        type={layout.type}
        color={layout.colors?.[0]}
        layoutStyle={layout.style}
        sizes="(max-width: 768px) 100vw, 33vw"
        className="aspect-[4/3]"
        imageClassName="transition group-hover:scale-[1.02]"
      />
      <div className="p-5">
        <h3 className="truncate text-body font-semibold text-navy">{layout.title}</h3>
        <p className="mt-1 text-small capitalize text-muted">{layout.type} · {layout.niche} · {layout.style}</p>
      </div>
    </Link>
  );
}

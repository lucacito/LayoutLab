import Link from 'next/link';
import { BuyButton } from '@/components/BuyButton';
import { Icon } from '@/components/ui/Icon';

/**
 * Shown on a paid-only layout's detail page. The individual page stays public for
 * SEO + preview, but the JSON download is gated: the visitor buys the pack this
 * layout belongs to. (The server route enforces the gate — this is the sell.)
 */
export function PaidLayoutCta({
  pack,
  pageCount,
}: {
  pack: { id: string; slug: string; title: string; priceCents: number };
  pageCount: number;
}) {
  const price = `$${(pack.priceCents / 100).toFixed(2)}`;
  return (
    <div className="w-full sm:max-w-sm">
      <div className="rounded-card border border-border bg-mist p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-action/10 px-2.5 py-0.5 text-small font-semibold text-action">
          <Icon name="lock" size={14} /> Premium — part of a pack
        </span>
        <p className="mt-3 text-body text-navy">
          This page ships inside <Link href={`/packs/${pack.slug}`} className="font-semibold underline decoration-action/40 underline-offset-2 hover:text-action">{pack.title}</Link>
          {pageCount > 1 ? ` — ${pageCount} coherent pages that share one brand.` : '.'}
        </p>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-h3 font-bold text-navy">{price}</span>
          <span className="text-small text-muted">one-time · commercial license</span>
        </div>
        <div className="mt-4 flex flex-col items-stretch gap-2">
          <BuyButton kind="pack" packId={pack.id} label={`Get the pack — ${price}`} />
          <Link href={`/packs/${pack.slug}`} className="text-center text-small font-medium text-muted underline underline-offset-2 hover:text-navy">
            See everything in the pack
          </Link>
        </div>
      </div>
    </div>
  );
}

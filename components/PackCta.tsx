import { BuyButton } from '@/components/BuyButton';
import { FreePackForm } from '@/components/FreePackForm';

/** Owners download; everyone else buys a paid pack or leaves an email for a free one. */
export function PackCta({ pack, entitled, priceLabel }: { pack: { id: string; slug: string; kind: 'free' | 'paid' }; entitled: boolean; priceLabel?: string }) {
  if (entitled) {
    return (
      <a href={`/api/download/pack/${pack.id}`} download={`${pack.slug}.zip`} className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
        Download pack
      </a>
    );
  }
  return pack.kind === 'paid'
    ? <BuyButton packId={pack.id} label={priceLabel ? `Buy this pack, ${priceLabel}` : 'Buy this pack'} />
    : <FreePackForm packId={pack.id} />;
}

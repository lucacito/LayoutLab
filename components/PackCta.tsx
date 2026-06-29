import { BuyButton } from '@/components/BuyButton';
import { FreePackForm } from '@/components/FreePackForm';

export function PackCta({ pack, entitled }: { pack: { id: string; slug: string; kind: 'free' | 'paid' }; entitled: boolean }) {
  if (entitled) {
    return (
      <a href={`/api/download/pack/${pack.id}`} download={`${pack.slug}.zip`} className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
        Download pack
      </a>
    );
  }
  return pack.kind === 'paid'
    ? <BuyButton kind="pack" packId={pack.id} label="Buy this pack" />
    : <FreePackForm packId={pack.id} />;
}

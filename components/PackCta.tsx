import { FreePackForm } from '@/components/FreePackForm';

// Marketplace demotion (Task 6): every pack is free-with-capture now — the paid
// (BuyButton) branch is gone. `pack.kind` stays on the prop shape for callers that
// still pass the DB row through, but this component no longer branches on it.
export function PackCta({ pack, entitled }: { pack: { id: string; slug: string; kind: 'free' | 'paid' }; entitled: boolean }) {
  if (entitled) {
    return (
      <a href={`/api/download/pack/${pack.id}`} download={`${pack.slug}.zip`} className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
        Download pack
      </a>
    );
  }
  return <FreePackForm packId={pack.id} />;
}

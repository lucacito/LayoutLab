// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BuyButton } from '@/components/BuyButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing — LayoutLab', description: 'Buy a pack or get all-access to every Divi 5 layout.' };

export default async function PricingPage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try { packs = (await listPacks()).filter((p) => p.kind === 'paid'); } catch { packs = []; }

  return (
    <main className="py-16">
      <Container>
        <SectionTitle eyebrow="Pricing" title="Buy a pack, or unlock everything">One-time packs, or all-access membership.</SectionTitle>

        <div className="mx-auto mt-12 max-w-md">
          <Card className="p-8 text-center">
            <h3 className="text-section text-navy">All-access membership</h3>
            <p className="mt-2 text-body text-muted">Every layout in the library, while your membership is active.</p>
            <div className="mt-6 flex flex-col gap-3">
              <BuyButton kind="membership" plan="monthly" label="Subscribe monthly" />
              <BuyButton kind="membership" plan="yearly" label="Subscribe yearly" />
            </div>
          </Card>
        </div>

        {packs.length > 0 && (
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => (
              <Card key={p.id} className="flex flex-col p-6">
                <h3 className="text-body font-semibold text-navy">{p.title}</h3>
                {p.description && <p className="mt-2 flex-1 text-small text-muted">{p.description}</p>}
                <div className="mt-4 text-h3 text-action">{p.priceCents != null ? `$${(p.priceCents / 100).toFixed(0)}` : ''}</div>
                <div className="mt-4"><BuyButton kind="pack" packId={p.id} label="Buy this pack" /></div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}

// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BuyButton } from '@/components/BuyButton';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing — LayoutLab', description: 'Free packs, one-time packs, or all-access membership for every Divi 5 layout.' };

const FAQ = [
  { question: 'What do I actually download?', answer: 'A Divi 5 layout as a JSON file, plus the commercial license. Import the JSON straight into the Divi builder.' },
  { question: 'What license do I get?', answer: 'One simple commercial license: use your purchases on unlimited sites you own or build for clients. Reselling or redistributing the files is not allowed.' },
  { question: 'Do you offer refunds?', answer: 'Layouts are digital goods delivered instantly, so sales are final once downloaded — but if a file is broken or you were charged in error, email info@layoutlab.com within 14 days and we will make it right. See the License & Refunds page.' },
  { question: 'How does the all-access membership work?', answer: 'While your membership is active you can download every layout in the library. Cancel anytime from your billing portal; access continues until the end of the period.' },
];

export default async function PricingPage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try { packs = await listPacks(); } catch { packs = []; }
  const freePacks = packs.filter((p) => p.kind === 'free');
  const paidPacks = packs.filter((p) => p.kind === 'paid');

  return (
    <main className="py-16">
      <Container>
        <SectionTitle eyebrow="Pricing" title="Start free, buy a pack, or unlock everything">Free lead-magnet packs, one-time purchases, or all-access membership.</SectionTitle>

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

        {freePacks.length > 0 && (
          <section className="mt-16">
            <h2 className="text-section text-navy">Free packs</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {freePacks.map((p) => (
                <Card key={p.id} className="flex flex-col p-6">
                  <h3 className="text-body font-semibold text-navy">{p.title}</h3>
                  {p.description && <p className="mt-2 flex-1 text-small text-muted">{p.description}</p>}
                  <div className="mt-4 text-h3 text-action">Free</div>
                  <Link href={`/packs/${p.slug}`} className="mt-4 inline-flex h-10 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110">Get it free</Link>
                </Card>
              ))}
            </div>
          </section>
        )}

        {paidPacks.length > 0 && (
          <section className="mt-16">
            <h2 className="text-section text-navy">Packs</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paidPacks.map((p) => (
                <Card key={p.id} className="flex flex-col p-6">
                  <h3 className="text-body font-semibold text-navy">{p.title}</h3>
                  {p.description && <p className="mt-2 flex-1 text-small text-muted">{p.description}</p>}
                  <div className="mt-4 text-h3 text-action">{p.priceCents != null ? `$${(p.priceCents / 100).toFixed(0)}` : ''}</div>
                  <div className="mt-4"><BuyButton kind="pack" packId={p.id} label="Buy this pack" /></div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-20">
          <h2 className="text-section text-navy">Frequently asked questions</h2>
          <dl className="mt-6 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-small text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Container>

      <JsonLd data={faqJsonLd(FAQ)} />
    </main>
  );
}

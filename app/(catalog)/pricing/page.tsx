// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { CtaNote } from '@/components/ui/CtaNote';
import { BuyButton } from '@/components/BuyButton';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing — LayoutLab', description: 'Start free with individual Divi 5 sections. Buy curated packs once, or unlock everything with an all-access membership.' };

const FAQ = [
  { question: 'What do I actually download?', answer: 'A Divi 5 layout as a JSON file, plus the commercial license. Import the JSON straight into the Divi builder.' },
  { question: 'What license do I get?', answer: 'One simple commercial license: use your purchases on unlimited sites you own or build for clients. Reselling or redistributing the files is not allowed.' },
  { question: 'Do you offer refunds?', answer: 'Layouts are digital goods delivered instantly, so sales are final once downloaded — but if a file is broken or you were charged in error, email info@layoutlab.com within 14 days and we will make it right. See the License & Refunds page.' },
  { question: 'How does the all-access membership work?', answer: 'While your membership is active you can download every layout in the library. Cancel anytime from your billing portal; access continues until the end of the period.' },
];

const TIER_FEATURES = {
  free: ['All individual sections — unlimited', 'Validated Divi 5 JSON, import-ready', 'Commercial license included', 'No account needed — just an email'],
  packs: ['Hand-picked sets for a whole site type', 'Every section in the pack', 'Lifetime access + updates', 'Commercial license included'],
  access: ['Every section and every pack', 'New drops added every week', 'All future content included', 'Cancel anytime'],
};

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-navy">
      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {children}
    </li>
  );
}

export default async function PricingPage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try { packs = await listPacks(); } catch { packs = []; }
  const freePacks = packs.filter((p) => p.kind === 'free');
  const paidPacks = packs.filter((p) => p.kind === 'paid');
  const minPaid = paidPacks.reduce<number | null>((m, p) => (p.priceCents != null ? Math.min(m ?? Infinity, p.priceCents) : m), null);
  const packsFrom = minPaid != null ? `from $${(minPaid / 100).toFixed(0)}` : 'one-time';

  return (
    <main className="py-16">
      <Container>
        <SectionTitle eyebrow="Pricing" title="Start free. Upgrade when you scale.">
          Individual sections are always free. Buy a pack once, or unlock everything with all-access.
        </SectionTitle>

        {/* Clear 3-tier overview */}
        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          <Card className="flex flex-col p-8">
            <h3 className="text-section text-navy">Free</h3>
            <div className="mt-3 text-h2 text-navy">$0</div>
            <p className="mt-2 text-body text-muted">Every individual section, free to download.</p>
            <ul className="mt-6 flex-1 space-y-3">{TIER_FEATURES.free.map((f) => <Feature key={f}>{f}</Feature>)}</ul>
            <Link href="/browse" className="mt-8 flex h-10 items-center justify-center rounded-full border border-border bg-paper px-4 text-small font-semibold text-navy transition hover:border-action hover:text-action">
              Browse free sections
            </Link>
          </Card>

          <Card className="flex flex-col p-8">
            <h3 className="text-section text-navy">Packs</h3>
            <div className="mt-3 flex items-baseline gap-1.5"><span className="text-h2 text-navy">{packsFrom}</span><span className="text-small text-muted">one-time</span></div>
            <p className="mt-2 text-body text-muted">Curated collections for a whole site type.</p>
            <ul className="mt-6 flex-1 space-y-3">{TIER_FEATURES.packs.map((f) => <Feature key={f}>{f}</Feature>)}</ul>
            <Link href="#packs" className="mt-8 flex h-10 items-center justify-center rounded-full border border-border bg-paper px-4 text-small font-semibold text-navy transition hover:border-action hover:text-action">
              See packs
            </Link>
          </Card>

          <Card className="relative flex flex-col border-action p-8 shadow-lg ring-1 ring-action">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">Most popular</span>
            <h3 className="text-section text-navy">All-Access</h3>
            <div className="mt-3 flex items-baseline gap-1.5"><span className="text-h2 text-navy">$12</span><span className="text-small text-muted">per month</span></div>
            <p className="mt-2 text-body text-muted">The entire library — and everything new.</p>
            <ul className="mt-6 flex-1 space-y-3">{TIER_FEATURES.access.map((f) => <Feature key={f}>{f}</Feature>)}</ul>
            <div className="mt-8 flex flex-col gap-2">
              <BuyButton kind="membership" plan="monthly" label="Get all-access" />
              <BuyButton kind="membership" plan="yearly" label="Or pay yearly & save" />
            </div>
          </Card>
        </div>

        <div className="mt-6"><CtaNote text="Free to start · No account needed · Cancel anytime" /></div>

        {/* Real pack listings */}
        {freePacks.length > 0 && (
          <section id="packs" className="mt-20 scroll-mt-24">
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
          <section id={freePacks.length > 0 ? undefined : 'packs'} className={freePacks.length > 0 ? 'mt-16' : 'mt-20 scroll-mt-24'}>
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

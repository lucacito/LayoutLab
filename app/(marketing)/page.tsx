import Link from 'next/link';
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { FeaturedPacks } from '@/components/marketing/FeaturedPacks';
import { ServicesHero } from '@/components/services/ServicesHero';
import { ServicesOffer } from '@/components/services/ServicesOffer';
import { ServicesSteps } from '@/components/services/ServicesSteps';
import { ServicesFreeBand } from '@/components/services/ServicesFreeBand';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Paid multi-page theme packs double as proof of build quality on the services
  // homepage (newest first). Failure is non-fatal — the band just hides.
  let paidPacks: Awaited<ReturnType<typeof listPacks>> = [];
  try {
    paidPacks = (await listPacks())
      .filter((p) => p.kind === 'paid')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    paidPacks = [];
  }

  return (
    <main>
      <ServicesHero />
      <ServicesOffer />
      <ServicesSteps />
      {paidPacks.length > 0 && <FeaturedPacks packs={paidPacks} />}
      <ServicesFreeBand />

      {/* Closing quote CTA */}
      <section className="border-t border-border bg-ink py-20 text-paper">
        <Container className="text-center">
          <h2 className="mx-auto max-w-2xl text-h2 text-paper">Ready for a site that brings in work?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-paper/85">
            Tell us about your business and we&apos;ll send a free quote and a preview built for you.
          </p>
          <Link href="/contact" className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110">
            Get a free quote
          </Link>
        </Container>
      </section>
    </main>
  );
}

import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { PluginHero } from '@/components/marketing/PluginHero';
import { PluginCards } from '@/components/marketing/PluginCards';
import { FreeLayoutsBand } from '@/components/marketing/FreeLayoutsBand';

export default async function HomePage() {
  return (
    <main>
      <PluginHero />
      <PluginCards />
      <FreeLayoutsBand />

      {/* Closing CTA */}
      <section className="border-t border-border bg-ink py-20 text-paper">
        <Container className="text-center">
          <h2 className="mx-auto max-w-2xl text-h2 text-paper">Ship your migration this week</h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-paper/85">
            Get the Pro converter and move a whole site — headers, footers, global styles, and all — into real,
            validated Divi 5 markup.
          </p>
          <Link href="/pricing" className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110">
            See pricing
          </Link>
        </Container>
      </section>
    </main>
  );
}

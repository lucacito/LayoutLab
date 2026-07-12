import Link from 'next/link';
import { Container } from '@/components/ui/Container';

// Homepage hero for the plugin-store pivot: leads with the flagship converter,
// not the (deleted) services funnel.
export function PluginHero() {
  return (
    <section className="border-b border-border bg-mist py-20">
      <Container className="text-center">
        <h1 className="mx-auto max-w-3xl text-h1 text-navy">
          Move your site between page builders — without rebuilding it.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lead text-muted">
          Our converters are validated against real Divi 5 and Elementor structure, so output imports clean the
          first time. Free plugins on wordpress.org — Pro unlocks whole-site migrations.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/plugins/elementor-to-divi-5"
            className="inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
          >
            Convert Elementor to Divi 5
          </Link>
          <Link
            href="/plugins"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
          >
            All plugins
          </Link>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-small font-medium text-muted">
          100+ active installs on wordpress.org · 140+ Elementor widgets mapped · 35+ Divi modules mapped
        </p>
      </Container>
    </section>
  );
}

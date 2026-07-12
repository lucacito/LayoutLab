import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

// Condensed mirror of the /plugins hub's three-card layout, for the homepage.
// Deliberately static (no data fetch) — the hub page is the source of truth.
type Product = {
  name: string;
  chip: { label: string; tone: 'green' | 'amber' | 'slate' };
  blurb: string;
  href: string;
};

const PRODUCTS: Product[] = [
  {
    name: 'Elementor → Divi 5 Converter',
    chip: { label: 'Free on wordpress.org · Pro $49/yr', tone: 'green' },
    blurb: 'Migrate Elementor pages and full kits into real, validated Divi 5 layouts.',
    href: '/plugins/elementor-to-divi-5',
  },
  {
    name: 'Divi → Elementor Converter',
    chip: { label: 'Free plugin pending wordpress.org review', tone: 'amber' },
    blurb: 'Batch-convert Divi pages into Elementor, with 35+ modules mapped.',
    href: '/plugins/divi-to-elementor',
  },
  {
    name: 'Divi 5 AI Editor',
    chip: { label: 'Coming soon', tone: 'slate' },
    blurb: 'Edit and generate Divi 5 pages with AI, checked by a deterministic validator.',
    href: '/plugins/divi-5-ai-editor',
  },
];

const CHIP_CLASSES: Record<Product['chip']['tone'], string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-fog text-muted border-border',
};

export function PluginCards() {
  return (
    <section className="py-16">
      <Container>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <Card key={p.name} className="flex flex-col p-7">
              <span
                className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-small font-semibold ${CHIP_CLASSES[p.chip.tone]}`}
              >
                {p.chip.label}
              </span>
              <h2 className="mt-4 text-section text-navy">{p.name}</h2>
              <p className="mt-2 flex-1 text-body text-muted">{p.blurb}</p>
              <Link
                href={p.href}
                className="mt-6 inline-flex h-11 w-fit items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
              >
                Learn more
              </Link>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}

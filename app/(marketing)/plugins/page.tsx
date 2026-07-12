import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

const WP_ORG_URL = 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/';

export const metadata: Metadata = {
  title: 'WordPress Plugins by Divi5Lab — converters & AI tools',
  description:
    'WordPress plugins for Divi 5: convert Elementor pages to Divi 5, convert Divi to Elementor, and edit Divi 5 pages with a validated AI editor.',
};

type Product = {
  name: string;
  chip: { label: string; tone: 'green' | 'amber' | 'slate' };
  blurb: string;
  href: string;
  secondaryLink?: { label: string; href: string };
  footnote?: string;
};

const PRODUCTS: Product[] = [
  {
    name: 'Elementor → Divi 5 Converter',
    chip: { label: 'Free on wordpress.org · Pro $49/yr', tone: 'green' },
    blurb: 'Migrate Elementor pages and full kits — global headers, footers, and styles — into real, validated Divi 5 layouts.',
    href: '/plugins/elementor-to-divi-5',
    secondaryLink: { label: 'View on wordpress.org', href: WP_ORG_URL },
  },
  {
    name: 'Divi → Elementor Converter',
    chip: { label: 'Free plugin pending wordpress.org review', tone: 'amber' },
    blurb: 'Batch-convert Divi pages into Elementor, with 35+ modules mapped and support for all three Divi export formats.',
    href: '/plugins/divi-to-elementor',
    footnote: 'Pro coming after approval — $49/yr',
  },
  {
    name: 'Divi 5 AI Editor',
    chip: { label: 'Coming soon', tone: 'slate' },
    blurb: 'Edit and generate Divi 5 pages with AI — every change is checked by a deterministic validator, so output always imports cleanly.',
    href: '/plugins/divi-5-ai-editor',
  },
];

const CHIP_CLASSES: Record<Product['chip']['tone'], string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-fog text-muted border-border',
};

export default function PluginsHub() {
  return (
    <main className="py-16">
      <Container>
        <h1 className="text-h1 text-navy">Plugins</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          WordPress plugins from Divi5Lab: convert between page builders and edit Divi 5 with AI — all output is real,
          validated Divi 5 markup.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PRODUCTS.map((p) => (
            <Card key={p.name} className="flex flex-col p-8">
              <span
                className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-small font-semibold ${CHIP_CLASSES[p.chip.tone]}`}
              >
                {p.chip.label}
              </span>
              <h2 className="mt-4 text-section text-navy">{p.name}</h2>
              <p className="mt-2 flex-1 text-body text-muted">{p.blurb}</p>
              {p.footnote && <p className="mt-3 text-small font-semibold text-navy">{p.footnote}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={p.href}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
                >
                  Learn more
                </Link>
                {p.secondaryLink && (
                  <a
                    href={p.secondaryLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-paper px-6 text-small font-semibold text-navy transition hover:border-action hover:text-action"
                  >
                    {p.secondaryLink.label}
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}

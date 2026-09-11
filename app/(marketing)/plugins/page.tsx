import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { PageHero } from '@/components/marketing/PageHero';
import { ProductDoors } from '@/components/marketing/ProductDoors';
import { CtaBand } from '@/components/marketing/CtaBand';
import { NextConverterBand } from '@/components/marketing/NextConverterBand';

export const metadata: Metadata = {
  title: 'Convert anything into Divi 5: WordPress plugins by Divi5Lab',
  description:
    'Converters that bring Elementor, Beaver Builder and WPBakery pages to Divi 5, a Divi to Elementor converter for the other direction, and a validated AI editor for Divi 5. Free tiers on all of them.',
};

const DECISIONS = [
  {
    icon: 'sync_alt',
    situation: 'I have an Elementor site and want Divi 5.',
    answer: 'Elementor → Divi 5 Converter',
    href: '/plugins/elementor-to-divi-5',
  },
  {
    icon: 'sync_alt',
    situation: 'I have a Beaver Builder site and want Divi 5.',
    answer: 'Beaver Builder → Divi 5 Converter',
    href: '/plugins/beaver-builder-to-divi-5',
  },
  {
    icon: 'sync_alt',
    situation: 'I have a WPBakery site and want Divi 5.',
    answer: 'WPBakery → Divi 5 Converter',
    href: '/plugins/wpbakery-to-divi-5',
  },
  {
    icon: 'u_turn_left',
    situation: 'I have a Divi site and need Elementor.',
    answer: 'Divi → Elementor Converter',
    href: '/plugins/divi-to-elementor',
  },
  {
    icon: 'smart_toy',
    situation: 'I already run Divi 5 and want AI to edit it safely.',
    answer: 'AI Editor for Divi 5',
    href: '/plugins/divi-5-ai-editor',
  },
  {
    icon: 'how_to_vote',
    situation: "I'm on Bricks, Oxygen or another builder.",
    answer: 'Vote for the next converter',
    href: '#next-converter',
  },
];

export default function PluginsHub() {
  return (
    <main>
      <PageHero
        eyebrow="WordPress plugins"
        title="Convert anything into Divi 5"
        lead="Pick the builder your site runs on. Every converter checks what it will produce before it writes, converts into real, validated Divi 5 modules, and can undo the run. The AI editor takes over once you are there."
      />

      <SectionShell tone="paper" pad="lg" bottom="sm">
        <Container>
          <ProductDoors />
        </Container>
      </SectionShell>

      <SectionShell tone="paper" top="none" pad="lg">
        <Container>
          <Card className="p-8">
            <h2 className="text-section text-navy">Which tool do I need?</h2>
            <ul className="mt-6 divide-y divide-border">
              {DECISIONS.map((d) => (
                <li key={d.href} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span className="flex items-center gap-3 text-body text-navy">
                    <Icon name={d.icon} size={20} className="text-action" /> {d.situation}
                  </span>
                  <Link href={d.href} className="inline-flex items-center gap-1 text-body font-semibold text-action hover:underline">
                    {d.answer} <Icon name="arrow_forward" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Container>
      </SectionShell>

      <NextConverterBand />

      <CtaBand
        eyebrow="Start free"
        title="Free to try on every builder."
        body="Free tiers on everything. Convert a page or make an AI edit before you spend a cent."
        cta={{ label: 'See pricing', href: '/pricing' }}
        curveTop={EDGE.paper}
      />
    </main>
  );
}

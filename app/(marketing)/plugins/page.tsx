import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { PageHero } from '@/components/marketing/PageHero';
import { ProductDoors } from '@/components/marketing/ProductDoors';
import { CtaBand } from '@/components/marketing/CtaBand';

export const metadata: Metadata = {
  title: 'WordPress Plugins by Divi5Lab: converters & AI tools',
  description:
    'WordPress plugins for Divi 5: convert Elementor pages to Divi 5, convert Divi to Elementor, and edit Divi 5 pages with a validated AI editor.',
};

const DECISIONS = [
  {
    icon: 'sync_alt',
    situation: 'I have an Elementor site and want Divi 5.',
    answer: 'Elementor → Divi 5 Converter',
    href: '/plugins/elementor-to-divi-5',
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
];

export default function PluginsHub() {
  return (
    <main>
      <PageHero
        eyebrow="WordPress plugins"
        title="Plugins"
        lead="Migration converters and an AI editor for Divi 5, every one built on the same deterministic validator, so the output is real, importable markup. Never a guess."
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

      <CtaBand
        eyebrow="Start free"
        title="One validator. Three ways to use it."
        body="Free tiers on everything. Try a conversion or an AI edit before you spend a cent."
        cta={{ label: 'See pricing', href: '/pricing' }}
        curveTop={EDGE.paper}
      />
    </main>
  );
}

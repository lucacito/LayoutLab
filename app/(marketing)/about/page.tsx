import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { IconFeature } from '@/components/ui/IconFeature';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'About — LayoutLab',
  description: 'LayoutLab is a marketplace of validated, import-ready Divi 5 layouts for WordPress builders.',
};

const POINTS = [
  { title: 'Built for Divi 5', body: 'Every layout is real, validated Divi 5 JSON — import it and keep building, no cleanup.' },
  { title: 'Quality-gated', body: 'A deterministic validator checks every layout before it reaches the catalog.' },
  { title: 'Yours to use', body: 'One simple commercial license: use what you buy on unlimited sites you own or build for clients.' },
];

export default function AboutPage() {
  const checkmarkIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <main className="py-16">
      <Container>
        <h1 className="text-h1 text-navy">About LayoutLab</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          LayoutLab helps WordPress builders move faster with a growing library of validated, import-ready
          Divi 5 layouts — heroes, pricing, landing pages and more — that drop straight into the builder.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {POINTS.map((p) => (
            <IconFeature key={p.title} icon={checkmarkIcon} title={p.title} body={p.body} />
          ))}
        </div>

        <div className="mt-12">
          <Button href="/browse">Browse the catalog</Button>
        </div>
      </Container>
    </main>
  );
}

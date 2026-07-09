// /guides — editorial cluster index. Every guide links into the catalog
// (taxonomy + keyword pages), building topical authority around "Divi layouts".
import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/lib/env';
import { listGuides } from '@/lib/guides';
import { itemListJsonLd, breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

const TITLE = 'Divi 5 Guides & Tutorials — Layouts, Imports, Comparisons';
const DESCRIPTION =
  'Practical Divi 5 guides: how to import layouts, the best layouts per industry, honest builder comparisons, and design tips from a validated layout pipeline.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/guides` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${env.NEXT_PUBLIC_SITE_URL}/guides`, type: 'website' },
};

export default function GuidesIndexPage() {
  const guides = listGuides();
  const site = env.NEXT_PUBLIC_SITE_URL;
  return (
    <main className="py-12">
      <Container>
        <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Guides', url: `${site}/guides` }]} />
        <JsonLd data={collectionPageJsonLd({ name: 'Divi 5 Guides & Tutorials', description: DESCRIPTION, url: `${site}/guides` })} />
        <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Guides', url: `${site}/guides` }])} />
        <JsonLd data={itemListJsonLd(guides.map((g) => ({ name: g.title, url: `${site}/guides/${g.slug}` })))} />

        <h1 className="mt-4 text-h2 text-navy">Divi 5 Guides &amp; Tutorials</h1>
        <p className="mt-4 max-w-2xl text-body text-muted">
          Field notes from building and validating thousands of Divi 5 sections: import walkthroughs,
          per-industry layout picks, honest builder comparisons, and the design rules our generator follows.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
              <Card className="h-full p-6 transition group-hover:-translate-y-0.5">
                <p className="text-small text-muted">{g.date}</p>
                <h2 className="mt-2 text-section text-navy transition group-hover:text-action">{g.title}</h2>
                <p className="mt-3 text-body text-muted">{g.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </Container>
    </main>
  );
}

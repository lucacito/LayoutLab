// /guides: editorial cluster index. Every guide links into the catalog
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
import { SectionShell } from '@/components/ui/SectionShell';
import { PageHero } from '@/components/marketing/PageHero';

const TITLE = 'Divi 5 Guides & Tutorials: Layouts, Imports, Comparisons';
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
    <main>
      <JsonLd data={collectionPageJsonLd({ name: 'Divi 5 Guides & Tutorials', description: DESCRIPTION, url: `${site}/guides` })} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Guides', url: `${site}/guides` }])} />
      <JsonLd data={itemListJsonLd(guides.map((g) => ({ name: g.title, url: `${site}/guides/${g.slug}` })))} />

      <PageHero
        above={<Breadcrumbs tone="dark" crumbs={[{ name: 'Home', url: site }, { name: 'Guides', url: `${site}/guides` }]} />}
        eyebrow="The lab notebook"
        title={<>Divi 5 Guides &amp; Tutorials</>}
        lead="The lab notebook, published. Everything here comes from building and validating hundreds of Divi 5 layouts: import walkthroughs, migration checklists, honest builder comparisons, and the design rules our own generator has to follow."
      />

      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
                <Card className="h-full p-7 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-lift">
                  <p className="eyebrow text-muted">{g.date}</p>
                  <h2 className="mt-3 text-section text-navy transition group-hover:text-action">{g.title}</h2>
                  <p className="mt-3 text-body text-muted">{g.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </SectionShell>
    </main>
  );
}

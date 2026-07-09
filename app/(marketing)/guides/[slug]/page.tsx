// /guides/[slug] — a single editorial guide rendered from content/guides/*.md.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getGuide, listGuides } from '@/lib/guides';
import { articleJsonLd, breadcrumbJsonLd, organizationId } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Markdown } from '@/components/Markdown';
import { Container } from '@/components/ui/Container';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const url = `${env.NEXT_PUBLIC_SITE_URL}/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: { title: guide.title, description: guide.description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/guides/${guide.slug}`;
  const others = listGuides().filter((g) => g.slug !== guide.slug).slice(0, 4);

  return (
    <main className="py-12">
      <Container className="max-w-3xl">
        <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Guides', url: `${site}/guides` }, { name: guide.title, url }]} />
        <JsonLd data={articleJsonLd({
          headline: guide.title,
          description: guide.description,
          url,
          datePublished: guide.date,
          dateModified: guide.updated ?? guide.date,
          authorName: 'Divi5Lab',
          publisherId: organizationId(site),
        })} />
        <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Guides', url: `${site}/guides` }, { name: guide.title, url }])} />

        <p className="mt-4 text-small text-muted">
          {guide.date}
          {guide.updated && guide.updated !== guide.date ? ` · Updated ${guide.updated}` : ''}
        </p>
        <h1 className="mt-2 text-h2 text-navy">{guide.title}</h1>
        <p className="mt-4 text-lead text-muted">{guide.description}</p>
        <Markdown content={guide.body} className="mt-8" />

        {others.length > 0 && (
          <aside className="mt-14 rounded-card border border-border bg-paper p-6">
            <h2 className="text-section text-navy">More guides</h2>
            <ul className="mt-4 space-y-2">
              {others.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="text-body text-action hover:underline">{g.title}</Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </Container>
    </main>
  );
}

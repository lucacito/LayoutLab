// app/(catalog)/[keyword]/page.tsx — programmatic keyword landing pages.
// One dynamic route renders every entry in lib/seo/keyword-pages.ts
// (/divi-layouts, /divi-templates, /free-divi-layouts, …). Static routes always
// win over this segment, so real pages (/browse, /pricing, /free, …) are never
// shadowed; anything not in the registry 404s.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getKeywordPage, listKeywordPages } from '@/lib/seo/keyword-pages';
import { listLayouts, listPacks } from '@/lib/catalog/queries';
import { collectionPageJsonLd, breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from '@/lib/seo';
import { hubLinkGroups } from '@/lib/seo/internal-links';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LayoutCard } from '@/components/LayoutCard';
import { PackCard } from '@/components/PackCard';
import { Markdown } from '@/components/Markdown';
import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

const GRID_SIZE = 24;

function browseHref(page: ReturnType<typeof listKeywordPages>[number]): string {
  const params = new URLSearchParams();
  for (const [axis, values] of Object.entries(page.filters)) {
    if (values && values.length) params.set(axis, values.join(','));
  }
  const qs = params.toString();
  return qs ? `/browse?${qs}` : '/browse';
}

export async function generateMetadata({ params }: { params: Promise<{ keyword: string }> }): Promise<Metadata> {
  const { keyword } = await params;
  const page = getKeywordPage(keyword);
  if (!page) return {};
  const url = `${env.NEXT_PUBLIC_SITE_URL}/${page.slug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: page.metaTitle, description: page.metaDescription, url, type: 'website' },
    twitter: { card: 'summary_large_image', title: page.metaTitle, description: page.metaDescription },
  };
}

export default async function KeywordLandingPage({ params }: { params: Promise<{ keyword: string }> }) {
  const { keyword } = await params;
  const page = getKeywordPage(keyword);
  if (!page) notFound();

  const filters = {
    type: page.filters.type ?? [],
    niche: page.filters.niche ?? [],
    style: page.filters.style ?? [],
    color: [],
    columns: [],
    sort: 'newest' as const,
    page: 1,
  };
  const [layouts, packs] = await Promise.all([
    listLayouts(filters).then((rows) => rows.slice(0, GRID_SIZE)),
    page.freeOnly ? listPacks().then((ps) => ps.filter((p) => p.kind === 'free')) : Promise.resolve([]),
  ]);

  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/${page.slug}`;
  const related = page.related.map(getKeywordPage).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const hubs = hubLinkGroups();

  return (
    <main className="py-12">
      <Container>
        <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: page.h1, url }]} />
        <JsonLd data={collectionPageJsonLd({ name: page.h1, description: page.metaDescription, url })} />
        <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: page.h1, url }])} />
        <JsonLd data={faqJsonLd(page.faq)} />
        <JsonLd data={itemListJsonLd(layouts.map((l) => ({ name: l.title, url: `${site}/layouts/${l.slug}` })))} />

        <h1 className="mt-4 max-w-3xl text-h2 text-navy">{page.h1}</h1>
        <Markdown content={page.intro} className="mt-6 max-w-3xl" />

        {packs.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-section text-navy">Free packs</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-4 text-section text-navy">Newest layouts</h2>
          {layouts.length === 0 ? (
            <p className="text-body text-muted">No layouts here yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
            </div>
          )}
          <div className="mt-8">
            <Link href={browseHref(page)} className="inline-flex items-center gap-1.5 font-semibold text-action hover:underline">
              Browse the full catalog <Icon name="arrow_forward" size={18} />
            </Link>
          </div>
        </section>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-section text-navy">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-border rounded-card border border-border bg-paper">
            {page.faq.map((f) => (
              <details key={f.question} className="group px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-semibold text-navy">
                  {f.question}
                  <Icon name="expand_more" size={22} className="shrink-0 text-muted transition group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-body text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-section text-navy">Keep exploring</h2>
          <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-small font-semibold uppercase tracking-wide text-muted">Related collections</h3>
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/${r.slug}`} className="text-body text-action hover:underline">{r.h1}</Link>
                  </li>
                ))}
              </ul>
            </div>
            {hubs.map((g) => (
              <div key={g.heading}>
                <h3 className="text-small font-semibold uppercase tracking-wide text-muted">{g.heading}</h3>
                <ul className="mt-3 space-y-2">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-body text-action hover:underline">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}

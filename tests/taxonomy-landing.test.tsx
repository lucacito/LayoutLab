import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TaxonomyLanding } from '@/components/TaxonomyLanding';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';
import type { LayoutRow } from '@/lib/catalog/queries';

const layout = { id: 'l1', slug: 'a', title: 'Bold Hero', type: 'hero', niche: 'saas', style: 'bold', colors: ['blue'], status: 'published', previewImageKeys: [] } as unknown as LayoutRow;

describe('TaxonomyLanding', () => {
  it('renders the intro, the grid, and ItemList + BreadcrumbList JSON-LD', () => {
    const { container, getByText } = render(
      <TaxonomyLanding axis="style" value="minimal" siteUrl="https://divi5lab.com"
        copy={{ intro: 'Minimal intro here', metaTitle: 'x', metaDescription: 'y' }} layouts={[layout]}
        searchParams={{}} currentPage={1} totalPages={1} />,
      { wrapper: BookmarksProvider },
    );
    expect(getByText(/Minimal intro here/)).toBeTruthy();
    expect(getByText('Bold Hero')).toBeTruthy();
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('"ItemList"'))).toBe(true);
    expect(ld.some((t) => t.includes('"BreadcrumbList"'))).toBe(true);
  });

  it('renders the long-form body and related-category links when present', () => {
    const { getByText, container } = render(
      <TaxonomyLanding axis="type" value="hero" siteUrl="https://divi5lab.com"
        copy={{ intro: 'i', body: '## Why hero sections matter\n\nLong-form body copy here.', metaTitle: 'x', metaDescription: 'y' }}
        layouts={[layout]} searchParams={{}} currentPage={1} totalPages={1}
        guides={[{ slug: 'divi-5-design-tips', title: 'Divi 5 Design Tips' }]} />,
      { wrapper: BookmarksProvider },
    );
    expect(getByText(/Long-form body copy here/)).toBeTruthy();
    expect(getByText('Related categories')).toBeTruthy();
    // sibling type link (hero page → pricing), cross-axis niche link, guide link
    expect(container.querySelector('a[href="/type/pricing"]')).toBeTruthy();
    expect(container.querySelector('a[href="/niche/saas"]')).toBeTruthy();
    expect(container.querySelector('a[href="/guides/divi-5-design-tips"]')).toBeTruthy();
    // never links to itself
    expect(container.querySelector('a[href="/type/hero"]')).toBeNull();
  });

  it('omits the body section when body is absent (pre-backfill rows)', () => {
    const { container } = render(
      <TaxonomyLanding axis="style" value="minimal" siteUrl="https://divi5lab.com"
        copy={{ intro: 'i', metaTitle: 'x', metaDescription: 'y' }} layouts={[layout]}
        searchParams={{}} currentPage={1} totalPages={1} />,
      { wrapper: BookmarksProvider },
    );
    expect(container.querySelector('.prose-divi')).toBeNull();
  });

  it('shows an empty state when there are no layouts', () => {
    const { getByText } = render(
      <TaxonomyLanding axis="type" value="faq" siteUrl="https://divi5lab.com"
        copy={{ intro: 'i', metaTitle: 'x', metaDescription: 'y' }} layouts={[]}
        searchParams={{}} currentPage={1} totalPages={1} />,
    );
    expect(getByText(/no layouts/i)).toBeTruthy();
  });
});

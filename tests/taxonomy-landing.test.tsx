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
        copy={{ intro: 'Minimal intro here', metaTitle: 'x', metaDescription: 'y' }} layouts={[layout]} />,
      { wrapper: BookmarksProvider },
    );
    expect(getByText(/Minimal intro here/)).toBeTruthy();
    expect(getByText('Bold Hero')).toBeTruthy();
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('"ItemList"'))).toBe(true);
    expect(ld.some((t) => t.includes('"BreadcrumbList"'))).toBe(true);
  });

  it('shows an empty state when there are no layouts', () => {
    const { getByText } = render(
      <TaxonomyLanding axis="type" value="faq" siteUrl="https://divi5lab.com"
        copy={{ intro: 'i', metaTitle: 'x', metaDescription: 'y' }} layouts={[]} />,
    );
    expect(getByText(/no layouts/i)).toBeTruthy();
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CatalogGrid } from '@/components/CatalogGrid';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';
import type { LayoutRow, PackRow } from '@/lib/catalog/queries';

const layout = { id: 'l1', slug: 'free-hero', title: 'Free Hero', type: 'hero', niche: 'saas', style: 'bold', colors: ['blue'], status: 'published', previewImageKeys: [], ratingCount: 0, ratingSum: 0 } as unknown as LayoutRow;
const pack = { id: 'p1', slug: 'kiln-pottery-studio-theme', title: 'Kiln Pottery Studio Theme', kind: 'paid', priceCents: 1200, coverImageKey: null } as unknown as PackRow;

describe('CatalogGrid', () => {
  it('shows a paid pack as one pack card with its page count, before the layouts', () => {
    const { container, getByText } = render(
      <CatalogGrid packs={[{ pack, pageCount: 6 }]} layouts={[layout]} />,
      { wrapper: BookmarksProvider },
    );
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links[0]).toBe('/packs/kiln-pottery-studio-theme');
    expect(links).toContain('/layouts/free-hero');
    expect(getByText('6 pages · full site')).toBeTruthy();
    expect(getByText('$12')).toBeTruthy();
  });

  it('renders layouts alone when there are no packs', () => {
    const { container } = render(<CatalogGrid layouts={[layout]} />, { wrapper: BookmarksProvider });
    expect(container.querySelectorAll('a[href^="/packs/"]').length).toBe(0);
    expect(container.querySelector('a[href="/layouts/free-hero"]')).toBeTruthy();
  });
});

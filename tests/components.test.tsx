// tests/components.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LayoutCard } from '@/components/LayoutCard';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';

const layout = {
  id: 'l1', slug: 'bold-saas-hero', title: 'Bold SaaS Hero', description: 'desc',
  type: 'hero', niche: 'saas', style: 'bold', colors: ['blue'],
  diviJsonBlobKey: 'k.json', previewImageKeys: ['https://picsum.photos/seed/x/800/600'],
  contentHash: 'h', perceptualHash: null, validatorPassed: true, seo: null,
  status: 'published', createdAt: new Date(), publishedAt: new Date(),
} as any;

describe('components', () => {
  it('JsonLd renders a ld+json script with the payload', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Product', name: 'X' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script!.innerHTML).toContain('"Product"');
  });

  it('Breadcrumbs renders each crumb label', () => {
    const { getByText } = render(<Breadcrumbs crumbs={[{ name: 'Home', url: '/' }, { name: 'Browse', url: '/browse' }]} />);
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Browse')).toBeTruthy();
  });

  it('LayoutCard links to the layout detail page and shows the title', () => {
    const { getByText, container } = render(<LayoutCard layout={layout} />, { wrapper: BookmarksProvider });
    expect(getByText('Bold SaaS Hero')).toBeTruthy();
    expect(container.querySelector('a[href="/layouts/bold-saas-hero"]')).not.toBeNull();
  });
});

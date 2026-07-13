import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Header/MobileNav use useSession; stub it (logged out) — no SessionProvider in this render.
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }));

import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';

describe('site chrome', () => {
  it('Header shows the wordmark and plugins-first nav links', () => {
    const { container, queryByText } = render(<Header />, { wrapper: BookmarksProvider });
    expect(container.querySelector('img[alt="Divi5Lab"]')).not.toBeNull();
    // Plugins-first nav (mega-menus): Plugins → /plugins, Free layouts → /browse,
    // Guides → /guides, Get Pro CTA → /pricing.
    expect(container.querySelector('a[href="/plugins"]')).not.toBeNull();
    expect(container.querySelector('a[href="/browse"]')).not.toBeNull();
    expect(container.querySelector('a[href="/guides"]')).not.toBeNull();
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
    expect(queryByText('Work with us')).toBeNull();
    expect(queryByText('Get a free quote')).toBeNull();
  });
  it('Footer renders a contentinfo landmark and the brand', () => {
    const { getAllByText, container } = render(<Footer />);
    expect(container.querySelector('footer')).not.toBeNull();
    expect(getAllByText(/Divi5Lab/).length).toBeGreaterThan(0);
  });

  it('Footer has a Plugins column, renamed Pricing link, and reachable contact', () => {
    const { getByText, getAllByText, queryByText, container } = render(<Footer />);
    expect(getByText('Plugins')).toBeTruthy();
    expect(container.querySelector('a[href="/plugins"]')).not.toBeNull();
    expect(container.querySelector('a[href="/plugins/divi-5-ai-editor"]')).not.toBeNull();
    expect(container.querySelector('a[href="/plugins/divi-to-elementor"]')).not.toBeNull();
    expect(container.querySelector('a[href="/plugins/elementor-to-divi-5"]')).not.toBeNull();
    expect(getAllByText('Pricing').length).toBeGreaterThan(0);
    expect(queryByText(/Pricing & all-access/)).toBeNull();
    expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
    expect(getByText(/migration plugins for WordPress builders/)).toBeTruthy();
  });
});

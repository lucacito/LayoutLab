import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Header/MobileNav use useSession; stub it (logged out) — no SessionProvider in this render.
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }));

import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';

describe('site chrome', () => {
  it('Header shows the wordmark and funnel nav links', () => {
    const { container } = render(<Header />, { wrapper: BookmarksProvider });
    expect(container.querySelector('img[alt="Divi5Lab"]')).not.toBeNull();
    // Funnel nav (services-first): Examples → /browse, Work with us + quote CTA → /contact,
    // Free Divi layouts → /free-divi-layouts. (Pricing/taxonomy moved to the footer.)
    expect(container.querySelector('a[href="/browse"]')).not.toBeNull();
    expect(container.querySelector('a[href="/contact"]')).not.toBeNull();
    expect(container.querySelector('a[href="/free-divi-layouts"]')).not.toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
  });
  it('Footer renders a contentinfo landmark and the brand', () => {
    const { getAllByText, container } = render(<Footer />);
    expect(container.querySelector('footer')).not.toBeNull();
    expect(getAllByText(/Divi5Lab/).length).toBeGreaterThan(0);
  });
});

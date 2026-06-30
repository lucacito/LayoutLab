import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';

describe('site chrome', () => {
  it('Header shows the wordmark and primary nav links', () => {
    const { container } = render(<Header />, { wrapper: BookmarksProvider });
    expect(container.querySelector('img[alt="Divi5Lab"]')).not.toBeNull();
    expect(container.querySelector('a[href="/browse"]')).not.toBeNull();
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
  });
  it('Footer renders a contentinfo landmark and the brand', () => {
    const { getAllByText, container } = render(<Footer />);
    expect(container.querySelector('footer')).not.toBeNull();
    expect(getAllByText(/Divi5Lab/).length).toBeGreaterThan(0);
  });
});

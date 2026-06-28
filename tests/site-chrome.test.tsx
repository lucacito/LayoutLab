import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';

describe('site chrome', () => {
  it('Header shows the wordmark and primary nav links', () => {
    const { getByText, container } = render(<Header />);
    expect(getByText('LayoutLab')).toBeTruthy();
    expect(container.querySelector('a[href="/browse"]')).not.toBeNull();
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
  });
  it('Footer renders a contentinfo landmark and the brand', () => {
    const { getByText, container } = render(<Footer />);
    expect(container.querySelector('footer')).not.toBeNull();
    expect(getByText(/LayoutLab/)).toBeTruthy();
  });
});

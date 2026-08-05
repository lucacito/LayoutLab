// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/plugins/BuyProButton', () => ({
  BuyProButton: ({ product }: { product: string }) => <div data-testid={`buy-${product}`} />,
}));

import D2EPage, { metadata } from '@/app/(marketing)/plugins/divi-to-elementor/page';

describe('/plugins/divi-to-elementor', () => {
  it('is a live sales page: buy button, wordpress.org link, no waitlist', async () => {
    render(await D2EPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Divi.*Elementor/i);
    expect(screen.getByTestId('buy-divi-to-elementor-pro')).toBeTruthy();
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/');
    expect(screen.queryByText(/pending wordpress\.org review/i)).toBeNull();
    expect(screen.queryByText(/waitlist/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /notify me/i })).toBeNull();
  });
  it('states the Pro price', async () => {
    render(await D2EPage());
    expect(screen.getAllByText(/\$25\/yr/).length).toBeGreaterThan(0);
  });
  it('emits Product JSON-LD with the Pro offer', async () => {
    const { container } = render(await D2EPage());
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('"Product"') && t.includes('25'))).toBe(true);
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/Divi to Elementor/i); });
  it('shows the batch-conversion mock', async () => {
    render(await D2EPage());
    // "batch run" also appears in the agency use-case copy ("Batch runs turn
    // each handover…"), so assert presence rather than a single unique match.
    expect(screen.getAllByText(/batch run/i).length).toBeGreaterThan(0);
  });
  it('has an expanded FAQ', async () => {
    render(await D2EPage());
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(6);
  });
});

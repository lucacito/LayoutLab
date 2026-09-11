// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/plugins/BuyProButton', () => ({
  BuyProButton: ({ product }: { product: string }) => <div data-testid={`buy-${product}`} />,
}));

import PricingPage, { metadata } from '@/app/(catalog)/pricing/page';

describe('/pricing (plugin licenses)', () => {
  it('shows the Elementor→Divi5 Pro card with a live buy button', async () => {
    render(await PricingPage());
    expect(screen.getByText(/Elementor → Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getAllByText(/\$25/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('buy-elementor-to-divi5-pro')).toBeTruthy();
  });
  it('shows Divi→Elementor Pro with a live buy button, no longer coming soon', async () => {
    render(await PricingPage());
    expect(screen.getByText(/Divi → Elementor Pro/i)).toBeTruthy();
    expect(screen.getByTestId('buy-divi-to-elementor-pro')).toBeTruthy();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
  it('mentions free layouts but sells no packs or membership', async () => {
    render(await PricingPage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
    expect(screen.queryByText(/all-access|membership/i)).toBeNull();
  });
  it('keeps FAQ JSON-LD', async () => {
    const { container } = render(await PricingPage());
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    expect(scripts.some((s) => (s.textContent ?? '').includes('FAQPage'))).toBe(true);
  });
  it('has plugin-focused metadata', () => {
    expect(String(metadata.title)).toMatch(/pricing/i);
    expect(String(metadata.description)).toMatch(/plugin|converter/i);
  });
  it('tells the license philosophy once', async () => {
    render(await PricingPage());
    expect(screen.getByText(/licenses that respect you/i)).toBeTruthy();
    expect(screen.getByText(/nothing breaks/i)).toBeTruthy();
  });
  it('shows the AI Editor at $30', async () => {
    render(await PricingPage());
    expect(screen.getAllByText(/\$30/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('buy-ai-editor-divi5-pro')).toBeTruthy();
  });
  it('puts the free tier one click away on every plugin card', async () => {
    render(await PricingPage());
    const zips = screen.getAllByRole('link', { name: /download the free plugin \(\.zip\)/i });
    expect(zips.map((a) => a.getAttribute('href')).sort()).toEqual([
      '/downloads/jhmg-converter-for-beaver-builder-to-divi-5.zip',
      '/downloads/jhmg-converter-for-wpbakery-to-divi.zip',
    ]);
    expect(zips.every((a) => a.hasAttribute('download'))).toBe(true);
    const wporg = screen.getAllByRole('link', { name: /get the free plugin on wordpress\.org/i });
    expect(wporg.map((a) => a.getAttribute('href')).sort()).toEqual([
      'https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/',
      'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/',
    ]);
  });
});

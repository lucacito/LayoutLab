// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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
    // "coming soon" is now expected, but only for the AI Editor's Pro add-on note
    const soon = screen.getAllByText(/coming soon/i);
    expect(soon.length).toBe(1);
    expect(soon[0]!.textContent).toMatch(/pro add-on coming soon/i);
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
  it('shows the AI Editor as free, with no price, no buy button and a Pro add-on note', async () => {
    const { container } = render(await PricingPage());
    expect(screen.getByText(/AI Editor for Divi 5$/)).toBeTruthy();
    expect(screen.queryByTestId('buy-ai-editor-divi5-pro')).toBeNull();
    expect(container.textContent).not.toMatch(/\$30|45-day|free trial/i);
    const card = screen.getByText(/AI Editor for Divi 5$/).closest('div.relative, .flex-col') as HTMLElement;
    expect(card.textContent).toMatch(/Free/);
    expect(card.textContent).toMatch(/pro add-on coming soon/i);
    const link = within(card).getByRole('link', { name: /get the free ai editor/i });
    expect(link.getAttribute('href')).toBe('/plugins/divi-5-ai-editor');
  });
  it('answers the AI Editor FAQ truthfully', async () => {
    render(await PricingPage());
    expect(screen.getByText(/is the ai editor free\?/i)).toBeTruthy();
    expect(screen.getByText(/the ai editor has no paid plan today/i)).toBeTruthy();
    expect(screen.queryByText(/page creation, menus, and site-wide styling/i)).toBeNull();
  });
  it('puts the free tier one click away on every plugin card', async () => {
    render(await PricingPage());
    expect(screen.queryByRole('link', { name: /download the free plugin \(\.zip\)/i })).toBeNull();
    const wporg = screen.getAllByRole('link', { name: /get the free plugin on wordpress\.org/i });
    expect(wporg.map((a) => a.getAttribute('href')).sort()).toEqual([
      'https://wordpress.org/plugins/jhmg-converter-for-beaver-builder-to-divi-5/',
      'https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/',
      'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/',
      'https://wordpress.org/plugins/jhmg-converter-for-wpbakery-to-divi-5/',
    ]);
  });
});

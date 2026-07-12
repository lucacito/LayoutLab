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
    expect(screen.getAllByText(/\$49/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('buy-elementor-to-divi5-pro')).toBeTruthy();
  });
  it('shows Divi→Elementor Pro as coming soon (no buy button)', async () => {
    render(await PricingPage());
    expect(screen.getByText(/Divi → Elementor Pro/i)).toBeTruthy();
    expect(screen.queryByTestId('buy-divi-to-elementor-pro')).toBeNull();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
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
  it('shows the AI Editor at $79', async () => {
    render(await PricingPage());
    expect(screen.getAllByText(/\$79/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('buy-ai-editor-divi5-pro')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PRICING } from '@/lib/pricing/config';

vi.mock('@/components/plugins/BuyProButton', () => ({
  BuyProButton: ({ product, tier, lifetime }: { product: string; tier?: string; lifetime?: boolean }) => (
    <div data-testid={`buy-${product}`} data-tier={tier} data-lifetime={lifetime ? 'true' : undefined} />
  ),
}));

import PricingPage, { metadata } from '@/app/(catalog)/pricing/page';

describe('/pricing (AI Editor Pro and converters)', () => {
  it('leads with AI Editor Pro: three tier cards from config', async () => {
    render(await PricingPage());
    expect(screen.getByText(/AI Editor for Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getByText(/personal/i)).toBeTruthy();
    expect(screen.getByText(/freelancer/i)).toBeTruthy();
    expect(screen.getByText(/agency/i)).toBeTruthy();
    // Prices should appear (from PRICING config)
    expect(screen.getByText(/\$49\/year/i)).toBeTruthy();
    expect(screen.getByText(/\$99\/year/i)).toBeTruthy();
    expect(screen.getByText(/\$149\/year/i)).toBeTruthy();
  });

  it('shows lifetime option capped at 50', async () => {
    render(await PricingPage());
    expect(screen.getByText(/lifetime/i)).toBeTruthy();
    expect(screen.getByText(/\$449 one-time/i)).toBeTruthy();
    expect(screen.getByText(/first 50 buyers/i)).toBeTruthy();
  });

  it('mentions founding offer (30% off) and trial (45 days, no card)', async () => {
    render(await PricingPage());
    expect(screen.getByText(/founding offer.*30% off/i)).toBeTruthy();
    expect(screen.getByText(/45 days free/i)).toBeTruthy();
    expect(screen.getByText(/no credit card/i)).toBeTruthy();
  });

  it('shows converter Pro plugins below AI Editor tiers', async () => {
    render(await PricingPage());
    expect(screen.getByText(/converter pro plugins/i)).toBeTruthy();
    expect(screen.getByText(/Elementor to Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getByText(/WPBakery to Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getByText(/Divi to Elementor Pro/i)).toBeTruthy();
    expect(screen.getByText(/Beaver Builder to Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getAllByText(/\$25\/yr/).length).toBeGreaterThanOrEqual(4);
  });

  it('has FAQ explaining Pro features, expiry, tiers, and trial', async () => {
    render(await PricingPage());
    expect(screen.getByText(/what does the ai editor pro add-on/i)).toBeTruthy();
    expect(screen.getByText(/what if my license expires/i)).toBeTruthy();
    expect(screen.getByText(/how many sites does each tier/i)).toBeTruthy();
    expect(screen.getByText(/can i try the pro add-on/i)).toBeTruthy();
  });

  it('keeps FAQ JSON-LD', async () => {
    const { container } = render(await PricingPage());
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    expect(scripts.some((s) => (s.textContent ?? '').includes('FAQPage'))).toBe(true);
  });

  it('has metadata for AI Editor Pro and converters', () => {
    expect(String(metadata.title)).toMatch(/AI Editor Pro and converters/i);
    expect(String(metadata.description)).toMatch(/personal.*freelancer.*agency/i);
    expect(String(metadata.description)).toMatch(/\$25/);
  });

  it('mentions free layouts to download', async () => {
    render(await PricingPage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
    expect(screen.getByText(/free to download and use/i)).toBeTruthy();
  });

  it('tier cards use BuyProButton with tier and lifetime props', async () => {
    const { container } = render(await PricingPage());
    // BuyProButton mocked components render as divs with data-testid
    const buyButtons = container.querySelectorAll('[data-testid^="buy-ai-editor-divi5-pro"]');
    expect(buyButtons.length).toBeGreaterThan(3); // At least personal, freelancer, agency, lifetime
    const lifetimeButton = Array.from(buyButtons).find(b => b.getAttribute('data-lifetime'));
    expect(lifetimeButton).toBeTruthy();
  });
});

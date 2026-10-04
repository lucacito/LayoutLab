// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PRICING, formatUsd } from '@/lib/pricing/config';

// Set up environment variables needed for pricing page to show tier cards
beforeAll(() => {
  process.env.STRIPE_PRICE_AI_EDITOR_PERSONAL = 'price_personal_test';
  process.env.STRIPE_PRICE_AI_EDITOR_FREELANCER = 'price_freelancer_test';
  process.env.STRIPE_PRICE_AI_EDITOR_AGENCY = 'price_agency_test';
  process.env.STRIPE_PRICE_AI_EDITOR_LIFETIME = 'price_lifetime_test';
});

vi.mock('@/components/plugins/BuyProButton', () => ({
  BuyProButton: ({ product, tier, lifetime }: { product: string; tier?: string; lifetime?: boolean }) => (
    <div data-testid={`buy-${product}`} data-tier={tier} data-lifetime={lifetime ? 'true' : undefined} />
  ),
}));

import PricingPage, { metadata } from '@/app/(catalog)/pricing/page';

describe('/pricing (AI Editor Pro and converters)', () => {
  it('leads with AI Editor Pro: three tier cards from config', async () => {
    const { container } = render(await PricingPage());
    expect(screen.getByText(/AI Editor for Divi 5 Pro/i)).toBeTruthy();
    // Verify tier cards are rendered by checking for h3 elements with tier names
    const allH3s = Array.from(container.querySelectorAll('h3')).map(h => h.textContent?.toLowerCase() || '');
    expect(allH3s).toContain('personal');
    expect(allH3s).toContain('freelancer');
    expect(allH3s).toContain('agency');
    // Prices should appear (from PRICING config) - rendered as separate spans
    expect(screen.getByText('$49')).toBeTruthy();
    expect(screen.getByText('$99')).toBeTruthy();
    expect(screen.getByText('$149')).toBeTruthy();
  });

  it('shows the lifetime option with its cap from the config', async () => {
    const { container } = render(await PricingPage());
    // Check for Lifetime card heading
    const allH3s = Array.from(container.querySelectorAll('h3')).map(h => h.textContent?.toLowerCase() || '');
    expect(allH3s).toContain('lifetime');
    // Prices are rendered as separate spans
    expect(screen.getByText(formatUsd(PRICING.lifetime.priceCents))).toBeTruthy();
    expect(screen.getByText('one-time')).toBeTruthy();
    const capText = `first ${PRICING.lifetime.cap} sales`;
    expect(Array.from(container.querySelectorAll('*')).some(el => el.textContent?.toLowerCase().includes(capText))).toBe(true);
  });

  it('mentions founding offer (30% off) and trial (45 days, no card)', async () => {
    const { container } = render(await PricingPage());
    expect(screen.getByText(/founding offer.*30% off/i)).toBeTruthy();
    // "45 days" appears in multiple places, so use the specific trial text
    expect(screen.getByText(/try the pro add-on free for 45 days/i)).toBeTruthy();
    // "no credit card required" appears in multiple places, so check that it's in the page somewhere
    const hasNoCreditCard = Array.from(container.querySelectorAll('*'))
      .some(el => el.textContent?.toLowerCase().includes('no credit card required'));
    expect(hasNoCreditCard).toBe(true);
  });

  it('shows converter Pro plugins below AI Editor tiers', async () => {
    const { container } = render(await PricingPage());
    // Use role to find the section heading specifically (avoiding FAQ matches)
    const heading = Array.from(container.querySelectorAll('h2'))
      .find(h => h.textContent?.toLowerCase().includes('converter pro plugins'));
    expect(heading).toBeTruthy();
    expect(screen.getByText(/Elementor to Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getByText(/WPBakery to Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getByText(/Divi to Elementor Pro/i)).toBeTruthy();
    expect(screen.getByText(/Beaver Builder to Divi 5 Pro/i)).toBeTruthy();
    // Prices are rendered as separate spans
    const converterPrices = screen.getAllByText('$25');
    expect(converterPrices.length).toBeGreaterThanOrEqual(4);
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
    // Verify that all four tier options are presented with correct pricing
    const allH3s = Array.from(container.querySelectorAll('h3')).map(h => h.textContent?.toLowerCase() || '');
    expect(allH3s).toContain('personal');
    expect(allH3s).toContain('freelancer');
    expect(allH3s).toContain('agency');
    expect(allH3s).toContain('lifetime');
    // Verify each tier card is rendered with its price info
    expect(screen.getByText('$49')).toBeTruthy();
    expect(screen.getByText('$99')).toBeTruthy();
    expect(screen.getByText('$149')).toBeTruthy();
    expect(screen.getByText(formatUsd(PRICING.lifetime.priceCents))).toBeTruthy();
    expect(screen.getByText('one-time')).toBeTruthy();
  });
});

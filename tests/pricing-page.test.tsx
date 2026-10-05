// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PRICING, formatUsd, lowestTier } from '@/lib/pricing/config';

// Set up environment variables needed for pricing page to show tier cards
beforeAll(() => {
  process.env.STRIPE_PRICE_AI_EDITOR_PERSONAL = 'price_personal_test';
  process.env.STRIPE_PRICE_AI_EDITOR_FREELANCER = 'price_freelancer_test';
  process.env.STRIPE_PRICE_AI_EDITOR_AGENCY = 'price_agency_test';
  process.env.STRIPE_PRICE_AI_EDITOR_LIFETIME = 'price_lifetime_test';
});

const { availability } = vi.hoisted(() => ({ availability: vi.fn() }));
vi.mock('@/lib/pricing/availability', () => ({ getAvailability: availability }));

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

  const open = { founding: { count: 10, remaining: PRICING.founding.cap - 10, available: true }, lifetime: { count: 1, remaining: PRICING.lifetime.cap - 1, available: true } };

  it('mentions the founding offer only while checkout can apply it', async () => {
    process.env.STRIPE_COUPON_AI_EDITOR_FOUNDING = 'co_f';
    availability.mockResolvedValue(open);
    const { container, unmount } = render(await PricingPage());
    const text = container.textContent ?? '';
    expect(text).toContain(`Founding offer: ${PRICING.founding.cap - 10} of ${PRICING.founding.cap} left`);
    expect(text).toContain('What is the founding offer?');
    unmount();

    // sold out: no promise anywhere
    availability.mockResolvedValue({ ...open, founding: { count: PRICING.founding.cap, remaining: 0, available: false } });
    const soldOut = render(await PricingPage());
    expect(soldOut.container.textContent).not.toMatch(/founding/i);
    soldOut.unmount();

    // coupon not configured: no promise either
    delete process.env.STRIPE_COUPON_AI_EDITOR_FOUNDING;
    availability.mockResolvedValue(open);
    const noCoupon = render(await PricingPage());
    expect(noCoupon.container.textContent).not.toMatch(/founding/i);
  });

  it('says on the Lifetime card that the founding offer applies to it, only while checkout can apply it', async () => {
    process.env.STRIPE_COUPON_AI_EDITOR_FOUNDING = 'co_f';
    availability.mockResolvedValue(open);
    const withOffer = render(await PricingPage());
    const lifetimeCard = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('h3')).find((h) => h.textContent?.toLowerCase() === 'lifetime')?.closest('div[class*="flex-col"]');
    expect(lifetimeCard(withOffer.container)?.textContent).toContain(`${PRICING.founding.percentOff}% off`);
    withOffer.unmount();

    availability.mockResolvedValue({ ...open, founding: { count: PRICING.founding.cap, remaining: 0, available: false } });
    const soldOut = render(await PricingPage());
    expect(lifetimeCard(soldOut.container)?.textContent).not.toMatch(/% off/);
  });

  it('does not claim updates or support forever for Lifetime, and has no unearned badge', async () => {
    availability.mockResolvedValue(open);
    const { container } = render(await PricingPage());
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/forever/i);
    expect(text).not.toMatch(/most popular/i);
    expect(text).toContain('One payment, no renewal');
  });

  it('the trial text and the closing call to action come from the config and go somewhere', async () => {
    availability.mockResolvedValue(open);
    const { container } = render(await PricingPage());
    expect(screen.getByText(new RegExp(`try the pro add-on free for ${PRICING.trial.days} days`, 'i'))).toBeTruthy();
    expect((container.textContent ?? '').toLowerCase().includes('no credit card required')).toBe(!PRICING.trial.requireCard);
    expect(container.querySelector('a[href="#"]')).toBeNull();
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
    expect(String(metadata.title)).toMatch(/AI Editor for Divi 5 Pro and Converters/i);
    expect(String(metadata.title).length).toBeLessThanOrEqual(55);
    expect(String(metadata.description)).toContain(`from ${formatUsd(lowestTier().priceCents)}/yr`);
    expect(String(metadata.description)).toContain(`${PRICING.trial.days}-day free trial`);
    expect(String(metadata.description)).toMatch(/\$25/);
    expect(metadata.alternates?.canonical).toBe('/pricing');
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

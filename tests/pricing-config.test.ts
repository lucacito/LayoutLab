import { describe, it, expect } from 'vitest';
import {
  PRICING, getTier, tierSiteLimit, formatUsd, proratedUpgradeCents,
} from '@/lib/pricing/config';

describe('pricing config', () => {
  it('parses the pricing config from JSON', () => {
    expect(PRICING).toBeDefined();
    expect(PRICING.version).toBe(1);
    expect(PRICING.product).toBe('ai-editor-divi5-pro');
  });

  it('tiers are ordered ascending by price', () => {
    const tiers = PRICING.tiers;
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.priceCents).toBeGreaterThanOrEqual(tiers[i - 1]!.priceCents);
    }
  });

  it('agency is unlimited sites', () => {
    const agency = getTier('agency');
    expect(agency?.sites).toBeNull();
  });

  it('getTier returns undefined for unknown tier', () => {
    expect(getTier('nope')).toBeUndefined();
  });

  it('formatUsd(4900) === "$49"', () => {
    expect(formatUsd(4900)).toBe('$49');
  });

  it('formatUsd(14900) === "$149"', () => {
    expect(formatUsd(14900)).toBe('$149');
  });

  it('proratedUpgradeCents: half period costs half the difference', () => {
    const oldCents = 4900;
    const newCents = 9900;
    const halfPeriodMs = 365 * 24 * 60 * 60 * 1000 / 2;
    const fullPeriodMs = 365 * 24 * 60 * 60 * 1000;
    const result = proratedUpgradeCents(oldCents, newCents, halfPeriodMs, fullPeriodMs);
    expect(result).toBe(2500);
  });

  it('proratedUpgradeCents: zero remaining costs zero', () => {
    const result = proratedUpgradeCents(4900, 9900, 0, 365 * 24 * 60 * 60 * 1000);
    expect(result).toBe(0);
  });

  it('proratedUpgradeCents: remaining > period clamps to full difference', () => {
    const fullPeriodMs = 365 * 24 * 60 * 60 * 1000;
    const result = proratedUpgradeCents(4900, 9900, fullPeriodMs * 2, fullPeriodMs);
    expect(result).toBe(5000);
  });

  it('proratedUpgradeCents: new <= old returns 0 (no cost for downgrade)', () => {
    const result = proratedUpgradeCents(9900, 4900, 100, 1000);
    expect(result).toBe(0);
  });

  it('tierSiteLimit returns null for null id', () => {
    expect(tierSiteLimit(null)).toBeNull();
  });

  it('tierSiteLimit returns null for unlimited (agency)', () => {
    expect(tierSiteLimit('agency')).toBeNull();
  });

  it('tierSiteLimit returns 1 for personal', () => {
    expect(tierSiteLimit('personal')).toBe(1);
  });

  it('tierSiteLimit returns 10 for freelancer', () => {
    expect(tierSiteLimit('freelancer')).toBe(10);
  });
});

describe('id validators', () => {
  it('accept Stripe ids and reject pasted labels', async () => {
    const { isStripePriceId, isCouponId } = await import('@/lib/pricing/config');
    expect(isStripePriceId('price_1QabcXYZ123')).toBe(true);
    for (const bad of ['$49.00 per year', '$449.00', 'price 1abc', 'prod_123', '', undefined, null]) expect(isStripePriceId(bad as never)).toBe(false);
    expect(isCouponId('ai-editor-divi5-pro-founding')).toBe(true);
    for (const bad of ['30% off', 'a b', '', undefined]) expect(isCouponId(bad as never)).toBe(false);
  });
});

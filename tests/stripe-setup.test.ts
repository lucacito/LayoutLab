import { describe, it, expect } from 'vitest';
import { packProductParams, packPriceParams } from '@/scripts/stripe-setup';

describe('stripe setup params', () => {
  it('builds a product from a pack', () => {
    const p = packProductParams({ slug: 'saas-kit', title: 'SaaS Kit', description: 'desc' });
    expect(p.name).toBe('SaaS Kit');
    expect(p.metadata?.packSlug).toBe('saas-kit');
  });
  it('builds a one-time USD price in cents', () => {
    const p = packPriceParams('prod_1', 4900);
    expect(p.product).toBe('prod_1');
    expect(p.unit_amount).toBe(4900);
    expect(p.currency).toBe('usd');
    expect(p.recurring).toBeUndefined();
  });
});

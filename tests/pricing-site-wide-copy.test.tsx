// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';

// A buyer read "site-wide tools" as "access to everything on the store". The copy must say what the tools do
// (they work across one WordPress site) and the FAQ must say a licence is per plugin.
beforeAll(() => {
  process.env.STRIPE_PRICE_AI_EDITOR_PERSONAL = 'price_personal_test';
  process.env.STRIPE_PRICE_AI_EDITOR_FREELANCER = 'price_freelancer_test';
  process.env.STRIPE_PRICE_AI_EDITOR_AGENCY = 'price_agency_test';
  process.env.STRIPE_PRICE_AI_EDITOR_LIFETIME = 'price_lifetime_test';
});

const { availability } = vi.hoisted(() => ({ availability: vi.fn() }));
vi.mock('@/lib/pricing/availability', () => ({ getAvailability: availability }));
vi.mock('@/components/plugins/BuyProButton', () => ({ BuyProButton: () => <div /> }));

import PricingPage from '@/app/(catalog)/pricing/page';

describe('/pricing copy that could be read as store-wide access', () => {
  it('describes the Pro tools as working across the whole WordPress site, not as "site-wide tools"', async () => {
    availability.mockResolvedValue({ founding: { count: 0, remaining: 100, available: true }, lifetime: { count: 0, remaining: 100, available: true } });
    const { container } = render(await PricingPage());
    const text = container.textContent ?? '';
    expect(text).toContain('tools that work across your whole WordPress site');
    expect(text).not.toMatch(/site-wide tools/i);
  });

  it('answers whether a Pro licence includes the other plugins: no, each plugin has its own licence', async () => {
    availability.mockResolvedValue({ founding: { count: 0, remaining: 100, available: true }, lifetime: { count: 0, remaining: 100, available: true } });
    const { container } = render(await PricingPage());
    const text = container.textContent ?? '';
    expect(text).toContain('Does an AI Editor Pro licence include your other plugins?');
    expect(text).toContain('Each plugin is licensed separately');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/catalog/queries', () => ({
  listPacks: vi.fn(async () => [
    { id: 'f1', slug: 'free-heroes', title: 'Free Heroes', kind: 'free', priceCents: null, description: 'Lead magnet' },
    { id: 'p1', slug: 'pro-landers', title: 'Pro Landers', kind: 'paid', priceCents: 4900, description: 'Paid' },
  ]),
}));
vi.mock('@/components/BuyButton', () => ({ BuyButton: () => null }));

import PricingPage from '@/app/(catalog)/pricing/page';

describe('PricingPage', () => {
  it('shows free packs linking to their pack page, and an FAQ', async () => {
    const ui = await PricingPage();
    const { container, getByText } = render(ui);
    expect(getByText('Free Heroes')).toBeTruthy();
    expect(container.querySelector('a[href="/packs/free-heroes"]')).not.toBeNull();
    // FAQ present
    expect(getByText(/frequently asked|FAQ/i)).toBeTruthy();
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('"FAQPage"'))).toBe(true);
  });
});

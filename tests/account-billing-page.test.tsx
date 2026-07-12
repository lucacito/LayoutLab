// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth/admin', () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { email: 'buyer@x.com' } }),
}));
const getActiveSubscription = vi.fn().mockResolvedValue(null);
const getStripeCustomerIdByEmail = vi.fn().mockResolvedValue(null as string | null);
vi.mock('@/lib/account/queries', () => ({
  getUserIdByEmail: vi.fn().mockResolvedValue('u1'),
  getActiveSubscription: (...args: unknown[]) => getActiveSubscription(...args),
  getStripeCustomerIdByEmail: (...args: unknown[]) => getStripeCustomerIdByEmail(...args),
}));
const getLicensesForUser = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/license-server/store', () => ({
  getLicensesForUser: (...args: unknown[]) => getLicensesForUser(...args),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/billing' }));

import BillingPage from '@/app/(account)/account/billing/page';

const activeLicense = {
  id: 'lic_1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', status: 'active',
  currentPeriodEnd: new Date('2027-07-11T00:00:00Z'), activeSites: [],
};

describe('/account/billing', () => {
  it('shows the portal button for an active license with a linked Stripe customer', async () => {
    getLicensesForUser.mockResolvedValueOnce([activeLicense]);
    getStripeCustomerIdByEmail.mockResolvedValueOnce('cus_123');
    render(await BillingPage());
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeTruthy();
  });

  it('comped license (no Stripe customer): no portal button, passive support line instead', async () => {
    getLicensesForUser.mockResolvedValueOnce([activeLicense]);
    getStripeCustomerIdByEmail.mockResolvedValueOnce(null);
    render(await BillingPage());
    expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
    expect(screen.getByText(/issued manually/i)).toBeTruthy();
    expect(screen.getByText(/support@divi5lab\.com/i)).toBeTruthy();
  });

  it('no license and no subscription: pricing CTA, no portal button', async () => {
    render(await BillingPage());
    expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
    expect(screen.getByRole('link', { name: /see plugin pricing/i })).toBeTruthy();
  });
});

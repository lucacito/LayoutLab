// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth/admin', () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { email: 'buyer@x.com' } }),
}));
vi.mock('@/lib/account/queries', () => ({
  getUserIdByEmail: vi.fn().mockResolvedValue('u1'),
}));
vi.mock('@/lib/license-server/store', () => ({
  getLicensesForUser: vi.fn().mockResolvedValue([{
    id: 'lic_1', productSlug: 'elementor-to-divi5-pro',
    licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', status: 'active',
    currentPeriodEnd: new Date('2027-07-11T00:00:00Z'),
    activeSites: ['client-site.com'],
  }]),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/licenses' }));

import LicensesPage from '@/app/(account)/account/licenses/page';

describe('/account/licenses', () => {
  it('lists the license with key, product, status, sites and a download link', async () => {
    render(await LicensesPage());
    expect(screen.getByText('JHMG-AAAA-BBBB-CCCC-DDDD')).toBeTruthy();
    expect(screen.getByText(/Elementor to Divi 5/)).toBeTruthy();
    expect(screen.getByText(/client-site\.com/)).toBeTruthy();
    const dl = screen.getByRole('link', { name: /download pro/i }) as HTMLAnchorElement;
    expect(dl.href).toContain('/api/plugin/download?product=elementor-to-divi5-pro&key=JHMG-AAAA-BBBB-CCCC-DDDD');
  });
});

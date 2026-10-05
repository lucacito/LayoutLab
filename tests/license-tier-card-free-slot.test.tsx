// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { LicenseTierCard } from '@/components/account/LicenseTierCard';
import { PRICING } from '@/lib/pricing/config';

const license = {
  id: 'lic_1', productSlug: PRICING.product, licenseKey: 'KEY-1', status: 'active' as const,
  currentPeriodEnd: null, activeSites: ['https://a.example', 'https://b.example'], tier: 'agency', founding: false, lifetime: false, trial: false,
};
const card = (l: typeof license) => render(<LicenseTierCard productTitle="AI Editor Pro" license={l} />);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('freeing a site slot from the account page', () => {
  it('is offered for every active site even when the licence still has unused slots', () => {
    card(license); // agency allows more than 2 sites, so the licence is NOT at its limit
    expect(screen.getAllByRole('button', { name: 'Free this slot' })).toHaveLength(2);
  });

  it('is offered on a lifetime licence too', () => {
    card({ ...license, lifetime: true });
    expect(screen.getAllByRole('button', { name: 'Free this slot' })).toHaveLength(2);
  });

  it('is not offered on another product (the server route only frees AI Editor licences)', () => {
    card({ ...license, productSlug: 'elementor-to-divi5-pro' });
    expect(screen.queryByRole('button', { name: 'Free this slot' })).toBeNull();
  });

  it('says freeing a slot does not switch the plugin off on that site', () => {
    const { container } = card(license);
    expect(container.textContent).toContain('keeps working');
  });

  it('asks before freeing and does nothing when the owner declines', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    card(license);
    fireEvent.click(screen.getAllByRole('button', { name: 'Free this slot' })[0]);
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('frees exactly the chosen site once the owner confirms', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    card(license);
    fireEvent.click(screen.getAllByRole('button', { name: 'Free this slot' })[1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/license/free-site');
    expect(JSON.parse(init.body)).toEqual({ licenseId: 'lic_1', siteUrl: 'https://b.example' });
  });
});

describe('the billing link on the licence card', () => {
  const link = (l: typeof license) => card(l).container.querySelector('a[href="/account/billing"]');

  it('an annual licence offers billing, card and cancellation', () => {
    expect(link(license)?.textContent).toBe('Billing, card and cancellation');
  });

  it('a Lifetime licence has no renewal to cancel, but still links to its invoices and receipts', () => {
    const a = link({ ...license, lifetime: true });
    expect(a?.textContent).toBe('Invoices and receipts');
  });
});

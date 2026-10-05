// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { LicenseTierCard } from '@/components/account/LicenseTierCard';
import { PRICING } from '@/lib/pricing/config';

const license = {
  id: 'lic_1', productSlug: PRICING.product, licenseKey: 'KEY-1', status: 'active' as const,
  currentPeriodEnd: null, activeSites: [], tier: 'agency', founding: true, lifetime: false, trial: false,
};
const text = (l: typeof license) => render(<LicenseTierCard productTitle="AI Editor Pro" license={l} />).container.textContent ?? '';

describe('the founding badge on the licence card', () => {
  it('an annual founding licence says the founding price is locked', () => {
    expect(text(license)).toContain('Founding price locked');
  });

  it('a lifetime founding licence says Founding offer, because a lifetime licence has no renewal price to lock', () => {
    const t = text({ ...license, lifetime: true });
    expect(t).toContain('Founding offer');
    expect(t).not.toContain('price locked');
    expect(t).toContain('Lifetime');
  });
});

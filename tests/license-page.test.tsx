import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/license', () => ({ readLicense: () => 'COMMERCIAL LICENSE AGREEMENT\n\nUse it on unlimited sites you own.' }));

import LicensePage from '@/app/(marketing)/license/page';
import { REFUND_POLICY } from '@/lib/legal/refund';

describe('REFUND_POLICY', () => {
  it('is a non-empty digital-goods statement', () => {
    expect(REFUND_POLICY.length).toBeGreaterThan(20);
    expect(REFUND_POLICY.toLowerCase()).toContain('digital');
  });
});

describe('LicensePage', () => {
  it('renders the license text and a refunds section', () => {
    const { getByText, getByRole } = render(<LicensePage />);
    expect(getByText(/COMMERCIAL LICENSE AGREEMENT/)).toBeTruthy();
    expect(getByRole('heading', { name: /refund/i })).toBeTruthy();
  });
});

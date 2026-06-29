import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), ANALYTICS_EVENTS: { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } }));

import { BuyButton } from '@/components/BuyButton';
import { trackEvent } from '@/lib/analytics';

beforeEach(() => {
  (trackEvent as any).mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ url: 'https://checkout.test/s' }) })));
  vi.spyOn(window.location, 'assign').mockImplementation(() => {});
});

describe('BuyButton', () => {
  it('fires checkout_started with the pack id when clicked', async () => {
    const { getByRole } = render(<BuyButton kind="pack" packId="p1" label="Buy" />);
    fireEvent.click(getByRole('button', { name: 'Buy' }));
    await waitFor(() => expect((trackEvent as any)).toHaveBeenCalledWith('checkout_started', { kind: 'pack', packId: 'p1' }));
  });

  it('fires checkout_started with the plan for membership', async () => {
    const { getByRole } = render(<BuyButton kind="membership" plan="monthly" label="Subscribe" />);
    fireEvent.click(getByRole('button', { name: 'Subscribe' }));
    await waitFor(() => expect((trackEvent as any)).toHaveBeenCalledWith('checkout_started', { kind: 'membership', plan: 'monthly' }));
  });
});

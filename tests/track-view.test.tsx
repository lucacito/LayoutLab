import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), ANALYTICS_EVENTS: { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } }));

import { TrackView } from '@/components/TrackView';
import { trackEvent } from '@/lib/analytics';

describe('TrackView', () => {
  it('fires the event once on mount with its props', () => {
    render(<TrackView event="product_viewed" props={{ kind: 'pack', slug: 'a' }} />);
    expect((trackEvent as any)).toHaveBeenCalledTimes(1);
    expect((trackEvent as any)).toHaveBeenCalledWith('product_viewed', { kind: 'pack', slug: 'a' });
  });
});

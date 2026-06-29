import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/analytics');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ANALYTICS_EVENTS', () => {
  it('defines the three funnel events with snake_case names', async () => {
    const { ANALYTICS_EVENTS } = await import('@/lib/analytics');
    expect(ANALYTICS_EVENTS.productViewed).toBe('product_viewed');
    expect(ANALYTICS_EVENTS.checkoutStarted).toBe('checkout_started');
    expect(ANALYTICS_EVENTS.freeCaptureSubmitted).toBe('free_capture_submitted');
  });
});

describe('trackEvent', () => {
  it('forwards the name + props to @vercel/analytics track', async () => {
    const { trackEvent } = await import('@/lib/analytics');
    const analytics = await import('@vercel/analytics');
    const trackMock = analytics.track as ReturnType<typeof vi.fn>;
    trackEvent('checkout_started', { kind: 'pack', packId: 'p1' });
    expect(trackMock).toHaveBeenCalledWith('checkout_started', { kind: 'pack', packId: 'p1' });
  });

  it('never throws if track throws', async () => {
    const analytics = await import('@vercel/analytics');
    const trackMock = analytics.track as ReturnType<typeof vi.fn>;
    trackMock.mockImplementation(() => { throw new Error('no analytics'); });
    const { trackEvent } = await import('@/lib/analytics');
    expect(() => trackEvent('product_viewed')).not.toThrow();
  });
});

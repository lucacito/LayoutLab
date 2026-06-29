import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@/lib/capture/actions', () => ({ captureFreePackAction: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), ANALYTICS_EVENTS: { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } }));

import { FreePackForm } from '@/components/FreePackForm';
import { trackEvent } from '@/lib/analytics';

describe('FreePackForm', () => {
  it('renders an email input and a submit button', () => {
    const { container, getByRole } = render(<FreePackForm packId="p1" />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(getByRole('button')).toBeTruthy();
  });

  it('fires free_capture_submitted on submit', () => {
    const { container } = render(<FreePackForm packId="p1" />);
    fireEvent.submit(container.querySelector('form')!);
    expect((trackEvent as any)).toHaveBeenCalledWith('free_capture_submitted', { packId: 'p1' });
  });
});

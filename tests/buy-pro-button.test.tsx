// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BuyProButton } from '@/components/plugins/BuyProButton';

describe('BuyProButton', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('POSTs the plugin product to /api/checkout and redirects to the session url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_x' }) });
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    render(<BuyProButton product="elementor-to-divi5-pro" label="Get Pro" />);
    fireEvent.click(screen.getByRole('button', { name: /get pro/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_x'));
    expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ kind: 'plugin', product: 'elementor-to-divi5-pro' }),
    }));
  });

  it('shows an error state when checkout fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: 'plugin_unavailable' }) }));
    render(<BuyProButton product="elementor-to-divi5-pro" label="Get Pro" />);
    fireEvent.click(screen.getByRole('button', { name: /get pro/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeTruthy());
  });
});

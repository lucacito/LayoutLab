// tests/buy-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { BuyButton } from '@/components/BuyButton';

describe('BuyButton', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it('posts the checkout request and redirects to the returned url', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://stripe.test/cs_1' }) })) as any;
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    const { getByRole } = render(<BuyButton kind="pack" packId="pk1" label="Buy this pack" />);
    fireEvent.click(getByRole('button', { name: 'Buy this pack' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({ method: 'POST' })));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ kind: 'pack', packId: 'pk1' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/cs_1'));
  });
});

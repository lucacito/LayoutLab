import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { DownloadButton } from '@/components/DownloadButton';
import { BillingButton } from '@/components/BillingButton';

describe('DownloadButton', () => {
  it('links to the gated download endpoint', () => {
    const { container } = render(<DownloadButton layoutId="l1" slug="bold-saas-hero" />);
    expect(container.querySelector('a[href="/api/download/l1"]')).not.toBeNull();
  });
});

describe('BillingButton', () => {
  it('posts to the portal and redirects to the returned url', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://billing.test/p' }) })) as any;
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const { getByRole } = render(<BillingButton />);
    fireEvent.click(getByRole('button', { name: /manage billing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/billing/portal', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.test/p'));
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';

describe('WaitlistForm', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('POSTs email + source to /api/lead and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x@y.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));
    await waitFor(() => expect(screen.getByText(/on the list/i)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith('/api/lead', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'x@y.com', source: 'ai_editor_waitlist' }),
    }));
  });

  it('shows an error state when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    render(<WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x@y.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));
    await waitFor(() => expect(screen.getByText(/try again/i)).toBeTruthy());
  });
});

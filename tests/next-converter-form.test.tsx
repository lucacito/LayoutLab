// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextConverterForm, NEXT_CONVERTER_OPTIONS } from '@/components/marketing/NextConverterForm';

describe('NextConverterForm', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('will not submit until a builder is chosen', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<NextConverterForm />);
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'x@y.com' } });
    const button = screen.getByRole('button', { name: /cast my vote/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(button.closest('form')!);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs the builder as the lead source and confirms the vote', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<NextConverterForm />);
    fireEvent.click(screen.getByLabelText('Oxygen'));
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'x@y.com' } });
    fireEvent.click(screen.getByRole('button', { name: /cast my vote/i }));
    await waitFor(() => expect(screen.getByText(/vote counted for oxygen/i)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith('/api/lead', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'x@y.com', source: 'next_converter_oxygen' }),
    }));
  });

  it('shows an error state when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    render(<NextConverterForm />);
    fireEvent.click(screen.getByLabelText('Bricks'));
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'x@y.com' } });
    fireEvent.click(screen.getByRole('button', { name: /cast my vote/i }));
    await waitFor(() => expect(screen.getByText(/try again/i)).toBeTruthy());
  });
  it('never offers a builder that already has a converter', () => {
    render(<NextConverterForm />);
    for (const shipped of ['WPBakery', 'Elementor', 'Beaver Builder']) {
      expect(screen.queryByLabelText(shipped)).toBeNull();
    }
    const keys = NEXT_CONVERTER_OPTIONS.map((o) => o.key);
    expect(keys).not.toContain('wpbakery');
    expect(keys).toContain('bricks');
  });
});

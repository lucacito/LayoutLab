import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ServicesFreeBand } from '@/components/services/ServicesFreeBand';

describe('ServicesFreeBand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the heading, email input and free-library link', () => {
    const { getByText, getByPlaceholderText } = render(<ServicesFreeBand />);
    expect(getByText(/free Divi 5 layouts/i)).toBeTruthy();
    expect(getByPlaceholderText('you@email.com')).toBeTruthy();
    expect(getByText('Browse the free library').closest('a')?.getAttribute('href')).toBe('/free-divi-layouts');
  });

  it('posts the email to /api/lead and shows a confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { getByPlaceholderText, getByText, findByText } = render(<ServicesFreeBand />);
    fireEvent.change(getByPlaceholderText('you@email.com'), { target: { value: 'diy@example.com' } });
    fireEvent.click(getByText('Send me layouts'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/lead');
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({ email: 'diy@example.com', source: 'homepage_free_band' });
    expect(await findByText(/Check your inbox/i)).toBeTruthy();
  });
});

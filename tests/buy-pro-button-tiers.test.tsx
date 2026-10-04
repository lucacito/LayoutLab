// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BuyProButton } from '@/components/plugins/BuyProButton';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});

const bodyOf = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe('BuyProButton', () => {
  it('posts the product, tier and trial flag for a trial', async () => {
    render(<BuyProButton product="ai-editor-divi5-pro" tier="personal" trial label="Start" />);
    fireEvent.click(screen.getByText('Start'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf()).toEqual({ kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'personal', trial: true });
  });

  it('a paid tier purchase sends no trial flag', async () => {
    render(<BuyProButton product="ai-editor-divi5-pro" tier="agency" label="Buy" />);
    fireEvent.click(screen.getByText('Buy'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf()).toEqual({ kind: 'plugin', product: 'ai-editor-divi5-pro', tier: 'agency' });
  });

  it('lifetime sends lifetime and no tier', async () => {
    render(<BuyProButton product="ai-editor-divi5-pro" lifetime label="Life" />);
    fireEvent.click(screen.getByText('Life'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf()).toEqual({ kind: 'plugin', product: 'ai-editor-divi5-pro', lifetime: true });
  });

  it('a converter button posts only the product', async () => {
    render(<BuyProButton product="wpbakery-to-divi5-pro" label="Get" />);
    fireEvent.click(screen.getByText('Get'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf()).toEqual({ kind: 'plugin', product: 'wpbakery-to-divi5-pro' });
  });
});

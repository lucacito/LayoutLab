// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';

const STEPS: ChatStep[] = [
  { role: 'user', text: 'Center the hero button on Home.' },
  { role: 'assistant', text: 'Calling update_page_layout…' },
  { role: 'validator-pass', text: 'Valid — saved to "Home".' },
];

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduced, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }));
}

afterEach(() => vi.useRealTimers());

describe('ValidatorChatDemo', () => {
  it('renders all steps immediately under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    render(<ValidatorChatDemo steps={STEPS} />);
    expect(screen.getByText(/saved to/i)).toBeTruthy();
  });
  it('renders all steps immediately when matchMedia is unavailable (jsdom default)', () => {
    // @ts-expect-error simulate environments without matchMedia
    delete window.matchMedia;
    render(<ValidatorChatDemo steps={STEPS} />);
    expect(screen.getByText(/saved to/i)).toBeTruthy();
  });
  it('reveals steps over time when motion is allowed', () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    render(<ValidatorChatDemo steps={STEPS} />);
    expect(screen.getByText(/center the hero button/i)).toBeTruthy();
    expect(screen.queryByText(/saved to/i)).toBeNull();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText(/saved to/i)).toBeTruthy();
  });
});

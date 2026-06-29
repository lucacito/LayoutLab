// tests/free-download-gate.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@/lib/capture/download-actions', () => ({ captureAndDownloadAction: vi.fn() }));
import { FreeDownloadGate } from '@/components/FreeDownloadGate';

describe('FreeDownloadGate', () => {
  it('shows a direct download link when captured', () => {
    const { container } = render(<FreeDownloadGate layoutId="l1" slug="bold-saas-hero" captured />);
    expect(container.querySelector('a[href="/api/download/l1"]')).not.toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });
  it('shows an email form when not captured', () => {
    const { container, getByRole } = render(<FreeDownloadGate layoutId="l1" slug="bold-saas-hero" captured={false} />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(getByRole('button')).toBeTruthy();
  });
});

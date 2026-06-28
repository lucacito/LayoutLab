import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/capture/actions', () => ({ captureFreePackAction: vi.fn() }));

import { FreePackForm } from '@/components/FreePackForm';

describe('FreePackForm', () => {
  it('renders an email input and a submit button', () => {
    const { container, getByRole } = render(<FreePackForm packId="p1" />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(getByRole('button')).toBeTruthy();
  });
});

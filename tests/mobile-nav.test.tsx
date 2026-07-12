import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const useSession = vi.fn();
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }));

import { MobileNav } from '@/components/site/MobileNav';

describe('MobileNav', () => {
  it('opens to show the plugins-first nav links and the Get Pro CTA', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { getByLabelText, getByText, queryByText } = render(<MobileNav />);
    fireEvent.click(getByLabelText('Toggle menu'));
    expect(getByText('Plugins').closest('a')?.getAttribute('href')).toBe('/plugins');
    expect(getByText('Free layouts').closest('a')?.getAttribute('href')).toBe('/free-divi-layouts');
    expect(getByText('Browse').closest('a')?.getAttribute('href')).toBe('/browse');
    expect(getByText('Guides').closest('a')?.getAttribute('href')).toBe('/guides');
    expect(getByText('Get Pro').closest('a')?.getAttribute('href')).toBe('/pricing');
    expect(getByText('Sign in')).toBeTruthy();
    expect(queryByText('Work with us')).toBeNull();
    expect(queryByText('Get a free quote')).toBeNull();
  });
});

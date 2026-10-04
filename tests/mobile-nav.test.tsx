import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const useSession = vi.fn();
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }));

import { MobileNav } from '@/components/site/MobileNav';

describe('MobileNav', () => {
  it('opens to show the top-level nav (Free layouts → /browse, no standalone Browse) and Get Pro', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { getByLabelText, getByText, queryByText } = render(<MobileNav />);
    fireEvent.click(getByLabelText('Toggle menu'));
    expect(getByText('Plugins').closest('a')?.getAttribute('href')).toBe('/plugins');
    expect(getByText('Free layouts').closest('a')?.getAttribute('href')).toBe('/browse');
    expect(getByText('Guides').closest('a')?.getAttribute('href')).toBe('/guides');
    expect(getByText('Get Pro').closest('a')?.getAttribute('href')).toBe('/pricing');
    expect(getByText('Sign in')).toBeTruthy();
    // No standalone "Browse" top-level link.
    expect(queryByText('Browse')).toBeNull();
  });

  it('expands the Free layouts submenu to reveal taxonomy links', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { getByLabelText, getByText, queryByText } = render(<MobileNav />);
    fireEvent.click(getByLabelText('Toggle menu'));
    // Submenu collapsed initially.
    expect(queryByText('Hero sections')).toBeNull();
    fireEvent.click(getByLabelText('Toggle Free layouts submenu'));
    expect(getByText('Hero sections').closest('a')?.getAttribute('href')).toBe('/type/hero');
    expect(getByText('Browse all layouts').closest('a')?.getAttribute('href')).toBe('/browse');
  });
});

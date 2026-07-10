import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const useSession = vi.fn();
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }));

import { MobileNav } from '@/components/site/MobileNav';

describe('MobileNav', () => {
  it('opens to show the funnel links and the quote CTA', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { getByLabelText, getByText } = render(<MobileNav />);
    fireEvent.click(getByLabelText('Toggle menu'));
    expect(getByText('Work with us').closest('a')?.getAttribute('href')).toBe('/contact');
    expect(getByText('Examples').closest('a')?.getAttribute('href')).toBe('/browse');
    expect(getByText('Free Divi layouts').closest('a')?.getAttribute('href')).toBe('/free-divi-layouts');
    expect(getByText('Get a free quote')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const useSession = vi.fn();
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }));

import { AccountNav } from '@/components/site/AccountNav';

describe('AccountNav', () => {
  it('shows Sign in when logged out', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { getByText, queryByText } = render(<AccountNav />);
    expect(getByText('Sign in')).toBeTruthy();
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Account')).toBeNull();
  });
  it('shows Account (no Admin) for a signed-in non-admin', () => {
    useSession.mockReturnValue({ data: { user: { email: 'u@x.com', role: 'user' } }, status: 'authenticated' });
    const { getByText, queryByText } = render(<AccountNav />);
    expect(getByText('Account')).toBeTruthy();
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Sign in')).toBeNull();
  });
  it('shows Admin + Account for an admin', () => {
    useSession.mockReturnValue({ data: { user: { email: 'a@x.com', role: 'admin' } }, status: 'authenticated' });
    const { getByText } = render(<AccountNav />);
    expect(getByText('Admin')).toBeTruthy();
    expect(getByText('Account')).toBeTruthy();
  });
});

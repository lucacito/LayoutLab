import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }));

import LoginPage from '@/app/(account)/login/page';
import VerifyRequestPage from '@/app/(account)/verify-request/page';
import { render } from '@testing-library/react';

describe('LoginPage', () => {
  it('renders an email-only magic-link form (no password field)', () => {
    const { container, getByText } = render(<LoginPage />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(getByText(/sign in|email me a link|magic link/i)).toBeTruthy();
  });
});

describe('VerifyRequestPage', () => {
  it('tells the user to check their email', () => {
    const { getByText } = render(<VerifyRequestPage />);
    expect(getByText(/check your email/i)).toBeTruthy();
  });
});

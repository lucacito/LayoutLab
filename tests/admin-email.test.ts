// tests/admin-email.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail } from '@/lib/auth/config';

describe('isAdminEmail', () => {
  const prev = process.env.ADMIN_EMAILS;
  beforeEach(() => { process.env.ADMIN_EMAILS = 'Admin@Divi5lab.com, boss@x.io'; });
  afterEach(() => { process.env.ADMIN_EMAILS = prev; });

  it('matches an allowlisted email case-insensitively', () => {
    expect(isAdminEmail('admin@divi5lab.com')).toBe(true);
    expect(isAdminEmail('BOSS@X.IO')).toBe(true);
  });
  it('rejects non-listed, empty, and nullish emails', () => {
    expect(isAdminEmail('nobody@x.io')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
  it('returns false when the allowlist is unset/empty', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminEmail('admin@divi5lab.com')).toBe(false);
  });
});

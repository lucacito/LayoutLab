import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/lib/env';

const valid = {
  NEXT_PUBLIC_SITE_URL: 'https://divi5lab.com',
  DATABASE_URL: 'postgres://u:p@host/db',
  AUTH_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
};

describe('parseEnv', () => {
  it('parses a valid env and exposes the site url', () => {
    const env = parseEnv(valid);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://divi5lab.com');
  });

  it('throws when a required var is missing', () => {
    const { DATABASE_URL, ...missing } = valid;
    expect(() => parseEnv(missing)).toThrow();
  });
});

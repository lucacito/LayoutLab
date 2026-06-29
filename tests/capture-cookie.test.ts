import { describe, it, expect } from 'vitest';
import { signCapture, verifyCapture } from '@/lib/capture/cookie';

const SECRET = 'test-secret-test-secret-32chars!!';

describe('capture cookie signing', () => {
  it('round-trips the email', () => {
    const signed = signCapture('Buyer@Example.com', SECRET);
    expect(verifyCapture(signed, SECRET)).toBe('Buyer@Example.com');
  });
  it('rejects a tampered payload', () => {
    const signed = signCapture('a@b.com', SECRET);
    const tampered = 'ZXZpbEBiLmNvbQ.' + signed.split('.')[1];
    expect(verifyCapture(tampered, SECRET)).toBeNull();
  });
  it('rejects a foreign-secret signature and empty/garbage', () => {
    const signed = signCapture('a@b.com', SECRET);
    expect(verifyCapture(signed, 'other-secret')).toBeNull();
    expect(verifyCapture(null, SECRET)).toBeNull();
    expect(verifyCapture('nodot', SECRET)).toBeNull();
  });
});

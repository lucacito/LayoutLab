import { describe, it, expect } from 'vitest';
import { formatPriceCents } from '@/lib/format/price';

describe('formatPriceCents', () => {
  it('shows whole dollars without decimals', () => {
    expect(formatPriceCents(4900)).toBe('$49');
    expect(formatPriceCents(3900)).toBe('$39');
  });
  it('shows cents for non-round amounts', () => {
    expect(formatPriceCents(25)).toBe('$0.25');
    expect(formatPriceCents(1250)).toBe('$12.50');
    expect(formatPriceCents(99)).toBe('$0.99');
  });
  it('handles zero and null-ish', () => {
    expect(formatPriceCents(0)).toBe('$0');
  });
});

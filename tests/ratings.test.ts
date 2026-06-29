import { describe, it, expect } from 'vitest';
import { clampStars, ratingAverage } from '@/lib/ratings/compute';

describe('rating math', () => {
  it('clampStars rounds and bounds to 1..5 (0 for non-numbers)', () => {
    expect(clampStars(3)).toBe(3);
    expect(clampStars(0)).toBe(1);
    expect(clampStars(9)).toBe(5);
    expect(clampStars(4.6)).toBe(5);
    expect(clampStars('nope')).toBe(0);
  });

  it('ratingAverage rounds to one decimal and is 0 with no ratings', () => {
    expect(ratingAverage(0, 0)).toBe(0);
    expect(ratingAverage(9, 2)).toBe(4.5);
    expect(ratingAverage(10, 3)).toBe(3.3);
  });
});

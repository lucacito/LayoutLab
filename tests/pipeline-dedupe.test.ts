import { describe, it, expect, afterEach } from 'vitest';
import { contentHash, hammingDistance, isNearDuplicate, perceptualDupeMaxDistance } from '@/pipeline/dedupe';

describe('contentHash', () => {
  it('is stable across key order and whitespace', () => {
    const a = '{"x":1,"y":[1,2],"z":{"b":2,"a":1}}';
    const b = '{\n  "y": [1, 2],\n  "z": { "a": 1, "b": 2 },\n  "x": 1\n}';
    expect(contentHash(a)).toBe(contentHash(b));
  });
  it('differs when content differs', () => {
    expect(contentHash('{"x":1}')).not.toBe(contentHash('{"x":2}'));
  });
  it('returns a 64-char hex sha256', () => {
    expect(contentHash('{"x":1}')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hammingDistance', () => {
  it('is 0 for identical hex strings', () => {
    expect(hammingDistance('ff00ff00', 'ff00ff00')).toBe(0);
  });
  it('counts differing bits across the whole string, not just differing chars', () => {
    // '0' = 0000, '1' = 0001 -> 1 bit differs
    expect(hammingDistance('0', '1')).toBe(1);
    // 'f' = 1111, '0' = 0000 -> 4 bits differ
    expect(hammingDistance('f', '0')).toBe(4);
  });
  it('sums nibble distances across a longer string', () => {
    // 'ff' vs '00' = 8 bits differ; last nibble pair 'ff' vs 'ff' = 0 -> total 8
    expect(hammingDistance('ffff', '00ff')).toBe(8);
    // all 4 nibble pairs differ maximally: 4 * 4 bits = 16
    expect(hammingDistance('ffff', '0000')).toBe(16);
  });
  it('is symmetric', () => {
    expect(hammingDistance('a1b2', 'c3d4')).toBe(hammingDistance('c3d4', 'a1b2'));
  });
  it('throws on mismatched lengths', () => {
    expect(() => hammingDistance('ab', 'abc')).toThrow();
  });
});

describe('isNearDuplicate', () => {
  const base = 'f'.repeat(64);
  it('flags a hash within the threshold against an existing pool', () => {
    // flip 2 bits (well under a threshold of 5)
    const close = '7' + 'f'.repeat(63); // 'f'=1111 vs '7'=0111 -> 1 bit
    expect(isNearDuplicate(close, [base], 5)).toBe(true);
  });
  it('does not flag a hash over the threshold', () => {
    const far = '0'.repeat(64); // maximally different from all-f
    expect(isNearDuplicate(far, [base], 5)).toBe(false);
  });
  it('flags exactly at the threshold (<=), not just strictly under', () => {
    // '0'=0000 vs 'f'=1111 differs by 4 bits per swapped nibble; swap one nibble = distance 4
    const atFour = '0' + 'f'.repeat(63);
    expect(isNearDuplicate(atFour, [base], 4)).toBe(true);
  });
  it('returns false against an empty pool', () => {
    expect(isNearDuplicate(base, [], 5)).toBe(false);
  });
  it('skips comparisons against hashes of a different length rather than throwing', () => {
    expect(() => isNearDuplicate(base, ['abcd'], 5)).not.toThrow();
    expect(isNearDuplicate(base, ['abcd'], 5)).toBe(false);
  });
});

describe('perceptualDupeMaxDistance', () => {
  const ORIGINAL = process.env.PERCEPTUAL_DUPE_MAX_DISTANCE;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PERCEPTUAL_DUPE_MAX_DISTANCE;
    else process.env.PERCEPTUAL_DUPE_MAX_DISTANCE = ORIGINAL;
  });
  it('defaults to 20 when unset', () => {
    delete process.env.PERCEPTUAL_DUPE_MAX_DISTANCE;
    expect(perceptualDupeMaxDistance()).toBe(20);
  });
  it('reads a tuned value from env', () => {
    process.env.PERCEPTUAL_DUPE_MAX_DISTANCE = '10';
    expect(perceptualDupeMaxDistance()).toBe(10);
  });
  it('falls back to the default on garbage input', () => {
    process.env.PERCEPTUAL_DUPE_MAX_DISTANCE = 'not-a-number';
    expect(perceptualDupeMaxDistance()).toBe(20);
  });
});

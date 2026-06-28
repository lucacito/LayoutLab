import { describe, it, expect } from 'vitest';
import { contentHash } from '@/pipeline/dedupe';

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

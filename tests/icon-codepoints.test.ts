import { describe, expect, it } from 'vitest';
import codepoints from '@/pipeline/recipes/divi-icon-codepoints.json';

const HEX = /^[0-9a-f]{2,6}$/;

describe('divi-icon-codepoints.json (checked-in cmap ground truth)', () => {
  it('has the three font buckets, non-empty', () => {
    for (const key of ['divi', 'fa-solid-900', 'fa-regular-400'] as const) {
      expect(Array.isArray(codepoints[key]), key).toBe(true);
      expect(codepoints[key].length, key).toBeGreaterThan(50);
    }
  });

  it('every codepoint is lowercase bare hex, sorted, deduped', () => {
    for (const key of ['divi', 'fa-solid-900', 'fa-regular-400'] as const) {
      const arr = codepoints[key] as string[];
      for (const c of arr) expect(c, `${key}:${c}`).toMatch(HEX);
      const sorted = [...arr].sort();
      expect(arr).toEqual(sorted);
      expect(new Set(arr).size).toBe(arr.length);
    }
  });

  it('contains glyphs already observed in the validator recipes / D5 corpus (sanity anchors)', () => {
    // divi: e007/e090 appear in the D5 exemplar corpus; fa: f00c (check) and
    // f015 (home) are canonical FA-solid codes; f004 (heart) exists in FA regular.
    expect(codepoints['divi']).toContain('e007');
    expect(codepoints['divi']).toContain('e090');
    expect(codepoints['fa-solid-900']).toContain('f00c');
    expect(codepoints['fa-solid-900']).toContain('f015');
    expect(codepoints['fa-regular-400']).toContain('f004');
  });
});

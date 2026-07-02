import { describe, it, expect } from 'vitest';
import { assembleSections } from '@/pipeline/compose/assemble';

const PH_OPEN = '<!-- wp:divi/placeholder -->';
const PH_CLOSE = '<!-- /wp:divi/placeholder -->';
const sec = (n: number) => `<!-- wp:divi/section {"a":{"b":${n}}} -->S${n}<!-- /wp:divi/section -->`;

describe('assembleSections', () => {
  it('wraps N sections in exactly one placeholder wrapper, in order', () => {
    const inputs = [PH_OPEN + sec(1) + PH_CLOSE, PH_OPEN + sec(2) + PH_CLOSE, PH_OPEN + sec(3) + PH_CLOSE];
    const out = assembleSections(inputs);
    expect(out.match(/wp:divi\/placeholder -->/g)!.length).toBe(2); // one open + one close
    expect(out.startsWith(PH_OPEN)).toBe(true);
    expect(out.endsWith(PH_CLOSE)).toBe(true);
    expect(out.indexOf('S1')).toBeLessThan(out.indexOf('S2'));
    expect(out.indexOf('S2')).toBeLessThan(out.indexOf('S3'));
    expect((out.match(/wp:divi\/section {/g) || []).length).toBe(3);
  });
  it('handles sections that arrive without a placeholder wrapper', () => {
    const out = assembleSections([sec(1), PH_OPEN + sec(2) + PH_CLOSE]);
    expect(out).toBe(PH_OPEN + sec(1) + sec(2) + PH_CLOSE);
  });
});

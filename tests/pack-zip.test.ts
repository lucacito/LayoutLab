import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildPackZip } from '@/lib/download/zip';

describe('buildPackZip', () => {
  it('zips each layout JSON + one LICENSE.txt', async () => {
    const buf = await buildPackZip([{ slug: 'a-hero', json: '{"a":1}' }, { slug: 'b-pricing', json: '{"b":2}' }], 'LICENSE BODY');
    const zip = await JSZip.loadAsync(buf);
    expect(await zip.file('a-hero.json')!.async('string')).toBe('{"a":1}');
    expect(await zip.file('b-pricing.json')!.async('string')).toBe('{"b":2}');
    expect(await zip.file('LICENSE.txt')!.async('string')).toBe('LICENSE BODY');
  });
});

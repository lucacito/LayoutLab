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

describe('buildPackZip import notes', () => {
  it('adds HOW-TO-IMPORT.txt only when notes are given', async () => {
    const JSZip = (await import('jszip')).default;
    const { buildPackZip, PORTABLE_NOTES } = await import('@/lib/download/zip');
    const plain = await JSZip.loadAsync(await buildPackZip([{ slug: 'a', json: '{}' }], 'L'));
    expect(Object.keys(plain.files).sort()).toEqual(['LICENSE.txt', 'a.json']);
    const withNotes = await JSZip.loadAsync(await buildPackZip([{ slug: 'a', json: '{}' }], 'L', PORTABLE_NOTES));
    expect(Object.keys(withNotes.files)).toContain('HOW-TO-IMPORT.txt');
    expect(await withNotes.file('HOW-TO-IMPORT.txt')!.async('string')).toContain('Include global presets');
  });
});

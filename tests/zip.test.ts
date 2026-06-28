import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildLayoutZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';

describe('readLicense', () => {
  it('returns the committed commercial license text', () => {
    const txt = readLicense();
    expect(txt).toContain('COMMERCIAL LICENSE AGREEMENT');
    expect(txt).toContain('Not allowed:');
  });
});

describe('buildLayoutZip', () => {
  it('produces a zip with <slug>.json and LICENSE.txt', async () => {
    const buf = await buildLayoutZip('{"content":[]}', 'bold-saas-hero', 'LICENSE BODY');
    const zip = await JSZip.loadAsync(buf);
    expect(zip.file('bold-saas-hero.json')).not.toBeNull();
    expect(zip.file('LICENSE.txt')).not.toBeNull();
    expect(await zip.file('bold-saas-hero.json')!.async('string')).toBe('{"content":[]}');
    expect(await zip.file('LICENSE.txt')!.async('string')).toBe('LICENSE BODY');
  });
});

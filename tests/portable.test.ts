import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ fetchAsset: vi.fn(async (_k: string): Promise<Buffer | null> => null) }));
vi.mock('@/lib/blob', () => ({ fetchAsset: h.fetchAsset }));

import { portableUrl, isSoundPortable, diviFileFor } from '@/lib/download/portable';

const HASH = 'a5473a42a5af0123456789abcdef0123456789abcdef0123456789abcdef0123';
const KEY = `https://store123.public.blob.vercel-storage.com/layouts/${HASH}/x.json`;
const bare = JSON.stringify({ post_title: 'Kiln Home', post_content: '<!-- wp:divi/section {} /-->' });
const portable = JSON.stringify({
  context: 'et_builder',
  data: { '1': { post_title: 'Kiln Home', post_content: '<!-- wp:divi/section {"modulePreset":["p1"]} /-->' } },
  presets: { module: { 'divi/text': { default: '', items: { p1: { id: 'p1', name: 'Kiln Body' } } } }, group: [] },
  global_colors: [['gcid-kiln-text', { color: '#2b2622', label: 'Kiln & Clay Text', status: 'active' }]],
});

beforeEach(() => h.fetchAsset.mockReset().mockResolvedValue(null));

describe('portableUrl', () => {
  it('sits in the same Blob store as the layout, under the content hash', () => {
    expect(portableUrl(KEY, HASH)).toBe(`https://store123.public.blob.vercel-storage.com/portable/${HASH}.json`);
  });
  it('is null without a usable hash or a https layout URL', () => {
    expect(portableUrl(KEY, null)).toBeNull();
    expect(portableUrl(KEY, '../../etc')).toBeNull();
    expect(portableUrl('pipeline/out/x.json', HASH)).toBeNull();
    expect(portableUrl('http://insecure.test/x.json', HASH)).toBeNull();
  });
});

describe('isSoundPortable', () => {
  it('accepts a file Divi will import', () => expect(isSoundPortable(portable)).toBe(true));
  it('rejects anything else', () => {
    for (const s of ['not json', '[]', 'null', bare, '{"context":"et_builder"}', '{"context":"et_builder","data":{}}', '{"context":"et_builder","data":{"1":{"post_content":""}}}', '{"context":"x","data":{"1":{"post_content":"a"}}}'])
      expect(isSoundPortable(s)).toBe(false);
  });
});

describe('diviFileFor', () => {
  it('serves the published file, with colors and presets, when there is one', async () => {
    h.fetchAsset.mockResolvedValue(Buffer.from(portable));
    const out = await diviFileFor({ diviJsonBlobKey: KEY, contentHash: HASH }, bare);
    expect(out).toEqual({ json: portable, portable: true });
    expect(h.fetchAsset).toHaveBeenCalledWith(`https://store123.public.blob.vercel-storage.com/portable/${HASH}.json`);
  });
  it('falls back to the plain wrapped layout when none is published', async () => {
    const out = await diviFileFor({ diviJsonBlobKey: KEY, contentHash: HASH }, bare);
    expect(out.portable).toBe(false);
    expect(JSON.parse(out.json)).toMatchObject({ context: 'et_builder', presets: '', global_colors: '' });
  });
  it('falls back when the published file is not sound', async () => {
    h.fetchAsset.mockResolvedValue(Buffer.from('<html>oops</html>'));
    expect((await diviFileFor({ diviJsonBlobKey: KEY, contentHash: HASH }, bare)).portable).toBe(false);
  });
  it('does not look anything up without a content hash', async () => {
    await diviFileFor({ diviJsonBlobKey: KEY }, bare);
    expect(h.fetchAsset).not.toHaveBeenCalled();
  });
});

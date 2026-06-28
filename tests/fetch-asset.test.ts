import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchAsset } from '@/lib/blob';

afterEach(() => vi.unstubAllGlobals());

describe('fetchAsset', () => {
  it('reads a local file path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'asset-'));
    const file = join(dir, 'layout.json');
    writeFileSync(file, '{"x":1}');
    const buf = await fetchAsset(file);
    expect(buf?.toString('utf8')).toBe('{"x":1}');
    rmSync(dir, { recursive: true, force: true });
  });
  it('returns null for a missing local path', async () => {
    expect(await fetchAsset('/no/such/file.json')).toBeNull();
  });
  it('fetches an absolute URL and returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })) as any);
    expect(await fetchAsset('https://example.com/x.json')).toBeNull();
  });
  it('returns the bytes for an ok URL response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('hi').buffer })) as any);
    expect((await fetchAsset('https://example.com/x.json'))?.toString('utf8')).toBe('hi');
  });
});

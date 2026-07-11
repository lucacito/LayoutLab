// Publish a Pro plugin release: zip the plugin dir, upload to Blob, insert a
// plugin_releases row. Shipping an update never requires a site deploy.
// Usage: npx tsx scripts/release-plugin.ts --product elementor-to-divi5-pro --version 1.0.0 --dir ../jhmg-elementor-to-divi5/plugin/jhmg-converter-elementor-to-divi5-pro --changelog "Initial Pro release"
import { randomBytes, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import JSZip from 'jszip';
import { PLUGIN_PRODUCTS } from '@/lib/license-server/core';
import { uploadAsset } from '@/lib/blob';
import { db } from '@/db/client';
import { pluginReleases } from '@/db/schema';

export function blobKeyFor(product: string, version: string, nonce: string): string {
  return `plugins/${product}/${nonce}/${product}-${version}.zip`;
}

export async function buildZipFromDir(dir: string): Promise<Buffer> {
  const zip = new JSZip();
  const root = basename(dir);
  const walk = (abs: string, rel: string) => {
    for (const entry of readdirSync(abs)) {
      const absPath = join(abs, entry);
      const relPath = `${rel}/${entry}`;
      if (statSync(absPath).isDirectory()) walk(absPath, relPath);
      else zip.file(relPath, readFileSync(absPath));
    }
  };
  walk(dir, root);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const product = arg('product'); const version = arg('version');
  const dir = arg('dir'); const changelog = arg('changelog') ?? '';
  if (!product || !version || !dir) {
    console.error('Usage: --product <slug> --version <x.y.z> --dir <plugin-folder> [--changelog "..."]');
    process.exit(1);
  }
  if (!(PLUGIN_PRODUCTS as readonly string[]).includes(product)) {
    console.error(`Unknown product ${product}. Expected one of: ${PLUGIN_PRODUCTS.join(', ')}`);
    process.exit(1);
  }
  const buf = await buildZipFromDir(dir);
  // Blobs are public and uploaded with addRandomSuffix: false, so the path
  // itself must be unguessable — a predictable path would let anyone fetch
  // the paid zip directly, bypassing the license gate.
  const nonce = randomBytes(12).toString('hex');
  const key = blobKeyFor(product, version, nonce);
  const { url } = await uploadAsset(key, buf, 'application/zip');
  // Store the returned absolute URL, not the bare key: fetchAsset/assetUrl
  // resolve bare keys against a generic https://blob.vercel-storage.com/
  // base that does not serve store files. The real URL is store-specific
  // (https://<store>.public.blob.vercel-storage.com/...), which is exactly
  // what uploadAsset returns (see pipeline/upload.ts for the same convention).
  await db.insert(pluginReleases).values({
    id: randomUUID(), productSlug: product, version, blobKey: url, changelog,
  });
  console.log(`Released ${product} ${version} -> ${key} -> ${url} (${(buf.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1]?.endsWith('release-plugin.ts')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

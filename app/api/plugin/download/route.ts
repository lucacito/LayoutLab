// Key-authenticated Pro zip download: used by the WP updater's `package` URL
// and by the "Download Pro" button on /account/licenses.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { fetchAsset } from '@/lib/blob';
import { isLicenseUsable } from '@/lib/license-server/core';
import { dbLicenseStore } from '@/lib/license-server/store';

const querySchema = z.object({
  product: z.string().min(1).max(100),
  key: z.string().min(10).max(64),
});

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`plugin-download:${ip}`, { limit: 20, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    product: url.searchParams.get('product') ?? undefined,
    key: url.searchParams.get('key') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { product, key } = parsed.data;

  const license = await dbLicenseStore.findByKey(key);
  if (!license) return NextResponse.json({ error: 'invalid_key' }, { status: 404 });
  if (license.productSlug !== product) return NextResponse.json({ error: 'product_mismatch' }, { status: 403 });
  if (!isLicenseUsable(license, new Date())) {
    return NextResponse.json({ error: 'license_not_usable' }, { status: 403 });
  }

  const release = await dbLicenseStore.latestRelease(product);
  if (!release) return NextResponse.json({ error: 'no_release' }, { status: 404 });
  const bytes = await fetchAsset(release.blobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_missing' }, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${product}-${release.version}.zip"`,
      'cache-control': 'private, no-store',
    },
  });
}

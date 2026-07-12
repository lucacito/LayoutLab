import { NextResponse } from 'next/server';
import { dbLicenseStore } from '@/lib/license-server/store';
import { freeDownloadTarget } from '@/lib/license-server/free-download';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`free-dl:${ip}`, { limit: 10, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const product = new URL(req.url).searchParams.get('product') ?? '';
  const target = await freeDownloadTarget(product, (p) => dbLicenseStore.latestRelease(p));
  if (!target.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(target.url, 302);
}

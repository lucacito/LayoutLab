import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/admin';
import {
  getUserIdByEmail,
  getEntitlementsForUser,
  getPackForDownload,
  getPackLayoutsForDownload,
  recordDownload,
} from '@/lib/account/queries';
import { canDownloadPack } from '@/lib/stripe/entitlements';
import { fetchAsset } from '@/lib/blob';
import { buildPackZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ packId: string }> },
): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`dl-pack:${ip}`, { limit: 40, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const session = await requireUser();
  const { packId } = await params;

  const pack = await getPackForDownload(packId);
  if (!pack) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const email = session.user?.email ?? null;
  const userId = email ? await getUserIdByEmail(email) : null;
  const userEntitlements = userId ? await getEntitlementsForUser(userId) : [];

  if (!canDownloadPack({ packId, userEntitlements })) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await getPackLayoutsForDownload(packId);
  const items: { id: string; slug: string; json: string }[] = [];
  for (const r of rows) {
    const bytes = await fetchAsset(r.diviJsonBlobKey);
    if (bytes) items.push({ id: r.id, slug: r.slug, json: bytes.toString('utf8') });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });
  }

  const zip = await buildPackZip(items, readLicense());
  // Best-effort audit — a logging failure must never break a paid pack download.
  try {
    for (const it of items) await recordDownload(userId, it.id, ip);
  } catch (err) {
    console.error('[download/pack] recordDownload failed (non-fatal):', (err as Error).message);
  }

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${pack.slug}.zip"`,
    },
  });
}

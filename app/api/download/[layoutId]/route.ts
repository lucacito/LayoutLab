import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readCaptureEmail } from '@/lib/capture/cookie';
import {
  getLayoutForDownload,
  getLayoutPackContext,
  getEntitlementsForUser,
  getUserIdByEmail,
  recordDownload,
} from '@/lib/account/queries';
import { canDownloadLayout, isPaidOnlyLayout } from '@/lib/stripe/entitlements';
import { fetchAsset } from '@/lib/blob';
import { toDiviPortability } from '@/lib/download/portability';
import { buildLayoutZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';
import { rateLimit } from '@/lib/rate-limit';
import { notifyDownload } from '@/lib/notify/download';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ layoutId: string }> }): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`dl:${ip}`, { limit: 40, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { layoutId } = await params;
  const layout = await getLayoutForDownload(layoutId);
  if (!layout) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const capturedEmail = await readCaptureEmail();
  const session = await auth();
  const sessionEmail = session?.user?.email ?? null;
  const userId = sessionEmail ? await getUserIdByEmail(sessionEmail) : null;

  // A layout that lives only inside paid pack(s) is sold with the pack, not a free lead magnet: a captured
  // email is not enough. It needs a real entitlement of a SIGNED-IN user (ownership of a pack it belongs to, or
  // active all-access). Layouts in no pack, or in at least one free pack, only need a captured email or a session.
  const { packIds, packKindById } = await getLayoutPackContext(layout.id);
  if (isPaidOnlyLayout({ packIds, packKindById })) {
    const userEntitlements = userId ? await getEntitlementsForUser(userId) : [];
    if (!canDownloadLayout({ layoutPackIds: packIds, packKindById, userEntitlements })) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } else if (!(sessionEmail ?? capturedEmail)) {
    return NextResponse.json({ error: 'capture_required' }, { status: 403 });
  }

  const bytes = await fetchAsset(layout.diviJsonBlobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });
  const zip = await buildLayoutZip(toDiviPortability(bytes.toString('utf8')), layout.slug, readLicense());
  const downloaderEmail = sessionEmail ?? capturedEmail ?? null;
  // Audit + notification are BEST-EFFORT. A logging failure (e.g. a prod DB that
  // hasn't run the downloads.email migration) must never turn a valid download into a 500.
  try {
    await recordDownload(userId, layout.id, ip, downloaderEmail);
  } catch (err) {
    console.error('[download] recordDownload failed (non-fatal):', (err as Error).message);
  }
  try {
    await notifyDownload({ layoutTitle: layout.title, slug: layout.slug, downloader: downloaderEmail ?? 'guest', ip });
  } catch {
    /* best-effort: never break a download on a notification failure */
  }

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${layout.slug}.zip"`,
    },
  });
}

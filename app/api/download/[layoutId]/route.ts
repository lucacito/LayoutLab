import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readCaptureEmail } from '@/lib/capture/cookie';
import { getLayoutForDownload, getUserIdByEmail, recordDownload } from '@/lib/account/queries';
import { fetchAsset } from '@/lib/blob';
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

  // Individual layouts are free, gated by a captured email (cookie) or a session.
  const capturedEmail = await readCaptureEmail();
  const session = await auth();
  const sessionEmail = session?.user?.email ?? null;
  if (!capturedEmail && !sessionEmail) {
    return NextResponse.json({ error: 'email_required' }, { status: 403 });
  }

  const bytes = await fetchAsset(layout.diviJsonBlobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });

  const userId = sessionEmail ? await getUserIdByEmail(sessionEmail) : null;
  const zip = await buildLayoutZip(bytes.toString('utf8'), layout.slug, readLicense());
  const downloaderEmail = sessionEmail ?? capturedEmail ?? null;
  // Audit + notification are BEST-EFFORT — a logging failure (e.g. a prod DB that
  // hasn't run the downloads.email migration) must never turn a valid download into a 500.
  try {
    await recordDownload(userId, layout.id, ip, downloaderEmail);
  } catch (err) {
    console.error('[download] recordDownload failed (non-fatal):', (err as Error).message);
  }
  try {
    await notifyDownload({ layoutTitle: layout.title, slug: layout.slug, downloader: downloaderEmail ?? 'guest', ip });
  } catch {
    /* best-effort — never break a download on a notification failure */
  }

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${layout.slug}.zip"`,
    },
  });
}

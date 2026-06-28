import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/admin';
import {
  getUserIdByEmail,
  getLayoutForDownload,
  getLayoutPackContext,
  getEntitlementsForUser,
  recordDownload,
} from '@/lib/account/queries';
import { canDownloadLayout } from '@/lib/stripe/entitlements';
import { fetchAsset } from '@/lib/blob';
import { buildLayoutZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ layoutId: string }> },
): Promise<Response> {
  const session = await requireUser();
  const { layoutId } = await params;

  const layout = await getLayoutForDownload(layoutId);
  if (!layout) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const email = session.user?.email ?? null;
  const userId = email ? await getUserIdByEmail(email) : null;
  const ctx = await getLayoutPackContext(layout.id);
  const userEntitlements = userId ? await getEntitlementsForUser(userId) : [];

  const allowed = canDownloadLayout({
    layoutPackIds: ctx.packIds,
    packKindById: ctx.packKindById,
    userEntitlements,
  });
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const bytes = await fetchAsset(layout.diviJsonBlobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });

  const zip = await buildLayoutZip(bytes.toString('utf8'), layout.slug, readLicense());
  await recordDownload(userId, layout.id, req.headers.get('x-forwarded-for'));

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${layout.slug}.zip"`,
    },
  });
}

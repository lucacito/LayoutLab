import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail } from '@/lib/account/queries';
import { db } from '@/db/client';
import { licenses, licenseActivations } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { PRICING } from '@/lib/pricing/config';

const bodySchema = z.object({
  licenseId: z.string(),
  siteUrl: z.string(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await requireUser();

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { licenseId, siteUrl } = parsed.data;

  // Load the license and verify ownership
  const license = await db.select().from(licenses).where(eq(licenses.id, licenseId)).limit(1);
  if (!license[0]) return NextResponse.json({ error: 'license_not_found' }, { status: 404 });

  // Verify the signed-in user owns this licence (the session carries the email, as on the account pages)
  const email = session.user?.email;
  const userId = email ? await getUserIdByEmail(email) : null;
  if (!userId || license[0].userId !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Only works for tiered AI Editor licenses
  if (license[0].productSlug !== PRICING.product) {
    return NextResponse.json({ error: 'invalid_product' }, { status: 400 });
  }

  // Mark the site as deactivated
  try {
    const result = await db.update(licenseActivations)
      .set({ deactivatedAt: new Date() })
      .where(
        and(
          eq(licenseActivations.licenseId, licenseId),
          eq(licenseActivations.siteUrl, siteUrl),
          isNull(licenseActivations.deactivatedAt),
        ),
      )
      .returning({ id: licenseActivations.id });

    if (result.length === 0) {
      return NextResponse.json({ error: 'activation_not_found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[free-site] error:', err);
    return NextResponse.json({ error: 'deactivation_failed' }, { status: 500 });
  }
}

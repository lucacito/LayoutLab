import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordLeadCapture } from '@/lib/capture/lead';
import { setTasterCookie, TASTER_SLUG } from '@/lib/capture/taster';
import { getLayoutBySlug } from '@/lib/catalog/queries';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  source: z.string().max(40).optional(),
});

// Exit/scroll "taster" capture: record the lead (→ email_captures + Loops), then
// authorize a free download of the ONE designated premium page and return it so the
// UI can reveal the download. Never fails the capture just because the page lookup
// misses — the email is the primary goal.
export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`taster:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  await recordLeadCapture(parsed.data.email);
  await setTasterCookie(TASTER_SLUG);

  let layout: { id: string; slug: string; title: string } | null = null;
  try {
    const l = await getLayoutBySlug(TASTER_SLUG);
    if (l) layout = { id: l.id, slug: l.slug, title: l.title };
  } catch {
    /* best-effort — the lead + cookie are set regardless */
  }

  return NextResponse.json({ ok: true, layout });
}

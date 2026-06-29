import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { submitRating } from '@/lib/ratings/store';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Body = z.object({
  layoutId: z.string().min(1),
  raterId: z.string().min(8).max(64),
  stars: z.number().int().min(1).max(5),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`rating:${ip}`, { limit: 30, windowMs: 60_000 }).ok) {
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

  // Only allow rating real, published elements.
  const [layout] = await db
    .select({ id: layouts.id })
    .from(layouts)
    .where(and(eq(layouts.id, parsed.data.layoutId), eq(layouts.status, 'published')))
    .limit(1);
  if (!layout) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const session = await auth();
  const result = await submitRating({
    layoutId: parsed.data.layoutId,
    raterId: parsed.data.raterId,
    stars: parsed.data.stars,
    userId: session?.user?.id ?? null,
  });
  return NextResponse.json(result);
}

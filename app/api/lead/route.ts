import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordLeadCapture } from '@/lib/capture/lead';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  source: z.string().max(40).optional(),
});

// General email lead (exit-intent, newsletter) → email_captures + Loops.
export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`lead:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
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
  return NextResponse.json({ ok: true });
}

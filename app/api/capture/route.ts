import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureFreePack, CaptureError } from '@/lib/capture/capture';
import { captureDeps } from '@/lib/capture/store';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Body = z.object({
  // plain email-shape regex (zod v3 .email() rejects single-char TLDs like a@b.c); the magic link is the real verification
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  packId: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`capture:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  try {
    await captureFreePack(parsed.data, captureDeps);
  } catch (err) {
    if (err instanceof CaptureError) return NextResponse.json({ error: 'not_free' }, { status: 422 });
    throw err;
  }
  return NextResponse.json({ ok: true });
}

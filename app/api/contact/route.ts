import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendContactMessage } from '@/lib/site/contact';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  // plain email-shape regex (zod v3 .email() rejects single-char TLDs)
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`contact:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
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

  try {
    await sendContactMessage(parsed.data);
  } catch {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

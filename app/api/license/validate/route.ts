import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { handleValidate } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  site_url: z.string().min(1).max(500),
  product: z.string().min(1).max(100),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`license-validate:${ip}`, { limit: 60, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { key, site_url, product } = parsed.data;
  const result = await handleValidate({ key, siteUrl: site_url, product }, dbLicenseStore);
  return NextResponse.json(result.body, { status: result.status });
}

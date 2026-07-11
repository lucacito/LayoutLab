import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { handleUpdateCheck } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const querySchema = z.object({
  product: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  key: z.string().max(64).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`plugin-update-check:${ip}`, { limit: 60, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    product: url.searchParams.get('product') ?? undefined,
    version: url.searchParams.get('version') ?? undefined,
    key: url.searchParams.get('key') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const result = await handleUpdateCheck(parsed.data, dbLicenseStore, env.NEXT_PUBLIC_SITE_URL);
  return NextResponse.json(result.body, { status: result.status });
}

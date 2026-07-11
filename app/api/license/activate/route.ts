import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { handleActivate } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  site_url: z.string().min(1).max(500),
  product: z.string().min(1).max(100),
  plugin_version: z.string().max(20).optional(),
  wp_version: z.string().max(20).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`license-activate:${ip}`, { limit: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { key, site_url, product, plugin_version, wp_version } = parsed.data;
  const result = await handleActivate(
    { key, siteUrl: site_url, product, pluginVersion: plugin_version, wpVersion: wp_version },
    dbLicenseStore,
  );
  return NextResponse.json(result.body, { status: result.status });
}

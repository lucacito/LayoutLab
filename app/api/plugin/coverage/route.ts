import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sql, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { pluginCoverageReports } from '@/db/schema';
import { rateLimit } from '@/lib/rate-limit';
import { coveragePayloadSchema } from '@/lib/coverage/schema';

// Roughly 50x plausible honest volume at current install counts. Past it we
// accept and discard rather than erroring, so honest clients never see a
// failure and a bad actor can inflate noise but not the storage bill.
const DAILY_CAP = 5000;

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`plugin-coverage:${ip}`, { limit: 5, windowMs: 60 * 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = coveragePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pluginCoverageReports)
    .where(gte(pluginCoverageReports.receivedAt, since));

  if (count >= DAILY_CAP) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await db.insert(pluginCoverageReports).values({
    id: randomUUID(),
    product: parsed.data.product,
    widgetTypes: [...new Set(parsed.data.widget_types)],
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

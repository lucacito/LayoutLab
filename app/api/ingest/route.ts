import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { layouts, tags, layoutTags } from '@/db/schema';
import { parseIngestPayload, parseBearer } from '@/lib/ingest/schema';
import { resolveIngestStatus } from '@/lib/ingest/status';

export async function POST(req: Request): Promise<Response> {
  const expected = env.INGEST_API_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'ingest_not_configured' }, { status: 500 });
  }

  const token = parseBearer(req.headers.get('authorization'));
  if (!token || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 422 });
  }

  const parsed = parseIngestPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.errors }, { status: 422 });
  }
  const p = parsed.data;

  // Quality gate: never accept an un-validated layout. (CLAUDE.md §2.2)
  if (p.validatorPassed !== true) {
    return NextResponse.json({ error: 'not_validated' }, { status: 422 });
  }

  // Idempotent on content_hash. (CLAUDE.md §2.7)
  const existing = await db
    .select({ id: layouts.id, status: layouts.status })
    .from(layouts)
    .where(eq(layouts.contentHash, p.contentHash))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ id: existing[0].id, status: existing[0].status, deduped: true }, { status: 200 });
  }

  const id = randomUUID();
  const { status, publishedAt } = resolveIngestStatus();
  await db
    .insert(layouts)
    .values({
      id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      type: p.type,
      niche: p.niche,
      style: p.style,
      colors: p.colors,
      diviJsonBlobKey: p.diviJsonBlobKey,
      previewImageKeys: p.previewImageKeys,
      contentHash: p.contentHash,
      perceptualHash: p.perceptualHash,
      variant: p.variant,
      validatorPassed: true,
      seo: p.seo,
      status,
      publishedAt,
    })
    .onConflictDoNothing();

  if (p.tags?.length) {
    for (const t of p.tags) {
      const tagId = `tag_${t.axis}_${t.slug}`;
      await db.insert(tags).values({ id: tagId, axis: t.axis, slug: t.slug, title: t.slug }).onConflictDoNothing();
      await db.insert(layoutTags).values({ layoutId: id, tagId }).onConflictDoNothing();
    }
  }

  return NextResponse.json({ id, status, deduped: false }, { status: 201 });
}

import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';

// Fetch published layouts by slug — backs the client-side /saved (bookmarks) page.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('slugs') ?? '';
  const slugs = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (!slugs.length) return NextResponse.json({ layouts: [] });

  const rows = await db
    .select()
    .from(layouts)
    .where(and(eq(layouts.status, 'published'), inArray(layouts.slug, slugs)));

  return NextResponse.json({ layouts: rows });
}

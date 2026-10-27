import { NextResponse } from 'next/server';
import { facetCounts } from '@/lib/catalog/public-queries';

// Layout counts per type / industry / style for the "Free layouts" menu. Public display data from the cached catalog
// read (5 minutes), so the header never queries the database itself.
export async function GET() {
  try {
    const { type, niche, style } = await facetCounts();
    return NextResponse.json(
      { type, niche, style },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ type: {}, niche: {}, style: {} }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}

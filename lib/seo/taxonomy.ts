// lib/seo/taxonomy.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { taxonomyPages } from '@/db/schema';

export type TaxonomyAxis = 'type' | 'niche' | 'style' | 'color';
export type TaxonomyCopy = {
  intro: string;
  /** Long-form landing copy (markdown, ~300–500 words) rendered below the
   * grid. Null on rows written before the SEO-overhaul backfill. */
  body?: string | null;
  metaTitle: string;
  metaDescription: string;
};

export async function getTaxonomyCopy(axis: TaxonomyAxis, value: string): Promise<TaxonomyCopy | null> {
  const rows = await db
    .select({ intro: taxonomyPages.intro, body: taxonomyPages.body, metaTitle: taxonomyPages.metaTitle, metaDescription: taxonomyPages.metaDescription })
    .from(taxonomyPages)
    .where(and(eq(taxonomyPages.axis, axis), eq(taxonomyPages.value, value)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertTaxonomyCopy(axis: TaxonomyAxis, value: string, copy: TaxonomyCopy): Promise<void> {
  await db
    .insert(taxonomyPages)
    .values({ axis, value, ...copy })
    .onConflictDoUpdate({
      target: [taxonomyPages.axis, taxonomyPages.value],
      set: { intro: copy.intro, body: copy.body ?? null, metaTitle: copy.metaTitle, metaDescription: copy.metaDescription, updatedAt: new Date() },
    });
}

// Rewrite em dashes out of DB-stored copy: layout titles/descriptions/SEO and
// the taxonomy landing pages. The in-repo side is enforced by
// tests/no-em-dashes.test.ts; this is the same house rule applied to the rows
// the pipeline generated before it existed.
//
// Dry run (default, writes nothing):
//   DATABASE_URL=<target> npx tsx scripts/backfill-em-dashes.ts
// Apply:
//   DATABASE_URL=<target> npx tsx scripts/backfill-em-dashes.ts --apply
//
// Against production, source the pooled URL out of .env.prod the way
// scripts/release-edc-pro.sh does; do not `source` that file wholesale.
//
// Idempotent: a second run finds nothing, because the transform is a no-op on
// text that has no em dash left in it.
import { like, or, eq, and, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, taxonomyPages } from '@/db/schema';
import { deEmDash, deEmDashJson } from '@/lib/text/de-em-dash';

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

/** Truncated one-line preview, so a 400-word intro does not flood the log. */
function preview(s: string, width = 110): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > width ? `${flat.slice(0, width)}…` : flat;
}

let changedRows = 0;
let changedFields = 0;

function report(label: string, before: string, after: string): void {
  changedFields++;
  if (!VERBOSE) return;
  console.log(`    ${label}`);
  console.log(`      -  ${preview(before)}`);
  console.log(`      +  ${preview(after)}`);
}

async function backfillLayouts(): Promise<void> {
  const rows = await db
    .select({
      id: layouts.id,
      slug: layouts.slug,
      title: layouts.title,
      description: layouts.description,
      seo: layouts.seo,
    })
    .from(layouts)
    .where(
      or(
        like(layouts.title, '%—%'),
        like(layouts.description, '%—%'),
        sql`${layouts.seo}::text like '%—%'`,
      ),
    );

  console.log(`layouts: ${rows.length} row(s) with em dashes`);

  for (const row of rows) {
    const patch: Partial<typeof layouts.$inferInsert> = {};

    const title = deEmDash(row.title, { title: true });
    if (title !== row.title) {
      report(`title`, row.title, title);
      patch.title = title;
    }

    if (row.description) {
      const description = deEmDash(row.description);
      if (description !== row.description) {
        report(`description`, row.description, description);
        patch.description = description;
      }
    }

    if (row.seo) {
      const seo = deEmDashJson(row.seo);
      if (JSON.stringify(seo) !== JSON.stringify(row.seo)) {
        report(`seo`, JSON.stringify(row.seo), JSON.stringify(seo));
        patch.seo = seo;
      }
    }

    if (Object.keys(patch).length === 0) continue;
    changedRows++;
    if (VERBOSE) console.log(`  ${row.slug}`);
    if (APPLY) await db.update(layouts).set(patch).where(eq(layouts.id, row.id));
  }
}

async function backfillTaxonomyPages(): Promise<void> {
  const rows = await db
    .select({
      axis: taxonomyPages.axis,
      value: taxonomyPages.value,
      intro: taxonomyPages.intro,
      body: taxonomyPages.body,
      metaTitle: taxonomyPages.metaTitle,
      metaDescription: taxonomyPages.metaDescription,
    })
    .from(taxonomyPages)
    .where(
      or(
        like(taxonomyPages.intro, '%—%'),
        like(taxonomyPages.body, '%—%'),
        like(taxonomyPages.metaTitle, '%—%'),
        like(taxonomyPages.metaDescription, '%—%'),
      ),
    );

  console.log(`taxonomy_pages: ${rows.length} row(s) with em dashes`);

  for (const row of rows) {
    const patch: Partial<typeof taxonomyPages.$inferInsert> = {};

    const fields = [
      ['intro', row.intro, false],
      ['body', row.body, false],
      ['metaTitle', row.metaTitle, true],
      ['metaDescription', row.metaDescription, false],
    ] as const;

    for (const [key, value, isTitle] of fields) {
      if (!value) continue;
      const next = deEmDash(value, { title: isTitle });
      if (next === value) continue;
      report(key, value, next);
      (patch as Record<string, string>)[key] = next;
    }

    if (Object.keys(patch).length === 0) continue;
    changedRows++;
    if (VERBOSE) console.log(`  ${row.axis}/${row.value}`);
    if (APPLY) {
      await db
        .update(taxonomyPages)
        .set(patch)
        .where(and(eq(taxonomyPages.axis, row.axis), eq(taxonomyPages.value, row.value)));
    }
  }
}

async function main(): Promise<void> {
  const target = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '').replace(
    /.*@([^/?]+).*/,
    '$1',
  );
  console.log(`${APPLY ? 'APPLYING to' : 'DRY RUN against'} ${target || 'unknown host'}\n`);

  await backfillLayouts();
  await backfillTaxonomyPages();

  console.log(`\n${changedFields} field(s) across ${changedRows} row(s)`);
  if (!APPLY) console.log('Nothing was written. Re-run with --apply to write.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

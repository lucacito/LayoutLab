# Phase 6a — Taxonomy Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A landing page for every taxonomy axis value (`/type/hero`, `/niche/saas`, `/style/minimal`, `/color/blue`) with AI-written-or-templated intro copy, a filtered layout grid, ItemList + BreadcrumbList JSON-LD, and sitemap inclusion.

**Architecture:** A dedicated `taxonomy_pages` table stores per-(axis,value) copy; pages read stored copy or a deterministic templated fallback (so they render before generation runs). A shared page factory + `TaxonomyLanding` component back four thin axis routes. An offline script reuses the pipeline's `claudeCliClient` to populate the copy.

**Tech Stack:** Next.js 15 (RSC, generateStaticParams/Metadata), Drizzle, the pipeline `LlmClient` (`claude -p`), Vitest.

## Global Constraints

- **Four axes:** `type | niche | style | color` — `AXIS_VALUES` (`lib/catalog/filters.ts`) is the canonical value list per axis. Validate every route param against it; `notFound()` otherwise.
- **Routes are axis-prefixed** with a uniform dynamic segment `[value]`: `/type/[value]`, `/niche/[value]`, `/style/[value]`, `/color/[value]`.
- **Copy = stored-or-fallback:** `getTaxonomyCopy(axis,value)` if present, else `taxonomyFallbackCopy(...)`. Every page MUST render without any stored copy.
- **Generation is idempotent + resumable:** skip values that already have stored copy; a per-value LLM/parse failure logs + continues (never crashes the run). Reuse `claudeCliClient` + `extractJson`; never reimplement.
- **Reuse existing helpers:** `listLayouts`/`buildLayoutFilters`, `facetCounts` (per-value counts), `itemListJsonLd`/`breadcrumbJsonLd`, the `<JsonLd>` component, `LayoutCard`. Do not duplicate.
- DB-gated tests skip without `POSTGRES_URL`. Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `taxonomy_pages` table + store

**Files:**
- Modify: `db/schema.ts`
- Create: `lib/seo/taxonomy.ts`
- Migration: `db/migrations/*` (drizzle-kit generated)
- Test: `tests/taxonomy-store.test.ts`

**Interfaces:**
- Produces: `type TaxonomyAxis = 'type' | 'niche' | 'style' | 'color'`;
  `type TaxonomyCopy = { intro: string; metaTitle: string; metaDescription: string }`;
  `getTaxonomyCopy(axis: TaxonomyAxis, value: string): Promise<TaxonomyCopy | null>`;
  `upsertTaxonomyCopy(axis: TaxonomyAxis, value: string, copy: TaxonomyCopy): Promise<void>`.

- [ ] **Step 1: Add the table to `db/schema.ts`**

Append (near the other tables; reuse the existing `pgTable`, `text`, `timestamp`, `primaryKey` imports):
```ts
export const taxonomyPages = pgTable('taxonomy_pages', {
  axis: text('axis').notNull(),
  value: text('value').notNull(),
  intro: text('intro').notNull(),
  metaTitle: text('meta_title').notNull(),
  metaDescription: text('meta_description').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.axis, t.value] }) }));
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new file under `db/migrations/` creating `taxonomy_pages`. (Do not hand-edit.)

- [ ] **Step 3: Write the failing test**

```ts
// tests/taxonomy-store.test.ts
import { describe, it, expect } from 'vitest';
import * as store from '@/lib/seo/taxonomy';

describe('taxonomy store exports', () => {
  it('exposes get/upsert', () => {
    expect(typeof store.getTaxonomyCopy).toBe('function');
    expect(typeof store.upsertTaxonomyCopy).toBe('function');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('taxonomy store integration (needs POSTGRES_URL + migration applied)', () => {
  it('upsert then get round-trips and updates on conflict', async () => {
    await store.upsertTaxonomyCopy('style', 'minimal', { intro: 'a', metaTitle: 't', metaDescription: 'd' });
    expect((await store.getTaxonomyCopy('style', 'minimal'))?.intro).toBe('a');
    await store.upsertTaxonomyCopy('style', 'minimal', { intro: 'b', metaTitle: 't2', metaDescription: 'd2' });
    expect((await store.getTaxonomyCopy('style', 'minimal'))?.intro).toBe('b');
    expect(await store.getTaxonomyCopy('style', 'does-not-exist')).toBeNull();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm run test -- tests/taxonomy-store.test.ts`
Expected: FAIL — `@/lib/seo/taxonomy` not found.

- [ ] **Step 5: Implement the store**

```ts
// lib/seo/taxonomy.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { taxonomyPages } from '@/db/schema';

export type TaxonomyAxis = 'type' | 'niche' | 'style' | 'color';
export type TaxonomyCopy = { intro: string; metaTitle: string; metaDescription: string };

export async function getTaxonomyCopy(axis: TaxonomyAxis, value: string): Promise<TaxonomyCopy | null> {
  const rows = await db
    .select({ intro: taxonomyPages.intro, metaTitle: taxonomyPages.metaTitle, metaDescription: taxonomyPages.metaDescription })
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
      set: { intro: copy.intro, metaTitle: copy.metaTitle, metaDescription: copy.metaDescription, updatedAt: new Date() },
    });
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- tests/taxonomy-store.test.ts`
Expected: PASS — exports test passes; integration skips without a DB.

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add db/schema.ts db/migrations lib/seo/taxonomy.ts tests/taxonomy-store.test.ts
git commit -m "feat: taxonomy_pages table + per-(axis,value) copy store"
```
(append the trailer)

---

### Task 2: Templated fallback copy

**Files:**
- Create: `lib/seo/taxonomy-copy.ts`
- Test: `tests/taxonomy-copy.test.ts`

**Interfaces:**
- Consumes: `TaxonomyAxis`, `TaxonomyCopy` (Task 1).
- Produces: `axisLabel(value: string): string`; `axisNoun(axis: TaxonomyAxis): string`;
  `taxonomyFallbackCopy(axis: TaxonomyAxis, value: string, count: number): TaxonomyCopy`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/taxonomy-copy.test.ts
import { describe, it, expect } from 'vitest';
import { axisLabel, taxonomyFallbackCopy } from '@/lib/seo/taxonomy-copy';

describe('axisLabel', () => {
  it('humanizes snake_case values', () => {
    expect(axisLabel('real_estate')).toBe('Real Estate');
    expect(axisLabel('full_landing')).toBe('Full Landing');
    expect(axisLabel('minimal')).toBe('Minimal');
  });
});

describe('taxonomyFallbackCopy', () => {
  it('produces non-empty, count-aware copy with the humanized value', () => {
    const c = taxonomyFallbackCopy('style', 'minimal', 12);
    expect(c.intro).toContain('Minimal');
    expect(c.intro).toMatch(/12/);
    expect(c.metaTitle).toContain('Minimal');
    expect(c.metaTitle.length).toBeGreaterThan(0);
    expect(c.metaDescription.length).toBeGreaterThan(0);
  });
  it('reads naturally when count is 0 (no "0 layouts" awkwardness required, just non-empty)', () => {
    const c = taxonomyFallbackCopy('type', 'hero', 0);
    expect(c.intro.length).toBeGreaterThan(0);
    expect(c.metaTitle).toContain('Hero');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/taxonomy-copy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/seo/taxonomy-copy.ts
import type { TaxonomyAxis, TaxonomyCopy } from './taxonomy';

export function axisLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function axisNoun(axis: TaxonomyAxis): string {
  switch (axis) {
    case 'type': return 'section';
    case 'niche': return 'industry';
    case 'style': return 'style';
    case 'color': return 'color';
  }
}

export function taxonomyFallbackCopy(axis: TaxonomyAxis, value: string, count: number): TaxonomyCopy {
  const label = axisLabel(value);
  const noun = axisNoun(axis);
  const countPhrase = count > 0 ? `${count} ` : '';
  const intro = axis === 'type'
    ? `Browse ${countPhrase}professionally designed ${label} layouts for Divi 5. Import the JSON, customize in the builder, and ship faster.`
    : axis === 'niche'
      ? `Divi 5 layouts crafted for the ${label} industry — ${countPhrase}ready-to-import sections you can make your own in minutes.`
      : axis === 'style'
        ? `Explore ${countPhrase}${label.toLowerCase()} Divi 5 layouts. A curated ${label} aesthetic, ready to import and customize.`
        : `Divi 5 layouts in ${label.toLowerCase()} — ${countPhrase}designs built around a ${label.toLowerCase()} palette, ready to import.`;
  const metaTitle = `${label} Divi 5 Layouts${axis === 'type' ? '' : ` (${noun})`} — Divi5Lab`;
  const metaDescription = `Download ${countPhrase}${label} Divi 5 layouts as JSON. Import, customize, and launch. Commercial license included.`;
  return { intro, metaTitle, metaDescription };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/taxonomy-copy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/seo/taxonomy-copy.ts tests/taxonomy-copy.test.ts
git commit -m "feat: deterministic templated fallback copy for taxonomy pages"
```
(append the trailer)

---

### Task 3: Sitemap — taxonomy URLs

**Files:**
- Modify: `lib/seo/sitemap.ts`, `app/sitemap.ts`
- Test: `tests/sitemap.test.ts` (create if absent; else extend)

**Interfaces:**
- Consumes: `AXIS_VALUES` (`@/lib/catalog/filters`).
- Produces: `sitemapEntries` also emits `${siteUrl}/{axis}/{value}` for the four axes (axis keys: `type`, `niche`, `style`, `color`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/sitemap.test.ts
import { describe, it, expect } from 'vitest';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('sitemapEntries', () => {
  const out = sitemapEntries({ siteUrl: 'https://divi5lab.com', layouts: [], packs: [] });
  const urls = out.map((e) => e.url);

  it('includes a URL for every taxonomy axis value', () => {
    for (const axis of ['type', 'niche', 'style', 'color'] as const) {
      for (const value of AXIS_VALUES[axis]) {
        expect(urls).toContain(`https://divi5lab.com/${axis}/${value}`);
      }
    }
  });

  it('still includes the static + browse pages', () => {
    expect(urls).toContain('https://divi5lab.com');
    expect(urls).toContain('https://divi5lab.com/browse');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/sitemap.test.ts`
Expected: FAIL — taxonomy URLs absent.

- [ ] **Step 3: Extend `sitemapEntries`**

In `lib/seo/sitemap.ts`: add `import { AXIS_VALUES } from '@/lib/catalog/filters';` and a taxonomy block, then include it in the returned array:
```ts
  const taxonomyEntries: MetadataRoute.Sitemap = (['type', 'niche', 'style', 'color'] as const).flatMap((axis) =>
    AXIS_VALUES[axis].map((value) => ({
      url: `${i.siteUrl}/${axis}/${value}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  );
  return [...staticPages, ...taxonomyEntries, ...packEntries, ...layoutEntries];
```
(`app/sitemap.ts` needs no change — it already calls `sitemapEntries`; the taxonomy rows are derived from the static `AXIS_VALUES`, no DB.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/sitemap.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/seo/sitemap.ts tests/sitemap.test.ts
git commit -m "feat: include taxonomy landing URLs in the sitemap"
```
(append the trailer)

---

### Task 4: Landing pages (factory + component + 4 routes)

**Files:**
- Create: `components/TaxonomyLanding.tsx`, `lib/seo/taxonomy-page.tsx`
- Create: `app/(catalog)/type/[value]/page.tsx`, `app/(catalog)/niche/[value]/page.tsx`, `app/(catalog)/style/[value]/page.tsx`, `app/(catalog)/color/[value]/page.tsx`
- Test: `tests/taxonomy-landing.test.tsx`

**Interfaces:**
- Consumes: `AXIS_VALUES`, `parseFilters`/`CatalogFilters` shape, `listLayouts`, `facetCounts` (`@/lib/catalog/...`); `getTaxonomyCopy` (Task 1), `taxonomyFallbackCopy` (Task 2); `itemListJsonLd`/`breadcrumbJsonLd` + `<JsonLd>`; `LayoutCard`; `env`.
- Produces: `TaxonomyLanding(props)`; `makeTaxonomyPage(axis): { generateMetadata, Page }`.

- [ ] **Step 1: Write the failing component test**

```tsx
// tests/taxonomy-landing.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TaxonomyLanding } from '@/components/TaxonomyLanding';
import type { LayoutRow } from '@/lib/catalog/queries';

const layout = { id: 'l1', slug: 'a', title: 'Bold Hero', type: 'hero', niche: 'saas', style: 'bold', colors: ['blue'], status: 'published' } as unknown as LayoutRow;

describe('TaxonomyLanding', () => {
  it('renders the intro, the grid, and ItemList + BreadcrumbList JSON-LD', () => {
    const { container, getByText } = render(
      <TaxonomyLanding axis="style" value="minimal" siteUrl="https://divi5lab.com"
        copy={{ intro: 'Minimal intro here', metaTitle: 'x', metaDescription: 'y' }} layouts={[layout]} />,
    );
    expect(getByText(/Minimal intro here/)).toBeTruthy();
    expect(getByText('Bold Hero')).toBeTruthy();
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('"ItemList"'))).toBe(true);
    expect(ld.some((t) => t.includes('"BreadcrumbList"'))).toBe(true);
  });

  it('shows an empty state when there are no layouts', () => {
    const { getByText } = render(
      <TaxonomyLanding axis="type" value="faq" siteUrl="https://divi5lab.com"
        copy={{ intro: 'i', metaTitle: 'x', metaDescription: 'y' }} layouts={[]} />,
    );
    expect(getByText(/no layouts/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/taxonomy-landing.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `TaxonomyLanding`**

```tsx
// components/TaxonomyLanding.tsx
import { Container } from '@/components/ui/Container';
import { LayoutCard } from '@/components/LayoutCard';
import { JsonLd } from '@/components/JsonLd';
import { itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { axisLabel } from '@/lib/seo/taxonomy-copy';
import type { TaxonomyAxis, TaxonomyCopy } from '@/lib/seo/taxonomy';
import type { LayoutRow } from '@/lib/catalog/queries';

export function TaxonomyLanding({ axis, value, siteUrl, copy, layouts }: {
  axis: TaxonomyAxis; value: string; siteUrl: string; copy: TaxonomyCopy; layouts: LayoutRow[];
}) {
  const label = axisLabel(value);
  const pageUrl = `${siteUrl}/${axis}/${value}`;
  return (
    <main className="py-12">
      <Container>
        <nav className="text-small text-muted">
          <a href={`${siteUrl}/browse`} className="hover:text-action">Browse</a> <span aria-hidden>/</span> <span className="capitalize">{axis}</span> <span aria-hidden>/</span> <span className="text-navy">{label}</span>
        </nav>
        <h1 className="mt-4 text-h2 text-navy">{label} Divi 5 Layouts</h1>
        <p className="mt-3 max-w-2xl text-body text-muted">{copy.intro}</p>

        {layouts.length === 0 ? (
          <p className="mt-10 text-body text-muted">No layouts here yet — check back soon.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
          </div>
        )}
      </Container>

      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: siteUrl },
        { name: 'Browse', url: `${siteUrl}/browse` },
        { name: `${label} Layouts`, url: pageUrl },
      ])} />
      <JsonLd data={itemListJsonLd(layouts.map((l) => ({ name: l.title, url: `${siteUrl}/layouts/${l.slug}` })))} />
    </main>
  );
}
```

- [ ] **Step 4: Implement the page factory**

```tsx
// lib/seo/taxonomy-page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { listLayouts, facetCounts } from '@/lib/catalog/queries';
import { env } from '@/lib/env';
import { TaxonomyLanding } from '@/components/TaxonomyLanding';
import { getTaxonomyCopy, type TaxonomyAxis } from '@/lib/seo/taxonomy';
import { taxonomyFallbackCopy } from '@/lib/seo/taxonomy-copy';

// AXIS_VALUES uses key 'color' for the 4th axis; the column filter also uses 'color'.
const VALUES: Record<TaxonomyAxis, readonly string[]> = {
  type: AXIS_VALUES.type, niche: AXIS_VALUES.niche, style: AXIS_VALUES.style, color: AXIS_VALUES.color,
};

function emptyFilters() {
  return { type: [], niche: [], style: [], color: [], sort: 'newest' as const, page: 1 };
}

async function loadCopy(axis: TaxonomyAxis, value: string) {
  const counts = await facetCounts().catch(() => null);
  const count = counts?.[axis]?.[value] ?? 0;
  const stored = await getTaxonomyCopy(axis, value).catch(() => null);
  return stored ?? taxonomyFallbackCopy(axis, value, count);
}

export function makeTaxonomyPage(axis: TaxonomyAxis) {
  async function resolve(value: string) {
    if (!VALUES[axis].includes(value)) notFound();
    const layouts = await listLayouts({ ...emptyFilters(), [axis]: [value] });
    const copy = await loadCopy(axis, value);
    return { layouts, copy };
  }

  async function generateMetadata({ params }: { params: Promise<{ value: string }> }): Promise<Metadata> {
    const { value } = await params;
    if (!VALUES[axis].includes(value)) return {};
    const copy = await loadCopy(axis, value);
    const url = `${env.NEXT_PUBLIC_SITE_URL}/${axis}/${value}`;
    return { title: copy.metaTitle, description: copy.metaDescription, alternates: { canonical: url } };
  }

  async function Page({ params }: { params: Promise<{ value: string }> }) {
    const { value } = await params;
    const { layouts, copy } = await resolve(value);
    return <TaxonomyLanding axis={axis} value={value} siteUrl={env.NEXT_PUBLIC_SITE_URL} copy={copy} layouts={layouts} />;
  }

  return { generateMetadata, Page };
}
```

- [ ] **Step 5: Create the four route files**

```tsx
// app/(catalog)/type/[value]/page.tsx
import { makeTaxonomyPage } from '@/lib/seo/taxonomy-page';
const page = makeTaxonomyPage('type');
export const dynamic = 'force-dynamic';
export const generateMetadata = page.generateMetadata;
export default page.Page;
```
```tsx
// app/(catalog)/niche/[value]/page.tsx
import { makeTaxonomyPage } from '@/lib/seo/taxonomy-page';
const page = makeTaxonomyPage('niche');
export const dynamic = 'force-dynamic';
export const generateMetadata = page.generateMetadata;
export default page.Page;
```
```tsx
// app/(catalog)/style/[value]/page.tsx
import { makeTaxonomyPage } from '@/lib/seo/taxonomy-page';
const page = makeTaxonomyPage('style');
export const dynamic = 'force-dynamic';
export const generateMetadata = page.generateMetadata;
export default page.Page;
```
```tsx
// app/(catalog)/color/[value]/page.tsx
import { makeTaxonomyPage } from '@/lib/seo/taxonomy-page';
const page = makeTaxonomyPage('color');
export const dynamic = 'force-dynamic';
export const generateMetadata = page.generateMetadata;
export default page.Page;
```
(`force-dynamic` keeps build DB-free, consistent with the other catalog pages.)

- [ ] **Step 6: Run the component test + typecheck + lint**

Run: `npm run test -- tests/taxonomy-landing.test.tsx && npm run typecheck && npm run lint`
Expected: PASS. (If `LayoutCard`/`Container` import paths differ, match the real ones used by `app/(catalog)/browse/page.tsx`.)

- [ ] **Step 7: Commit**

```bash
git add components/TaxonomyLanding.tsx lib/seo/taxonomy-page.tsx "app/(catalog)/type" "app/(catalog)/niche" "app/(catalog)/style" "app/(catalog)/color" tests/taxonomy-landing.test.tsx
git commit -m "feat: taxonomy landing pages (4 axes) with ItemList + BreadcrumbList JSON-LD"
```
(append the trailer)

---

### Task 5: AI copy generation script

**Files:**
- Create: `pipeline/seo-copy.ts`
- Modify: `package.json` (add `"seo:copy": "tsx pipeline/seo-copy.ts"`)
- Test: `tests/seo-copy.test.ts`

**Interfaces:**
- Consumes: `claudeCliClient`/`LlmClient`/`extractJson` (`@/pipeline/llm` or `./llm`), `AXIS_VALUES`, `getTaxonomyCopy`/`upsertTaxonomyCopy` (Task 1).
- Produces: `generateTaxonomyCopy(deps: { llm: LlmClient; getCopy: typeof getTaxonomyCopy; upsert: typeof upsertTaxonomyCopy; maxBudgetUsd?: number; log?: (m: string) => void }): Promise<{ generated: number; skipped: number; failed: number }>`.

- [ ] **Step 1: Write the failing test (mocked LlmClient — no real CLI/DB)**

```ts
// tests/seo-copy.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateTaxonomyCopy } from '@/pipeline/seo-copy';

const VALID = JSON.stringify({ intro: 'AI intro', metaTitle: 'AI title', metaDescription: 'AI desc' });

function deps(over: Partial<any> = {}) {
  return {
    llm: { complete: vi.fn(async () => VALID) },
    getCopy: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
    log: () => {},
    ...over,
  };
}

describe('generateTaxonomyCopy', () => {
  it('skips values that already have stored copy', async () => {
    const d = deps({ getCopy: vi.fn(async () => ({ intro: 'x', metaTitle: 'x', metaDescription: 'x' })) });
    const r = await generateTaxonomyCopy(d);
    expect(d.llm.complete).not.toHaveBeenCalled();
    expect(d.upsert).not.toHaveBeenCalled();
    expect(r.skipped).toBeGreaterThan(0);
    expect(r.generated).toBe(0);
  });

  it('generates + upserts valid copy for every missing value', async () => {
    const d = deps();
    const r = await generateTaxonomyCopy(d);
    expect(d.upsert).toHaveBeenCalled();
    expect(r.generated).toBeGreaterThan(0);
    expect(r.failed).toBe(0);
    // upsert receives the parsed AI copy
    const firstCall = d.upsert.mock.calls[0];
    expect(firstCall[2]).toEqual({ intro: 'AI intro', metaTitle: 'AI title', metaDescription: 'AI desc' });
  });

  it('continues (does not throw) when one value returns unparseable output', async () => {
    let n = 0;
    const d = deps({ llm: { complete: vi.fn(async () => (n++ === 0 ? 'not json' : VALID)) } });
    const r = await generateTaxonomyCopy(d);
    expect(r.failed).toBe(1);
    expect(r.generated).toBeGreaterThan(0); // the rest still succeed
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/seo-copy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the generator + CLI entry**

```ts
// pipeline/seo-copy.ts
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { extractJson } from './llm';
import type { LlmClient } from './llm';
import { getTaxonomyCopy, upsertTaxonomyCopy, type TaxonomyAxis, type TaxonomyCopy } from '@/lib/seo/taxonomy';

const AXES: TaxonomyAxis[] = ['type', 'niche', 'style', 'color'];

const SYSTEM =
  'You write SEO landing-page copy for a Divi 5 layout marketplace. Respond with ONLY a JSON object: ' +
  '{ "intro": string (2-3 sentences), "metaTitle": string (<=60 chars), "metaDescription": string (<=155 chars) }.';

function parseCopy(text: string): TaxonomyCopy {
  const obj = extractJson(text) as Record<string, unknown>;
  const intro = String(obj.intro ?? '').trim();
  const metaTitle = String(obj.metaTitle ?? '').trim();
  const metaDescription = String(obj.metaDescription ?? '').trim();
  if (!intro || !metaTitle || !metaDescription) throw new Error('incomplete copy');
  return { intro, metaTitle: metaTitle.slice(0, 70), metaDescription: metaDescription.slice(0, 160) };
}

export async function generateTaxonomyCopy(deps: {
  llm: LlmClient;
  getCopy?: typeof getTaxonomyCopy;
  upsert?: typeof upsertTaxonomyCopy;
  maxBudgetUsd?: number;
  log?: (m: string) => void;
}): Promise<{ generated: number; skipped: number; failed: number }> {
  const getCopy = deps.getCopy ?? getTaxonomyCopy;
  const upsert = deps.upsert ?? upsertTaxonomyCopy;
  const log = deps.log ?? (() => {});
  let generated = 0, skipped = 0, failed = 0;

  for (const axis of AXES) {
    for (const value of AXIS_VALUES[axis]) {
      if (await getCopy(axis, value)) { skipped++; continue; }
      try {
        const prompt = `Write SEO landing-page copy for the "${value}" ${axis} category of Divi 5 layouts.`;
        const out = await deps.llm.complete({ prompt, system: SYSTEM, maxBudgetUsd: deps.maxBudgetUsd });
        await upsert(axis, value, parseCopy(out));
        generated++;
        log(`generated ${axis}/${value}`);
      } catch (err) {
        failed++;
        log(`FAILED ${axis}/${value}: ${(err as Error).message}`);
      }
    }
  }
  return { generated, skipped, failed };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('seo-copy.ts')) {
  (async () => {
    const { claudeCliClient } = await import('./llm');
    const r = await generateTaxonomyCopy({ llm: claudeCliClient(), maxBudgetUsd: 0.05, log: (m) => console.log(m) });
    console.log(`seo:copy done — generated ${r.generated}, skipped ${r.skipped}, failed ${r.failed}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
```

> Verify `claudeCliClient` + `extractJson` are exported from `./llm` (they are, per `pipeline/llm/index.ts`). If the CLI-entry `process.argv[1]` guard pattern differs from the existing `pipeline/index.ts`, match that file's guard.

- [ ] **Step 4: Add the npm script**

In `package.json` scripts, add: `"seo:copy": "tsx pipeline/seo-copy.ts",`

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/seo-copy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add pipeline/seo-copy.ts package.json tests/seo-copy.test.ts
git commit -m "feat: seo:copy — generate taxonomy intro copy via the claude CLI (idempotent)"
```
(append the trailer)

---

### Task 6: Acceptance — verification + manual walkthrough

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: PASS — taxonomy-store, taxonomy-copy, sitemap, taxonomy-landing, seo-copy, plus all prior suites; DB-gated suites skip without `POSTGRES_URL`.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://divi5lab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@divi5lab.com npm run build
```
Expected: PASS — `/type/[value]`, `/niche/[value]`, `/style/[value]`, `/color/[value]`, and the sitemap all compile (routes are force-dynamic; the sitemap enumerates the axis values).

- [ ] **Step 4: Manual acceptance (user-run — local DB + migration)**

```bash
npm run db:migrate   # applies the taxonomy_pages migration
npm run dev
# 1. /style/minimal → fallback intro + the minimal layouts (or empty state) + (view source) ItemList & BreadcrumbList JSON-LD.
# 2. /type/not-a-type → 404.
# 3. /sitemap.xml → lists /type/*, /niche/*, /style/*, /color/* URLs.
# 4. (optional, needs the local `claude` CLI) npm run seo:copy → re-load /style/minimal → AI copy replaces the fallback.
```

- [ ] **Step 5: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore: Phase 6a acceptance verified"
```
(append the trailer)

---

## Notes / external prerequisites (user-provided)

- Pages render with **templated fallback copy** out of the box; **`npm run seo:copy`**
  (needs the local `claude` CLI, the subscription backend) enriches them with AI copy.
- Run `npm run db:migrate` after pulling — the `taxonomy_pages` table is new.

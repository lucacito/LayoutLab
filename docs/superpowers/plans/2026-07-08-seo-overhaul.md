# SEO Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 2026-07-08 SEO overhaul spec: keyword landing pages, /free page, guides content cluster, per-layout long-form SEO articles + FAQ schema, taxonomy body copy, richer internal linking, descriptive alt text, and pipeline support so new layouts arrive SEO-complete.

**Architecture:** All on-page surfaces are config- or DB-driven and reuse existing catalog queries/components. Long-form layout content lives in `layouts.seo.article` (jsonb — no migration). Taxonomy long copy adds a `body` column to `taxonomyPages` (one migration). Keyword pages are a typed in-repo registry rendered by one dynamic route. Guides are markdown files in `content/guides/` rendered with `marked`. Backfills are standalone scripts using the established local+prod DB update pattern.

**Tech Stack:** Next.js App Router, Drizzle, Vitest, marked (new dep), Anthropic SDK (backfill scripts, reuse pipeline client).

## Global Constraints

- metaTitle ≤ 60 chars target; metaDescription 120–155 chars.
- No secrets client-side; backfill scripts are server/local only.
- All new public pages: canonical URL, JSON-LD, sitemap entry, internal links in AND out.
- Never fabricate ratings/reviews in schema. FAQ answers must be true (free download, license terms, Divi 5 requirement).
- Markdown rendered via `marked` only for trusted in-repo/DB content authored by us.
- Tests first for pure logic (registries, generators, parsers); commit per task.

---

### Task 1: JSON-LD upgrades (Article, FAQ on layout pages, ImageObject, homepage FAQ schema)

**Files:**
- Modify: `lib/seo/jsonld.ts` (add `articleJsonLd`, extend `productJsonLd` image → `string | {url, caption}[]`)
- Modify: `components/marketing/FaqSection.tsx` (emit `faqJsonLd`)
- Test: `tests/seo-jsonld-extras.test.ts`

**Interfaces:**
- Produces: `articleJsonLd({ headline, description, url, datePublished, dateModified, authorName, publisherId, image? })` → object with `@type: 'Article'`.
- Produces: `productJsonLd` accepts `images?: { url: string; caption: string }[]` (emitted as ImageObject array) while keeping existing `image?: string` working.

Steps: write failing tests (Article shape incl. publisher `@id` ref; Product with ImageObjects; backward-compat single image), run, implement, run, commit.

### Task 2: Descriptive alt text everywhere

**Files:**
- Create: `lib/seo/alt-text.ts` — `layoutAltText({ title, type, niche })` → `"${title} — ${axisLabel(niche)} ${axisLabel(type)} layout built with Divi 5"` (handles null niche/type gracefully).
- Modify: `components/LayoutCard.tsx`, `components/ResponsivePreview.tsx` (and its inner gallery), pass alt through.
- Test: `tests/seo-alt-text.test.ts`

### Task 3: Keyword landing page registry

**Files:**
- Create: `lib/seo/keyword-pages.ts` — registry + types:
```ts
export interface KeywordPage {
  slug: string; h1: string; metaTitle: string; metaDescription: string;
  intro: string;            // markdown, 300–600 words
  filters: Partial<Pick<CatalogFilters, 'type' | 'niche' | 'style'>>; // subset query
  freeOnly?: boolean;       // free packs/layouts surface
  faq: { question: string; answer: string }[]; // 3–5
  related: string[];        // slugs of other keyword pages
}
export const KEYWORD_PAGES: Record<string, KeywordPage>;
export function getKeywordPage(slug: string): KeywordPage | undefined;
```
- 13 entries per spec (divi-layouts, divi-templates, divi-5-templates, divi-landing-pages, divi-sections, divi-hero-sections, divi-pricing-tables, divi-contact-page-templates, divi-website-templates, divi-homepage-layouts, elegant-themes-layouts, free-divi-layouts, free-divi-templates). All intro copy authored in full in this task.
- Test: `tests/seo-keyword-pages.test.ts` — slugs kebab-case & unique; do NOT collide with existing top-level routes (`browse`, `packs`, `pricing`, `about`, `contact`, `license`, `login`, `account`, `admin`, `type`, `niche`, `style`, `color`, `layouts`, `guides`, `free`); every `filters` value ∈ AXIS_VALUES; metaTitle ≤ 65; metaDescription 100–165; intro ≥ 200 words; `related` slugs resolve.

### Task 4: Keyword landing route

**Files:**
- Create: `app/(catalog)/[keyword]/page.tsx` — `generateStaticParams` from registry; `generateMetadata` (canonical `/{slug}`); renders H1, intro (marked → HTML), grid of `listLayouts({...filters, page:1})` (24) + "Browse all" link, FAQ section + `faqJsonLd`, `collectionPageJsonLd` + `breadcrumbJsonLd`, related keyword pages + taxonomy hub links. Unknown slug → `notFound()`.
- Modify: `lib/seo/sitemap.ts` + `app/sitemap.ts` — keyword page entries (weekly, 0.8).
- Test: `tests/seo-sitemap-keywords.test.ts` (sitemap includes all registry slugs), plus render smoke via existing patterns if cheap.
- Dep: `npm i marked`.

### Task 5: /free page

**Files:**
- Create: `app/(catalog)/free/page.tsx` — canonical free hub: hero copy targeting "free divi layouts", grid of layouts NOT paid-only (query below), free packs strip, email-capture CTA, FAQ + faqJsonLd, links to /free-divi-layouts variants and taxonomy.
- Modify: `lib/catalog/queries.ts` — add `listFreeLayouts(limit, page?)` (layouts not exclusively in paid packs) and `listFreePacks()`.
- Modify: sitemap (add /free, 0.8). Add /free to keyword-page route-collision test list.
- Test: `tests/free-page-queries.test.ts` (mock-DB style consistent with catalog-queries.test.ts).

### Task 6: Guides infrastructure

**Files:**
- Create: `lib/guides/index.ts`:
```ts
export interface Guide { slug: string; title: string; description: string; date: string; updated?: string; keywords: string[]; body: string /* markdown, after frontmatter */; }
export function listGuides(): Guide[];       // reads content/guides/*.md, sorted date desc
export function getGuide(slug: string): Guide | undefined;
export function parseFrontmatter(raw: string): { data: Record<string,string|string[]>; body: string }; // tiny built-in parser, no gray-matter dep
```
- Create: `app/(marketing)/guides/page.tsx` (index: cards, metadata, ItemList JSON-LD) and `app/(marketing)/guides/[slug]/page.tsx` (Article JSON-LD via Task 1, breadcrumbs, marked render, prose styling, related-links footer).
- Modify: sitemap (guides index 0.7 + each guide 0.6, lastModified from updated/date); `lib/seo/internal-links.ts` `hubLinkGroups()` gains a Guides group (typed axis union widened).
- Test: `tests/guides.test.ts` — frontmatter parse (quoted strings, arrays), listGuides sort, getGuide miss → undefined, every guide's internal links point at real routes (regex-extract `](/...)` targets, assert against known prefixes).

### Task 7: Author 8 guides

**Files:** `content/guides/*.md` — the 8 articles from the spec, each 900–1600 words, frontmatter complete, ≥ 6 internal links (taxonomy pages, keyword pages, /browse, /free, specific packs where apt), honest comparisons (no fabricated benchmark numbers), FAQ-style closing section.

### Task 8: Layout SEO article schema + rendering

**Files:**
- Modify: `db/schema.ts` layouts.seo `$type` + `lib/catalog/queries.ts` LayoutRow type if separate — add `article` per spec shape.
- Create: `components/LayoutArticle.tsx` — renders overview/features/whoItsFor/customization (marked), shared `InstallSteps` static section, FAQ accordion; returns null if no article.
- Modify: `app/(catalog)/layouts/[slug]/page.tsx` — render `<LayoutArticle …/>` after gallery, before packs; emit `faqJsonLd(article.faq + SHARED_FAQ)` when article present; pass screenshot ImageObjects into `productJsonLd`.
- Test: `tests/layout-article.test.tsx` (renders sections when present; nothing when absent) following components.test.tsx patterns.

### Task 9: Article + meta generator (shared by backfill & pipeline)

**Files:**
- Create: `pipeline/seo-article.ts`:
```ts
export interface LayoutArticle { overview: string; features: string[]; whoItsFor: string; customization: string; faq: { q: string; a: string }[]; }
export interface ArticleMeta { metaTitle: string; metaDescription: string; }
export function buildArticlePrompt(i: { title: string; type: string; niche: string; style: string; paid: boolean; layoutJson: string }): { system: string; user: string };
export function parseArticleResponse(text: string): { article: LayoutArticle; meta: ArticleMeta };  // throws on shape violations
export async function generateLayoutArticle(i, deps): Promise<{ article; meta }>;                    // one retry on parse failure
```
- Quality floors: overview ≥ 900 chars; 5–8 features; 4–6 faq; metaTitle ≤ 60 & contains "Divi 5"; metaDescription 120–158.
- Modify: `pipeline/seo.ts` (or the pipeline step runner) to call it for new layouts and merge into the ingest payload's `seo`.
- Test: `tests/seo-article-gen.test.ts` — prompt includes taxonomy + JSON; parser accepts valid fixture, rejects short overview / missing faq; retry path with mock client.

### Task 10: Backfill script — layout articles (local + prod)

**Files:**
- Create: `scripts/backfill-seo-articles.ts` + `scripts/backfill-seo-articles.sh` (env selection local/prod like existing sync scripts).
- Behavior: select published layouts where `seo->>'article' IS NULL` (and `--limit`, `--slug` flags); fetch layout JSON from blob for grounding; call `generateLayoutArticle`; update `seo` jsonb merging article + improved metaTitle/metaDescription (keep existing keywords/ogImageKey); log per-row; idempotent; `--dry-run`.
- Test: parser/floors already covered by Task 9; script tested via `--dry-run --limit=1` against local DB during verification.

### Task 11: Taxonomy body copy + related categories

**Files:**
- Modify: `db/schema.ts` `taxonomyPages` + new drizzle migration — add `body text` (nullable).
- Modify: `lib/seo/taxonomy.ts` (`TaxonomyCopy` gains `body?: string`), `pipeline/seo-copy.ts` (prompt now also asks for a 300–500-word markdown `body`; regenerate when `body IS NULL` — loosen the existing skip), `components/TaxonomyLanding.tsx` (render body below grid via marked; add "Related categories" section: other values on same axis + cross-axis hubs from `hubLinkGroups()` + latest 3 guides).
- Create: `scripts/backfill-taxonomy-body.sh` wrapper to run seo-copy against local and prod.
- Test: extend existing taxonomy tests (`tests/taxonomy-*.test.ts`) for body render + related-categories links validity.

### Task 12: Pipeline screenshot naming + verification sweep

**Files:**
- Modify: `pipeline/upload.ts` — `uploadScreenshot` gains optional `seoName` (slug-niche-type); key becomes `layouts/${seoName}-${label}-${hash.slice(0,8)}.webp` when provided, legacy `layouts/${hash}-${label}.webp` otherwise. Wire caller in pipeline index/render step (seo step runs before upload in flow — confirm ordering; if upload precedes slug availability, rename-at-upload using planned slug from seo step).
- Test: `tests/upload-naming.test.ts`.
- Then full verification: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run dev` eyeball of: /divi-templates, /free, /guides, one guide, one layout page with article (after local backfill of 2–3 rows), /type/hero body+related.

### Task 13: HOLD — prod rollout (user confirmation required)

- prod `db:migrate` (taxonomyPages.body) → deploy (`git push origin main`) → run `scripts/backfill-seo-articles.sh prod` + taxonomy body backfill prod → spot-check live URLs + sitemap.

# Phase 1 — Data Model & Read-Only Catalog — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §19, Phase 1
**Predecessor:** Phase 0 (scaffold & infra) — complete, tagged `phase-0-complete`

---

## Goal

Stand up the full data model and a **read-only storefront catalog**: a buyer can
browse layouts and packs, filter them by the four taxonomy axes, search, sort,
open a layout or pack detail page with screenshots, and every page carries
correct SEO metadata + JSON-LD and is listed in a dynamic sitemap. No commerce,
no ingest, no pipeline yet — those are Phases 2–5.

Definition of done (CLAUDE.md §20): tests written first and passing, typecheck +
lint clean, SEO metadata present on every catalog page, responsive + accessible
UI, verification command output shown.

---

## Key decisions (resolved in brainstorm)

1. **Schema scope: full §6 model now.** Every table from CLAUDE.md §6 is defined
   in a single migration, even tables Phase 1 does not exercise (orders,
   entitlements, subscriptions, downloads, email_captures). Fewer migrations to
   reconcile later; commerce phases build on a stable schema.
2. **Previews: external placeholder image service.** Seed layouts reference a
   placeholder image URL (e.g. `https://picsum.photos/seed/<slug>/<w>/<h>`).
   No committed binary assets; real screenshots arrive from the Phase 3 pipeline.
   `next.config.mjs` whitelists the host via `images.remotePatterns`.
3. **Facet source: denormalized columns.** `/browse` filtering queries the
   `layouts.type / niche / style / colors` columns directly. The `tags` system
   exists for SEO landing pages (Phase 6), not as the filter source.
4. **Tags model: a single `tags` table with an `axis` discriminator.** §6 names
   "categories / tags" as one concept across four axes. Rather than two redundant
   tables, one `tags` table carries `axis` (`type|niche|style|feature`), `slug`,
   `title`, and `seo`. The `layoutTags` join links layouts to tags. This
   satisfies the taxonomy requirement with no redundancy.
5. **Filtering is server-side via URL query params.** RSC-rendered, shareable,
   SEO-friendly URLs (`/browse?type=hero&niche=saas&sort=newest`).

### Scope boundaries (deferred, by design)

- **Full taxonomy landing pages** (`/layouts/hero`, `/niche/saas`,
  `/style/dark/niche/agency`, …) → **Phase 6** per the roadmap. Tag data is
  seeded now; the routes are built later. The sitemap lists layouts, packs, and
  static marketing pages in Phase 1.
- **Commerce CTAs are visual stubs.** "Buy"/"Get this pack" link to `/pricing`
  (a placeholder); real Stripe checkout is Phase 4.
- **Ingest / admin / pipeline** — Phases 2–3.

---

## Architecture & data flow

```
Postgres (status='published' rows only)
   │
   ▼
lib/catalog/  ── pure: parseFilters(searchParams) → buildLayoutFilters(filters)
   │            ── thin db wrappers: listLayouts / getLayoutBySlug /
   │               listPacks / getPackBySlug / facetCounts
   ▼
app/(catalog)/ RSCs  (/browse, /layouts/[slug], /packs/[slug])
   │            + generateMetadata() via lib/seo
   ▼
components/  (LayoutCard, PackCard, FacetFilters, SearchSort,
              ScreenshotGallery + Lightbox, Breadcrumbs, JsonLd)
```

**Filter flow:** URL `searchParams` → `parseFilters` (validate against known axis
values, clamp unknowns) → `buildLayoutFilters` (Drizzle `where` conditions +
`orderBy`) → query → `{ results, facetCounts }` → server-rendered grid +
checked facet state.

**SEO flow:** stored `layouts.seo` / `packs.seo` + entity fields → `lib/seo`
pure generators → Next `Metadata` (in `generateMetadata`) and `<script
type="application/ld+json">` (rendered by the `JsonLd` component).

**Visibility rule:** catalog queries and the sitemap return **only `published`**
layouts and packs. `pending`/`approved`/`rejected` never appear publicly.

---

## Components / units (each independently testable)

### 1. Schema — `db/schema.ts` + generated migration
Full §6 model. New/expanded:
- **Enums:** `layoutStatus` (exists), `packKind` (`free|paid`), `userRole`
  (`user|admin`), `subscriptionStatus` (`active|past_due|canceled`),
  `tagAxis` (`type|niche|style|feature`).
- **`users`** + Auth.js adapter tables (`accounts`, `sessions`,
  `verificationTokens`) per the Drizzle adapter shape.
- **`layouts`** — expand the existing stub: keep all current columns; ensure
  `colors` is a queryable array, add indexes on `status`, `type`, `niche`,
  `style`, and `slug`.
- **`packs`** — id, slug, title, description, `kind`, `priceCents`,
  `stripePriceId` (nullable now), `coverImageKey`, `seo` jsonb, `status`,
  `createdAt`.
- **`packLayouts`** — (`packId`, `layoutId`, `position`), composite PK.
- **`tags`** — id, `axis`, slug, title, `seo` jsonb; unique (`axis`, `slug`).
- **`layoutTags`** — (`layoutId`, `tagId`), composite PK.
- **`orders`, `orderItems`, `subscriptions`, `entitlements`, `downloads`,
  `emailCaptures`** — defined per §6, unused in Phase 1.

Generate one migration via `npm run db:generate`. A schema-shape guard test
(extending Phase 0's `tests/db.test.ts`) asserts the new tables/columns exist.

### 2. Seed — `db/seed.ts` (idempotent)
- Taxonomy: seed `tags` for the §7 axis values across all four axes.
- ~12–15 `layouts`, `status='published'`, denormalized facets populated to
  exercise every filter, placeholder preview URLs, fake `diviJsonBlobKey`,
  `validatorPassed: true`, populated `seo` jsonb. Spread across multiple
  type/niche/style/color combinations.
- 3 `packs`: 1 `free`, 2 `paid`; wired via `packLayouts`; layouts linked to
  tags via `layoutTags`.
- **Idempotent:** upsert by slug (`onConflictDoUpdate`/`DoNothing`) so re-running
  `npm run db:seed` never duplicates.

### 3. Query layer — `lib/catalog/`
- **`parseFilters(searchParams): CatalogFilters`** — pure. Reads `type`,
  `niche`, `style`, `color`, `q`, `sort`, `page`; validates against known axis
  values; clamps/drops unknowns; defaults sort to `newest`. **Unit-tested.**
- **`buildLayoutFilters(filters): { where, orderBy, limit, offset }`** — pure
  Drizzle condition builder over the denormalized columns + `status='published'`.
  Search `q` → `ILIKE` on title/description. **Unit-tested.**
- **`listLayouts(filters)`, `getLayoutBySlug(slug)`, `listPacks()`,
  `getPackBySlug(slug)`, `getLayoutsForPack(packId)`, `facetCounts(filters)`** —
  thin wrappers executing the above. **Integration-tested, gated on
  `DATABASE_URL`** (skipped when absent, matching Phase 0).

### 4. Catalog pages — `app/(catalog)/`
- **`/browse`** — RSC reading `searchParams`. `FacetFilters` (checkboxes per
  axis, counts from `facetCounts`), `SearchSort`, responsive card grid of
  `LayoutCard` with `next/image` thumbnails, empty state when no matches.
- **`/layouts/[slug]`** — `ScreenshotGallery` + client `Lightbox`, metadata,
  "appears in these packs", `Breadcrumbs`. `generateMetadata` from `lib/seo`;
  `Product` + `BreadcrumbList` JSON-LD. Unknown slug → `notFound()`.
- **`/packs/[slug]`** — included-layouts grid, price display, CTA stub →
  `/pricing`, `generateMetadata`; `Product` + `ItemList` JSON-LD. Unknown slug →
  `notFound()`.

### 5. Components — `components/`
`LayoutCard`, `PackCard`, `FacetFilters`, `SearchSort`, `ScreenshotGallery`,
`Lightbox` (client), `Breadcrumbs`, `JsonLd`. Server components except the
lightbox/interactive filter controls.

### 6. SEO + sitemap — `lib/seo/`, `app/sitemap.ts`, `app/robots.ts`
- Pure generators (**unit-tested for output shape**): `buildLayoutMetadata`,
  `buildPackMetadata`, `productJsonLd`, `itemListJsonLd`, `breadcrumbJsonLd`.
- **`app/sitemap.ts`** — dynamic: published layouts + packs + static marketing
  pages. Built from a pure `sitemapEntries(rows)` function (**unit-tested**),
  wrapped by the route.
- **`app/robots.ts`** — allow all, reference the sitemap.
- **`next.config.mjs`** — `images.remotePatterns` for the placeholder host +
  Blob host.

---

## Error handling

- **Unknown layout/pack slug** → `notFound()` (Next 404).
- **Unknown/invalid filter values** → silently dropped/clamped to known axis
  values; never throws on hostile query strings.
- **Empty result set** → friendly empty state, not an error.
- **Image load failure** → `next/image` renders its box; non-fatal.
- **No `DATABASE_URL`** (local without DB) → integration tests skip; pages that
  need data are exercised by e2e only when a seeded DB is present.

---

## Testing strategy (TDD — test first)

- **Unit (no DB, pure):** `parseFilters` (validation/clamping/defaults),
  `buildLayoutFilters` (conditions + sort + search), SEO metadata + JSON-LD
  generators (shape), `sitemapEntries`.
- **Integration (gated on `DATABASE_URL`):** seed idempotency (re-run → no
  dupes), `listLayouts` honors filters and returns only `published`,
  `getLayoutBySlug`/`getPackBySlug`, `facetCounts`.
- **Schema guard:** `tests/db.test.ts` asserts new tables/columns.
- **Playwright e2e smoke** (gated on a seeded DB): `/browse` renders cards →
  applying a facet narrows results → `/layouts/[slug]` and `/packs/[slug]`
  render with a screenshot and JSON-LD present.
- CI stays green: pure unit tests + schema guard run everywhere; DB-gated tests
  skip without `DATABASE_URL`.

---

## Out of scope for Phase 1

Commerce/checkout, entitlements, downloads, ingest API, admin queue, the
generation pipeline, full taxonomy landing pages, OG image generation, real
screenshots. All have later phases.

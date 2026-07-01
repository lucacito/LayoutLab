# Design: `/browse` money page + hub-and-spoke internal links + CTR titles

Date: 2026-07-01
Status: Approved (design), implementing.

## Goal

Concentrate SEO authority for the head term "Divi 5 layouts" on a single
canonical money page (`/browse`), sculpt internal links so every page passes
keyword-anchored equity to that page and to the taxonomy hub pages, and improve
click-through by rewriting the programmatic title/description templates.

This implements strategies #6 (internal link sculpting) and #9 (CTR
optimization) from the SEO backlog. Off-platform strategies (parasite/barnacle
SEO, expired domains, competitor SERP mining, etc.) are out of scope — they
cannot be done in-repo.

## Decisions (from brainstorming)

- **Money page = existing `/browse`** (not a new `/divi-5-layouts/` URL, not the
  homepage). Avoids cannibalization; consolidates authority on an already-indexed
  URL.
- **Scope = full hub-and-spoke** (money page + sitewide band + CTR template
  rewrites).
- **Sitewide band shows on every route** (mounted in the root layout, like the
  footer).

## Components

### A. Shared hub-link source — `lib/seo/internal-links.ts` (new)

Single source of truth for the curated internal links, derived from the existing
`AXIS_VALUES` (`lib/catalog/filters.ts`) and `axisLabel()`
(`lib/seo/taxonomy-copy.ts`). Consumed by both the `/browse` category section and
the sitewide band so anchor text stays consistent.

Exports `hubLinkGroups(): { heading: string; links: { label: string; href: string }[] }[]`
returning three groups:

- **Layout types** → `/type/{v}`: hero, pricing, cta, testimonials, features,
  faq, footer, contact, gallery, full_landing
- **Industries** → `/niche/{v}`: saas, agency, ecommerce, restaurant,
  real_estate, fitness, coaching
- **Styles** → `/style/{v}`: minimal, bold, dark, corporate, elegant, playful

Curated subsets of `AXIS_VALUES` (color axis intentionally omitted from the
sculpting set to keep anchor density focused). Labels via `axisLabel()`
(handles `saas`→`SaaS`, `real_estate`→`Real Estate`, `full_landing`→`Full Landing`).

Tests: every `href` matches its axis path pattern; labels non-empty; values are
a subset of the real `AXIS_VALUES` (guards against typos / renamed values).

### B. `/browse` money page — `app/(catalog)/browse/page.tsx`

- **H1**: `Browse layouts` → `Free Divi 5 Layouts & Sections`, with a short
  keyword intro paragraph above the grid.
- **CTR metadata**: rewrite `title`/`description` leading with Free/Download.
- **"Browse by category" section** below the grid rendering `hubLinkGroups()` —
  strong outbound hub→spoke links.
- **JSON-LD**: add `collectionPageJsonLd` (new builder) + `breadcrumbJsonLd`
  (Home › Browse), injected via the existing `<JsonLd>` component.

Page stays an async Server Component; the added content is static and unaffected
by `searchParams`.

### C. Sitewide band — `components/site/InternalLinksBand.tsx` (new)

Mounted in `app/layout.tsx` between `{children}` and `<Footer/>` so it renders on
every route. Slim band: lead line "Explore free Divi 5 layouts" (anchor →
`/browse`) + the `hubLinkGroups()` columns. Styled to match footer conventions
(`border-t border-border bg-paper py-12`, `Container`, `text-navy`/`text-muted`/
`text-action`). Render test asserts the `/browse` anchor and a sample of hub
links.

### D. CTR template rewrites

- **Taxonomy** (`lib/seo/taxonomy-copy.ts`): keep structure, add Download/CTR
  verbs. type → `Free Divi 5 {Label} Sections — Download & Import`; other axes →
  `Free {Label} Divi 5 Layouts — Download & Import`. Descriptions lead with
  "Download …".
- **Layout/pack fallbacks** (`lib/seo/metadata.ts`): rewrite thin descriptions to
  lead with "Download {title} — a free, validated Divi 5 layout you can import in
  seconds. Commercial license included." (and the pack equivalent).
- Update `tests/taxonomy-copy.test.ts` and `tests/seo.test.ts` to the new copy.

## Out of scope

Homepage title (already strong), new taxonomy values, color-axis sculpting links,
and all off-platform SEO strategies.

## Verification

TDD throughout. `npm run test` (full suite) + `npx tsc --noEmit` + `next build`
must all pass before commit. Then commit + push to `main`.

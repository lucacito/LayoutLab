# SEO Overhaul — Design Spec

Date: 2026-07-08
Status: approved for autonomous implementation (user directive: "make the most you can on this")

## Goal

Turn Divi5Lab from a thin catalog into a topical-authority SEO site for the whole
"Divi layouts / Divi templates" keyword space, not just "Divi 5 layouts".
Source: user-provided 14-point SEO recommendation list. Point 12 (backlink
outreach) is off-site and out of scope; everything else is in scope.

## Workstreams

### A. Layout pages become deep SEO assets (points 2, 5, 8, 13, 14)

**Schema (no migration — jsonb extension):** `layouts.seo` gains:

```ts
article?: {
  overview: string;              // markdown, ~250–450 words: design explanation
  features: string[];            // 5–8 concrete feature bullets
  whoItsFor: string;             // markdown, ~80–150 words: industries/use cases
  customization: string;         // markdown, ~100–200 words: customization tips
  faq: { q: string; a: string }[]; // 4–6 layout-specific Q&As
}
```

**Rendering** on `/layouts/[slug]` (below the gallery, above related):
Overview → Features → Who it's for → Customization tips → shared static
"How to install" section (same component for all layouts) → FAQ (per-layout +
2 shared install/license Q&As). Total on-page word count lands in the
800–1500-word target.

**JSON-LD additions:** `faqJsonLd` from article.faq; screenshots emitted as
`ImageObject`s inside the Product `image`; keep `Product` (no
SoftwareApplication — conflicting types risk both being ignored).

**Titles/metas:** backfill formula-driven `metaTitle` (≤60 chars):
`{Title} — Free {Niche} {Type} Divi 5 Layout` (paid: drop "Free") and
CTR-oriented `metaDescription` (benefit + native-builder + responsive + CTA).

**Backfill:** `scripts/seo-articles.ts` — for every published layout lacking
`seo.article`, call Claude (grounded in the layout's real JSON + taxonomy) to
generate the article + improved metaTitle/metaDescription; update local DB and
prod DB (shared-blob pattern already established). Idempotent: skips rows that
already have `seo.article`. `pipeline/seo.ts` extended so NEW layouts get the
article at generation time (same prompt, one extra call or merged output).

### B. Keyword landing pages (points 1, 11, 14)

Config-driven static pages at root-level slugs, one per broad keyword:

`/divi-layouts`, `/divi-templates`, `/divi-5-templates`,
`/divi-landing-pages`, `/divi-sections`, `/divi-hero-sections`,
`/divi-pricing-tables`, `/divi-contact-page-templates`,
`/divi-website-templates`, `/divi-homepage-layouts`,
`/elegant-themes-layouts`, `/free-divi-layouts`, `/free-divi-templates`.

Implementation: `lib/seo/keyword-pages.ts` — a typed registry:
`{ slug, h1, metaTitle, metaDescription, intro (markdown, 300–600 words,
authored in-repo), filters (maps to catalog query: type/kind), faq }`.
Route `app/(catalog)/[keyword]/page.tsx` with `generateStaticParams` from the
registry and `notFound()` for unknown slugs (static routes win over the dynamic
segment, so no shadowing). Each page: H1, intro copy, live layout grid from the
mapped filter (24 + link to /browse), FAQ w/ JSON-LD, related keyword pages +
taxonomy links, `CollectionPage` + `BreadcrumbList` JSON-LD, sitemap entries.

**/free** (point 11): dedicated free landing — all free layouts + free packs +
email capture, targeting "free divi layouts/templates"; `/free-divi-layouts`
and `/free-divi-templates` are thin keyword variants linking into it, OR they
ARE the free pages (decision: `/free-divi-layouts` is the canonical free page;
`/free` redirects to it).

### C. Content clusters — guides (points 3, 10)

Markdown articles in `content/guides/*.md` (frontmatter: title, description,
date, updated, tags, related layout/taxonomy links) rendered at
`/guides/[slug]` + `/guides` index. Renderer: `marked` (single small dep,
trusted repo content). `Article` + `BreadcrumbList` JSON-LD, sitemap entries,
cross-links into taxonomy/layout pages, InternalLinksBand gains a Guides group.

Initial cluster (authored this session, AI-written, human-editable):
1. Best Divi 5 Layouts for Agencies
2. Best Divi 5 Layouts for Restaurants
3. Best Divi 5 Layouts for SaaS
4. How to Import a Divi 5 Layout (step-by-step)
5. Divi 5 vs Elementor: Templates & Layouts Compared
6. Divi 5 vs Bricks Builder
7. Free vs Premium Divi Layouts: What You Actually Get
8. Divi 5 Design Tips: 10 Rules Our Generator Follows

### D. Taxonomy pages that actually rank (points 6, 7)

- `taxonomyPages` gains a `body` text column (migration) — 300–600 words of
  unique copy rendered below the grid; `pipeline/seo-copy.ts` prompt extended
  and re-run as backfill for all axis values.
- `TaxonomyLanding` gains a "Related categories" section: sibling values on the
  same axis + cross-axis hubs (e.g. /type/hero links the niches) + guides.
- Keep `metaTitle` formula keyword-rich: `{Label} Divi Layouts & Templates —
  Free Divi 5 {Label} Sections`.

### E. Internal linking (point 6)

- Layout page: existing RelatedElements + new links to its niche/style hub
  pages and 2 relevant guides; keyword pages ↔ taxonomy ↔ guides all
  cross-link. Homepage FaqSection starts emitting `faqJsonLd` (quick win).

### F. Images (point 9)

- Alt text everywhere becomes descriptive: `{title} — {niche} {type} layout
  built with Divi 5` (cards, detail gallery, OG images keep titles).
- Pipeline blob keys for NEW screenshots become
  `layouts/{slug}-{niche}-{type}-{label}-{hash8}.webp` (hash suffix preserves
  idempotency/dedupe). Existing ~193×2 blobs are NOT renamed this pass
  (low value vs. churn; revisit later).

## Out of scope

- Backlink outreach (point 12) — off-site.
- Renaming existing blob files.
- Combo taxonomy routes (/hero/saas) — deferred; keyword pages + browse links
  cover the intent with less URL sprawl. Revisit with search-console data.

## Order of implementation

1. Metadata/JSON-LD foundations + alt text (A-titles, E, F-alt) — pure code.
2. Keyword landing pages + /free (B).
3. Guides infra + 8 articles (C).
4. Layout article schema + rendering + pipeline extension (A).
5. Backfill scripts run: layout articles, taxonomy body copy (A, D).
6. Taxonomy body column + related-categories + sitemap additions (D).
7. Local verification (tests, typecheck, build, eyeball pages).
8. HOLD for user: prod db:migrate + deploy + prod backfill runs.

## Testing

TDD for: keyword-page registry validation (slug collisions vs. real routes,
filter validity), guides frontmatter parsing/rendering, JSON-LD output shapes
(FAQ, ImageObject, Article), metaTitle formula (length caps), sitemap includes
new surfaces, alt-text builder. E2E smoke: keyword page renders grid; guide
renders; layout page shows article sections when present, hides when absent.

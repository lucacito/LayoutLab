# WooCommerce Product-Listing Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `shop` layout type — a reusable Divi 5 product-grid section built on the WooCommerce **Shop** module (`divi/shop`) — that flows through the existing generate → validate → render → ingest pipeline and surfaces in the catalog as a "requires WooCommerce" layout.

**Architecture:** `divi/shop` is a single **leaf** module discovered empirically from a real Divi 5.8.0 builder export. The deterministic validator (sibling repo) currently rejects it with `UNKNOWN_MODULE_TYPE` + `UNEXPECTED_CHILD_TYPE`; we close that gap with two additive allowlist edits. Generation is grounded by a new `shop-grid` recipe added to the validator's single-source `section-recipes.json`, wired into the pipeline via the `SECTION_TYPES` registry. Catalog wiring adds `shop` to the type axis, nav, and preview skin, plus a buyer badge.

**Tech Stack:** PHP 8.3 + PHPUnit 11 (validator repo), TypeScript + Vitest (layoutlab pipeline & web app), Next.js App Router, Docker WP+Divi render env with WooCommerce.

## Global Constraints

- **Never reimplement the validator** — only *extend* its PHP allowlist additively; same input → same verdict preserved. (CLAUDE.md #1)
- **Never ship un-validated layouts** — shop sections pass the real validator gate after the allowlist patch. (CLAUDE.md #2)
- **No invented schema** — `divi/shop` block name/shape come from a real export, not memory. (CLAUDE.md #3)
- **The two `SchemaRules.php` copies must stay byte-identical:** `src/SchemaRules.php` (canonical, loaded by `scripts/validate.php` via autoload) and `wp-plugin/validator/SchemaRules.php` (plugin runtime).
- **`section-recipes.json` is the single source of truth** for recipes — both the pipeline grounding loader (`pipeline/recipes/grounding.ts`) and the validator's `SectionRecipes.php` read it.
- **Validator repo path:** `../Divi 5 Deterministic Validator` (relative to the layoutlab repo root).
- **Discovered ground truth:** the Woo products grid is `<!-- wp:divi/shop {"builderVersion":"5.8.0"} /-->` — a self-closing leaf, valid only as a child of `divi/column`/`divi/column-inner`.

---

### Task 1: Whitelist `divi/shop` in the validator (sibling repo)

**Files (all under `../Divi 5 Deterministic Validator`):**
- Modify: `src/SchemaRules.php` (add to `LEAF_MODULES` ~line 76; add to `ALLOWED_CHILDREN['divi/column']` ~line 157)
- Modify: `wp-plugin/validator/SchemaRules.php` (identical edits — keep byte-identical)
- Create: `fixtures/valid/woo-shop-section.json`
- Create: `fixtures/invalid/woo-shop-wrong-nesting.json`
- Modify: `tests/ValidatorSchemaTest.php` (register the invalid fixture in the provider ~line 85)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `divi/shop` recognized as a known leaf module and a valid child of `divi/column` (and, via `allowedChildrenOf`'s mapping, `divi/column-inner` and `divi/group`). This is what Task 2's recipe and Task 7's generated section depend on to pass validation.

**Note:** `allowedChildrenOf()` (SchemaRules.php ~line 243) already remaps `divi/column-inner` and `divi/group` to `divi/column`, so adding `divi/shop` to the `divi/column` children array covers all three parents. No separate `column-inner` edit is needed.

- [ ] **Step 1: Write the failing test — add the valid fixture**

Create `fixtures/valid/woo-shop-section.json` with exactly this content (the real export, reduced to the shop section; it already validated clean except for the two shop violations):

```json
{"post_title":"Woo Shop Section","post_content":"<!-- wp:divi/placeholder --><!-- wp:divi/section {\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/row {\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/column {\"module\":{\"advanced\":{\"type\":{\"desktop\":{\"value\":\"4_4\"}}}},\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/shop {\"builderVersion\":\"5.8.0\"} /--><!-- /wp:divi/column --><!-- /wp:divi/row --><!-- /wp:divi/section --><!-- /wp:divi/placeholder -->"}
```

`tests/ValidatorSchemaTest.php::testValidFixturesAllPass` globs `fixtures/valid/*.json`, so this fixture is now automatically asserted valid — and will FAIL until the allowlist is patched.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "../Divi 5 Deterministic Validator" && vendor/bin/phpunit --filter testValidFixturesAllPass`
Expected: FAIL — `woo-shop-section.json should be valid, violations: UNKNOWN_MODULE_TYPE: Unknown block type 'divi/shop'.; UNEXPECTED_CHILD_TYPE: ...`

- [ ] **Step 3: Patch the allowlist (both SchemaRules copies)**

In `src/SchemaRules.php`, add `'divi/shop'` to the `LEAF_MODULES` array. Place it after the `divi/post-nav` line (~line 77) in the "Module-coverage export" group:

```php
        'divi/post-nav',
        // WooCommerce — the products grid (Shop module). Leaf; valid only inside a column.
        'divi/shop',
```

In the same file, add `'divi/shop'` to `ALLOWED_CHILDREN['divi/column']`. Place it after the `'divi/post-nav',` entry in that array (~line 152):

```php
            'divi/post-nav',
            // WooCommerce products grid
            'divi/shop',
```

Apply the **identical** two edits to `wp-plugin/validator/SchemaRules.php` at the corresponding lines. Verify they remain byte-identical:

Run: `cd "../Divi 5 Deterministic Validator" && diff -q src/SchemaRules.php wp-plugin/validator/SchemaRules.php`
Expected: no output (identical).

- [ ] **Step 4: Run the valid-fixture test to verify it passes**

Run: `cd "../Divi 5 Deterministic Validator" && vendor/bin/phpunit --filter testValidFixturesAllPass`
Expected: PASS (OK — all valid fixtures pass clean).

- [ ] **Step 5: Add the invalid fixture proving `divi/shop` is column-only**

Create `fixtures/invalid/woo-shop-wrong-nesting.json` — `divi/shop` placed directly inside a `divi/section` (not a column). After the patch, `divi/shop` is a *known* type but still not an allowed child of `section`, so it must fail with `UNEXPECTED_CHILD_TYPE`:

```json
{"post_title":"Woo Shop Wrong Nesting","post_content":"<!-- wp:divi/placeholder --><!-- wp:divi/section {\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/shop {\"builderVersion\":\"5.8.0\"} /--><!-- /wp:divi/section --><!-- /wp:divi/placeholder -->"}
```

Register it in `tests/ValidatorSchemaTest.php::invalidFixtureProvider()` — add this line to the "Pass 4 — hierarchy" group (~line 85):

```php
            'woo-shop-wrong-nesting'          => [$dir . '/woo-shop-wrong-nesting.json',          Validator::E_UNEXPECTED_CHILD_TYPE],
```

- [ ] **Step 6: Run the full validator suite**

Run: `cd "../Divi 5 Deterministic Validator" && vendor/bin/phpunit`
Expected: PASS (all tests green, including the new valid fixture and the new invalid-fixture provider row).

- [ ] **Step 7: Commit**

```bash
cd "../Divi 5 Deterministic Validator"
git add src/SchemaRules.php wp-plugin/validator/SchemaRules.php fixtures/valid/woo-shop-section.json fixtures/invalid/woo-shop-wrong-nesting.json tests/ValidatorSchemaTest.php
git commit -m "feat(schema): whitelist divi/shop (WooCommerce products grid) as a column-child leaf

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add the `shop-grid` grounding recipe (sibling repo)

**Files (under `../Divi 5 Deterministic Validator`):**
- Modify: `wp-plugin/data/section-recipes.json` (append one recipe object)

**Interfaces:**
- Consumes: `divi/shop` as a known column-child (Task 1).
- Produces: a recipe named `shop-grid` that both `SectionRecipes.php` (validator) and `pipeline/recipes/grounding.ts` (layoutlab loader) read from the same JSON. Task 3 references this name in `SECTION_TYPES.shop.recipes`.

**Note:** `wp-plugin/src/SectionRecipes.php` reads this JSON as its single source, so `tests/SectionRecipesTest.php::testEveryRecipeValidates` will validate the new recipe's markup (wrapped in `<!-- wp:divi/placeholder -->…</wp:divi/placeholder>`). It only passes because Task 1 whitelisted `divi/shop` — hence Task 2 depends on Task 1.

- [ ] **Step 1: Append the `shop-grid` recipe**

In `wp-plugin/data/section-recipes.json` (a JSON array), add this object as a new element (e.g. after `icon-values`). The `markup` is a styled section: a heading intro + the shop grid, all inside one column so it validates:

```json
{
  "name": "shop-grid",
  "title": "WooCommerce Products Grid",
  "description": "A product-listing section: a short heading/intro above the WooCommerce Shop module (divi/shop), which renders the store's products in a grid. Requires WooCommerce active on the buyer's site.",
  "when": "Use for a shop / product-listing / catalog section that displays WooCommerce products.",
  "stage": "Product / catalog",
  "markup": "<!-- wp:divi/section {\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/row {\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/column {\"module\":{\"advanced\":{\"type\":{\"desktop\":{\"value\":\"4_4\"}}}},\"builderVersion\":\"5.8.0\"} --><!-- wp:divi/heading {\"title\":{\"innerContent\":{\"desktop\":{\"value\":\"Shop Our Collection\"}}},\"builderVersion\":\"5.8.0\"} /--><!-- wp:divi/shop {\"builderVersion\":\"5.8.0\"} /--><!-- /wp:divi/column --><!-- /wp:divi/row --><!-- /wp:divi/section -->"
}
```

- [ ] **Step 2: Run the recipe validation test to verify it passes**

Run: `cd "../Divi 5 Deterministic Validator" && vendor/bin/phpunit --filter SectionRecipesTest`
Expected: PASS — including `recipe 'shop-grid' must validate`. (If it fails with `UNKNOWN_MODULE_TYPE`, Task 1 was not applied; if with `MISSING_REQUIRED_FIELD` on the heading, verify the `title` key is present in the heading block.)

- [ ] **Step 3: Verify the JSON still parses (no trailing-comma / syntax error)**

Run: `cd "../Divi 5 Deterministic Validator" && node -e "const r=require('./wp-plugin/data/section-recipes.json'); console.log(r.map(x=>x.name).join(', '))"`
Expected: the recipe-name list now ends with `shop-grid`.

- [ ] **Step 4: Commit**

```bash
cd "../Divi 5 Deterministic Validator"
git add wp-plugin/data/section-recipes.json
git commit -m "feat(recipes): add shop-grid recipe grounding divi/shop product listing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Register the `shop` section type (layoutlab)

**Files (under `layoutlab`):**
- Modify: `pipeline/recipes/section-types.ts` (add a `shop` entry to `SECTION_TYPES` ~after the `blog` entry, before `full_landing`, ~line 340)
- Modify: `tests/section-types.test.ts` (add `shop` to the `EXPECTED_RECIPE_BY_TYPE`, `EXPECTED_KIND_BY_TYPE`, `EXPECTED_LAYOUTS_BY_TYPE` snapshot maps)

**Interfaces:**
- Consumes: the `shop-grid` recipe name (Task 2), matched by `RECIPE_BY_TYPE` at grounding time.
- Produces: `SECTION_TYPES.shop` — makes `shop` a generatable type. `RECIPE_BY_TYPE.shop`, `KIND_BY_TYPE.shop`, `LAYOUTS_BY_TYPE.shop` are all derived from it. Task 7 generates `--target=shop:...` against this.

**Note:** `shop` has **no** flow `roles` (like `footer`/`contact`/`blog`) — it is a standalone target type, never a narrative Step in a composed page. `libraryKinds: []` is a *documented* corpus gap (no shop content in the D5 library, same pattern as `testimonials`/`faq`), NOT an omission.

- [ ] **Step 1: Add the `shop` entry to `SECTION_TYPES`**

In `pipeline/recipes/section-types.ts`, insert before the `full_landing:` entry (~line 341):

```typescript
  shop: {
    // Grounded on the shop-grid recipe (validator repo section-recipes.json),
    // whose markup is a heading + divi/shop (the WooCommerce products grid).
    recipes: ['shop-grid', 'section-intro'],
    // Documented corpus gap (like testimonials/faq): the D5 library has zero
    // divi/shop modules, so there are no BM25 exemplars to retrieve.
    libraryKinds: [],
    layouts: [
      'a full-width product grid under a short heading',
      'a heading and intro line above a multi-column product grid',
      'a compact product grid with a centered section title',
    ],
    // No `roles`: shop is a standalone target type, never a flow Step's role
    // (same as footer/contact/blog).
  },
```

- [ ] **Step 2: Run the section-types test to verify it fails on the snapshot maps**

Run: `cd layoutlab 2>/dev/null; npm run test -- section-types --run`
Expected: FAIL — the derived `RECIPE_BY_TYPE`/`KIND_BY_TYPE`/`LAYOUTS_BY_TYPE` now include `shop`, but the `EXPECTED_*` maps in the test don't yet, so the drift assertions fail.

- [ ] **Step 3: Update the `EXPECTED_*` snapshot maps in the test**

In `tests/section-types.test.ts`, add the matching `shop` entries:

To `EXPECTED_RECIPE_BY_TYPE`:
```typescript
  shop: ['shop-grid', 'section-intro'],
```

To `EXPECTED_KIND_BY_TYPE`:
```typescript
  shop: [],
```

To `EXPECTED_LAYOUTS_BY_TYPE`:
```typescript
  shop: [
    'a full-width product grid under a short heading',
    'a heading and intro line above a multi-column product grid',
    'a compact product grid with a centered section title',
  ],
```

(`EXPECTED_ROLE_DESIGN` needs no change — `shop` declares no roles.)

- [ ] **Step 4: Run the section-types test to verify it passes**

Run: `npm run test -- section-types --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd layoutlab
git add pipeline/recipes/section-types.ts tests/section-types.test.ts
git commit -m "feat(pipeline): register 'shop' section type grounded on shop-grid recipe

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Pin `shop` type through the ingest payload (layoutlab)

**Files (under `layoutlab`):**
- Modify: `pipeline/run.ts` (`buildIngestPayload` ~line 336; export the function for testing ~line 329)
- Test: `tests/ingest-payload-shop-type.test.ts` (new)

**Interfaces:**
- Consumes: `target.type === 'shop'` (set by Task 3's registration + the `one`/`vary` target).
- Produces: the ingest payload's `type` (and its `type` tag) is pinned to `'shop'` for shop targets, so it survives the SEO classification step.

**Why:** `buildIngestPayload` currently sets `type = pins?.type ?? seo.axes.type` — the ingested type is the SEO model's enum-clamped *guess*, not `target.type`. A product grid can be misclassified by the model as `gallery`/`features`, silently stripping the `shop` facet and the "requires WooCommerce" badge. `shop` is structurally determined (the section contains `divi/shop`), so it must not be left to classification.

- [ ] **Step 1: Write the failing test**

Create `tests/ingest-payload-shop-type.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildIngestPayload } from '@/pipeline/run';
import type { LayoutSeo } from '@/pipeline/seo';

const parts = { diviJsonBlobKey: 'k', previewImageKeys: ['p'], hash: 'h' };

function seoWith(typeGuess: string): LayoutSeo {
  return {
    title: 'T', slug: 't', metaDescription: 'd', keywords: ['k'],
    axes: { type: typeGuess, niche: 'ecommerce', style: 'minimal', colors: ['blue'] },
  } as LayoutSeo;
}

describe('buildIngestPayload — shop type pinning', () => {
  it("pins type='shop' for a shop target even when SEO guesses another type", () => {
    const item = { target: { type: 'shop', niche: 'ecommerce', style: 'minimal' } } as any;
    const payload = buildIngestPayload(item, seoWith('gallery'), parts);
    expect(payload.type).toBe('shop');
    expect(payload.tags.find((t: any) => t.axis === 'type')?.slug).toBe('shop');
  });

  it('keeps the SEO-inferred type for non-shop targets', () => {
    const item = { target: { type: 'hero', niche: 'saas', style: 'bold' } } as any;
    const payload = buildIngestPayload(item, seoWith('features'), parts);
    expect(payload.type).toBe('features');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- ingest-payload-shop-type --run`
Expected: FAIL — `buildIngestPayload` is not exported (`does not provide an export named 'buildIngestPayload'`), or (once exported) the first case returns `'gallery'`.

- [ ] **Step 3: Export the function and pin the shop type**

In `pipeline/run.ts`, export `buildIngestPayload` (add `export` to `function buildIngestPayload` ~line 329):

```typescript
export function buildIngestPayload(
```

Then change the `type` assignment (~line 336) from:

```typescript
  const type = pins?.type ?? seo.axes.type;
```

to:

```typescript
  // `shop` is a structurally-determined type (the section contains divi/shop) —
  // pin it so the SEO classification step can't relabel it (which would strip the
  // shop facet + the "requires WooCommerce" badge). See pipeline/recipes/section-types.ts.
  const type = pins?.type ?? (target.type === 'shop' ? 'shop' : seo.axes.type);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- ingest-payload-shop-type --run`
Expected: PASS (both cases).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd layoutlab
git add pipeline/run.ts tests/ingest-payload-shop-type.test.ts
git commit -m "fix(pipeline): pin 'shop' layout type through ingest, guarding SEO reclassification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Catalog wiring — type axis, nav, preview skin (layoutlab)

**Files (under `layoutlab`):**
- Modify: `lib/catalog/filters.ts` (add `shop` to `AXIS_VALUES.type` ~line 2)
- Modify: `lib/nav/menu-data.ts` (add `shop` to the `type` axis of `AXIS_META` ~line 8, and to the label map ~line 56)
- Modify: `lib/preview/skin.ts` (add `shop` to `TYPE_TO_ARCHETYPE` ~line 20)
- Test: `tests/catalog-filters-shop.test.ts` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks (independent wiring).
- Produces: `shop` is a recognized `type` facet value everywhere in the web app — it survives `parseFilters`, the SEO axis clamp (`pipeline/seo.ts` clamps `type` to `AXIS_VALUES.type`, so `shop` layouts keep their type), the nav menu, and the preview skeleton.

**Note:** `layouts.type` is free `text` in `db/schema.ts` — no migration. Adding `shop` to `AXIS_VALUES.type` is what makes the SEO step (`pipeline/seo.ts:140`, `clampOne(axes.type, AXIS_VALUES.type, target.type, 'type')`) accept a model-proposed `shop` instead of treating it as out-of-enum.

- [ ] **Step 1: Write the failing test**

Create `tests/catalog-filters-shop.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AXIS_VALUES, parseFilters } from '@/lib/catalog/filters';
import { AXIS_META } from '@/lib/nav/menu-data';
import { skeletonForType } from '@/lib/preview/skin';

describe('shop type wiring', () => {
  it('is an allowed type axis value', () => {
    expect(AXIS_VALUES.type).toContain('shop');
  });

  it('survives parseFilters as a type facet', () => {
    const f = parseFilters({ type: 'shop' });
    expect(f.type).toEqual(['shop']);
  });

  it('has nav metadata (icon + blurb)', () => {
    expect(AXIS_META.type.shop).toBeDefined();
    expect(AXIS_META.type.shop.icon).toBeTruthy();
    expect(AXIS_META.type.shop.blurb).toBeTruthy();
  });

  it('maps to the grid preview archetype', () => {
    expect(skeletonForType('shop')).toBe('grid');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- catalog-filters-shop --run`
Expected: FAIL — `AXIS_VALUES.type` does not contain `shop`; `AXIS_META.type.shop` is undefined; `skeletonForType('shop')` returns `'hero'`.

- [ ] **Step 3: Add `shop` to the type axis**

In `lib/catalog/filters.ts`, add `'shop'` to the `type` array (line 2):

```typescript
  type: ['hero', 'pricing', 'testimonials', 'cta', 'features', 'cards', 'faq', 'footer', 'contact', 'gallery', 'blog', 'shop', 'full_landing'],
```

- [ ] **Step 4: Add nav metadata**

In `lib/nav/menu-data.ts`, add to the `type` object of `AXIS_META` (after the `blog` entry, before `full_landing`):

```typescript
    shop: { icon: 'storefront', blurb: 'WooCommerce product grids' },
```

And add to the label map (~line 56, the `full_landing: 'Full landing pages'` block):

```typescript
  shop: 'Shop / product grids',
```

- [ ] **Step 5: Add the preview archetype**

In `lib/preview/skin.ts`, add to `TYPE_TO_ARCHETYPE` (after the `blog: 'grid',` entry):

```typescript
  shop: 'grid',
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- catalog-filters-shop --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd layoutlab
git add lib/catalog/filters.ts lib/nav/menu-data.ts lib/preview/skin.ts tests/catalog-filters-shop.test.ts
git commit -m "feat(catalog): wire 'shop' type into facets, nav, and preview skin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: "Requires WooCommerce" buyer badge (layoutlab)

**Files (under `layoutlab`):**
- Create: `components/RequiresWooBadge.tsx`
- Modify: `app/(catalog)/layouts/[slug]/page.tsx` (render the badge under the `<h1>` ~line 106 when `layout.type === 'shop'`)
- Test: `tests/requires-woo-badge.test.tsx` (new)

**Interfaces:**
- Consumes: `layout.type` (already `'shop'` for these layouts after Tasks 3–4).
- Produces: a self-contained `<RequiresWooBadge />` component; the detail page shows it only for `shop` layouts.

**Note:** We drive the badge off `type === 'shop'` rather than a `requires-woocommerce` feature tag — the feature-tag axis is not currently wired into the pipeline (`pipeline/seo.ts` proposes only type/niche/style/colors), so keying on the type is the DRY, YAGNI signal. If a feature-tag subsystem is added later, the badge condition can move to it.

- [ ] **Step 1: Write the failing test**

Create `tests/requires-woo-badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequiresWooBadge } from '@/components/RequiresWooBadge';

describe('RequiresWooBadge', () => {
  it('tells the buyer WooCommerce is required and the grid shows their products', () => {
    render(<RequiresWooBadge />);
    expect(screen.getByText(/requires the woocommerce plugin/i)).toBeInTheDocument();
    expect(screen.getByText(/your store's own products/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- requires-woo-badge --run`
Expected: FAIL — `Cannot find module '@/components/RequiresWooBadge'`.

- [ ] **Step 3: Create the component**

Create `components/RequiresWooBadge.tsx`:

```tsx
/** Buyer-facing notice for `shop`-type layouts: the grid (divi/shop) is dynamic
 *  and renders the buyer's WooCommerce products, so the marketplace screenshot
 *  is a demo store. Shown on the layout detail page. */
export function RequiresWooBadge() {
  return (
    <div
      role="note"
      className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <span aria-hidden className="material-symbols-outlined text-base leading-5">storefront</span>
      <span>
        <strong>Requires the WooCommerce plugin.</strong> This grid displays your store's own
        products — the preview shows a demo store.
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- requires-woo-badge --run`
Expected: PASS.

- [ ] **Step 5: Render the badge on the detail page**

In `app/(catalog)/layouts/[slug]/page.tsx`, import the component near the other imports:

```tsx
import { RequiresWooBadge } from '@/components/RequiresWooBadge';
```

Then, immediately after the `<h1 …>{layout.title}</h1>` line (~line 106), add:

```tsx
        {layout.type === 'shop' && <RequiresWooBadge />}
```

- [ ] **Step 6: Typecheck + run the app test to confirm no regressions**

Run: `npm run typecheck && npm run test -- requires-woo-badge --run`
Expected: typecheck clean; test PASS.

- [ ] **Step 7: Commit**

```bash
cd layoutlab
git add components/RequiresWooBadge.tsx "app/(catalog)/layouts/[slug]/page.tsx" tests/requires-woo-badge.test.tsx
git commit -m "feat(catalog): show 'requires WooCommerce' badge on shop layout detail pages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Reproducible WooCommerce render-env setup (sibling repo)

**Files (under `../Divi 5 Deterministic Validator`):**
- Create: `scripts/setup-woocommerce.sh`

**Interfaces:**
- Consumes: the running render env (`divi5val_wpcli` container, `docker compose`).
- Produces: an idempotent script that installs + activates WooCommerce and imports the sample products, so the render env's Woo state is reproducible (not a one-off manual mutation). Task 7's render step depends on products existing.

**Note:** This captures the setup already applied manually during discovery. It must be idempotent (safe to re-run): skip the import if products already exist.

- [ ] **Step 1: Write the script**

Create `scripts/setup-woocommerce.sh`:

```bash
#!/usr/bin/env bash
# Install + activate WooCommerce and import the 16 sample products into the
# render env, so the divi/shop grid renders populated screenshots. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."

wpcli() { docker compose exec -T wpcli wp "$@"; }

echo "==> Ensuring WooCommerce is installed + active"
wpcli plugin install woocommerce --activate

echo "==> Ensuring the WordPress importer is available"
wpcli plugin install wordpress-importer --activate

count="$(wpcli post list --post_type=product --format=count 2>/dev/null || echo 0)"
if [ "$count" -ge 1 ]; then
  echo "==> $count products already present — skipping sample import (idempotent)"
else
  echo "==> Importing sample products"
  wpcli import /var/www/html/wp-content/plugins/woocommerce/sample-data/sample_products.xml --authors=create
fi

echo "==> Done. Product count: $(wpcli post list --post_type=product --format=count)"
```

- [ ] **Step 2: Make it executable and run it (verifies idempotency against the current env)**

Run:
```bash
cd "../Divi 5 Deterministic Validator"
chmod +x scripts/setup-woocommerce.sh
bash scripts/setup-woocommerce.sh
```
Expected: WooCommerce active; output ends with `Done. Product count: 18` and (since products already exist from discovery) the `skipping sample import (idempotent)` line.

- [ ] **Step 3: Commit**

```bash
cd "../Divi 5 Deterministic Validator"
git add scripts/setup-woocommerce.sh
git commit -m "chore(render): idempotent WooCommerce + sample-products setup script

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: End-to-end generation + render verification (layoutlab)

**Files:** none created — this is a verification task exercising the whole pipeline for the new type.

**Interfaces:**
- Consumes: Tasks 1–7 (validator whitelist, recipe grounding, `shop` type registration, type pinning, catalog wiring, buyer badge, render env with products).
- Produces: evidence that a `shop`-type section generates, validates, renders a populated grid, and is catalog-ready.

**Preconditions:** render env up (`make up` in the validator repo), `VALIDATOR_CMD` set, env sourced (`set -a; . ./.env.local; set +a`), web app running for ingest — per the standard pipeline run requirements.

- [ ] **Step 1: Generate one shop section (dry-run first to confirm the target resolves)**

Run:
```bash
cd layoutlab
set -a; . ./.env.local; set +a
npm run pipeline -- one --target=shop:ecommerce:minimal --dry-run
```
Expected: `[pipeline] one (dry-run) — 1 target(s)` with a `shop/ecommerce/minimal` target (confirms the type is generatable and not skipped as unsupported).

- [ ] **Step 2: Run it for real (generate → validate → render → ingest)**

Run:
```bash
npm run pipeline -- one --target=shop:ecommerce:minimal
```
Expected: the run generates a section containing `divi/shop`, it **passes validation** (no `UNKNOWN_MODULE_TYPE`), renders, and ingests. Watch the log for a `drop` line — a drop on validation means Task 1/2 grounding is off.

- [ ] **Step 3: Confirm the generated JSON contains `divi/shop` and validates standalone**

Run:
```bash
ls -t pipeline/out/layouts-json/*.json | head -1 | xargs grep -l "divi/shop"
```
Expected: prints the newest generated file path (it contains `divi/shop`).

- [ ] **Step 4: Eyeball the screenshot (mandatory visual review)**

Open the newest screenshot under `public/screenshots/` for the generated layout. Confirm: a populated product grid (real sample products with images and prices), a readable section heading, no blank/broken grid, no overlap. Per the project's visual-review discipline, do not proceed to prod sync on a broken render.

- [ ] **Step 5: Confirm it surfaces in the catalog as a shop layout**

With the web app running, visit `/browse?type=shop` and the layout's detail page. Confirm: it appears under the `shop` facet, and the detail page shows the **"Requires the WooCommerce plugin"** badge.

- [ ] **Step 6: Full regression — typecheck, lint, unit tests (both repos)**

Run:
```bash
cd layoutlab && npm run typecheck && npm run lint && npm run test -- --run
cd "../Divi 5 Deterministic Validator" && vendor/bin/phpunit
```
Expected: all clean/green.

- [ ] **Step 7: No commit** — this task produces verification evidence only (generated JSON + screenshots are gitignored per the render-env setup). Report the results (screenshot + validate/render logs) as the completion evidence for the feature.

---

## Notes & deferred items (from the spec)

- **v1 limitation — bare `divi/shop` only.** The generator emits `divi/shop` with default attributes (default columns/count/ordering). Configurable attributes (columns, product count, `type=recent|featured|sale`, category filter) require a second discovery export of a *configured* Shop module to learn its attribute schema — deferred follow-up, not part of this plan.
- **Out of scope:** single-product-page modules, full shop *pages* (section-first here), cart/checkout modules.

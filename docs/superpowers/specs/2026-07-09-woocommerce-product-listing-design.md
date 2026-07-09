# WooCommerce Product-Listing Layouts — Design

- **Date:** 2026-07-09
- **Status:** Approved for planning
- **Scope:** One new layout type — a reusable **product-grid section** built on Divi 5's WooCommerce **Shop** module (`divi/shop`).

---

## 1. Goal

Sell Divi 5 **product-listing sections** — a styled WooCommerce products grid a
buyer drops into any page. When imported into a site with WooCommerce active, the
grid renders the buyer's own products. These are **dynamic** layouts: our
marketplace screenshot shows our demo store; the buyer's catalog populates it on
their site.

**Sellable unit:** a reusable **section** (styled heading + `divi/shop` grid),
not a full page. It composes into larger pages later.

---

## 2. Discovery findings (ground truth)

Established empirically by installing WooCommerce + 18 sample products in the
render env (`divi5val_wp`, Divi 5.8.0, WooCommerce active), building a page in the
Divi 5 builder with the **Products** module, and reading its `post_content`.

- The WooCommerce products grid is the block **`divi/shop`**.
- It is a **leaf** module (self-closing), minimal attrs: `{"builderVersion":"5.8.0"}`.
- Wrapped in the normal `section → row → column` structure like any module.
- Running the real export through the deterministic validator produced exactly
  two violations, both from the missing allowlist entry:
  - `UNKNOWN_MODULE_TYPE` — `divi/shop` not in known types.
  - `UNEXPECTED_CHILD_TYPE` — `divi/shop` not an allowed child of `divi/column`.

This is the **entire** gap. No other Woo modules are needed for a listing page.

**Reference export** (validates once the validator is patched):

```
<!-- wp:divi/placeholder -->
<!-- wp:divi/section {"builderVersion":"5.8.0"} -->
<!-- wp:divi/row {"builderVersion":"5.8.0"} -->
<!-- wp:divi/column {"module":{"advanced":{"type":{"desktop":{"value":"4_4"}}}},"builderVersion":"5.8.0"} -->
<!-- wp:divi/shop {"builderVersion":"5.8.0"} /-->
<!-- /wp:divi/column -->
<!-- /wp:divi/row -->
<!-- /wp:divi/section -->
<!-- /wp:divi/placeholder -->
```

---

## 3. Non-negotiable constraints honored

- **Never reimplement the validator** (CLAUDE.md #1): we *extend* the real PHP
  validator's allowlist, additively. Same input → same verdict preserved.
- **Never ship un-validated layouts** (#2): shop sections pass through the normal
  validate gate after the allowlist patch.
- **No invented schema** (#3): `divi/shop` and its shape come from a real builder
  export, not memory.
- **No auto-live** is superseded by the project's current auto-approve behavior
  (memory: `layoutlab-auto-approve`) — shop sections follow the same ingest path
  as every other layout.

---

## 4. Components & changes

### 4.1 Validator extension — sibling repo `../Divi 5 Deterministic Validator`

Two additive edits to `src/SchemaRules.php` (canonical; loaded by
`scripts/validate.php` via autoload):

1. Add `'divi/shop'` to the known-module-types list.
2. Add `'divi/shop'` to the allowed-children arrays for **`divi/column`** and
   **`divi/column-inner`**.

Mirror the same two edits into `wp-plugin/validator/SchemaRules.php` (byte-identical
copy today — the plugin runtime uses it; keep them in sync).

**Fixtures + test:**
- `fixtures/valid/woo-shop-section.json` — the reference export from §2.
- A known-bad fixture (e.g. `divi/shop` placed as a direct child of `divi/section`,
  or a misspelled `divi/shopp`) proving the gate still bites for wrong usage.
- A PHPUnit case asserting valid→pass, bad→fail (mirrors existing validator test
  patterns).

**Interface contract:** input `{post_title, post_content}` → verdict. Unchanged.
Only the known set widens by one leaf module.

### 4.2 Generator — `layoutlab/pipeline/`

- Add a new section type **`shop`** in `pipeline/recipes/section-types.ts`.
- Add a grounded recipe so Claude emits a section containing a styled heading +
  `divi/shop`, grounded on the §2 reference export. Because `divi/shop` is a bare
  leaf, generation is near-templated: wrap `divi/shop` in `section/row/column` and
  let the model vary the surrounding heading/intro copy, spacing, and colors per
  brief (niche/style).
- The generated section MUST pass the (now-extended) validate gate before ingest —
  same gate as all types.

**v1 limitation (documented, not a blocker):** we only have the *bare* `divi/shop`
export, so v1 emits `divi/shop` with default attributes (default columns/count/
ordering). Richer configuration (columns, product count, `type=recent|featured|
sale`, category filter) requires a second discovery export of a *configured* Shop
module to learn its attribute schema. Deferred to a follow-up.

### 4.3 Render — `layoutlab/pipeline/render.ts`

No code change. The render env now has WooCommerce active + 18 sample products, so
the temp page built from `post_content` renders a populated grid. **Verification
step required:** render one generated shop section end-to-end and eyeball the
screenshot for a populated, non-broken grid (per memory `layoutlab-visual-review-flaws`,
always eyeball before prod sync).

**Render-env reproducibility:** script the WooCommerce install + sample-product
import via wp-cli so the render env's Woo state is reproducible, not a one-off
manual mutation (a `scripts/` helper in the validator repo or a documented step).

### 4.4 Catalog / taxonomy / buyer-facing — `layoutlab/`

- `lib/catalog/filters.ts` — add `shop` to the `type` axis array. (No DB migration:
  `layouts.type` is free `text`.)
- `lib/nav/menu-data.ts` — add `shop` icon + blurb + label (e.g. "Shop / product
  grids").
- `lib/preview/skin.ts` — map `shop` to a skeleton archetype (grid).
- **Feature tag `requires-woocommerce`** — attached to every shop layout (set in the
  SEO/taxonomy step or hardcoded for the `shop` type).
- **Buyer badge** — the layout detail page shows a clear notice for
  `requires-woocommerce` layouts: *"Requires the WooCommerce plugin — this grid
  displays your store's own products."* Sets expectations that the screenshot is a
  demo store.

### 4.5 Ingest / download

No structural change. Shop sections ingest like any layout (auto-approve path).
Downloaded JSON contains `divi/shop`; on a WooCommerce-active site it renders the
buyer's products. LICENSE bundling unchanged.

---

## 5. Testing strategy (TDD)

Write failing tests first, per CLAUDE.md §17.

- **Validator (PHP):** valid shop fixture passes; known-bad fails. (Sibling repo.)
- **Generator:** a generated `shop` section passes the extended validate gate
  (integration test invoking the real validator via `VALIDATOR_CMD`).
- **Taxonomy/catalog:** `shop` appears in the type facet; `requires-woocommerce`
  feature tag filters correctly.
- **Render smoke:** one shop section renders a non-blank, populated grid screenshot.
- **Ingest:** a `shop`-type payload ingests and surfaces in browse.

---

## 6. Out of scope (v1)

- Single-product-page modules (Add-to-Cart, Gallery, Price, Tabs, Reviews, etc.).
- Configured-grid attributes (columns/count/type/category) — needs a second
  discovery export.
- Full shop *pages* (hero + grid + supporting sections) — section-first; pages
  are a later assembly once the section recipe is proven.
- Cart/checkout modules.

---

## 7. Open questions

- None blocking. The configured-attribute schema (§4.2) is a known, deferred
  follow-up, not an open question for v1.

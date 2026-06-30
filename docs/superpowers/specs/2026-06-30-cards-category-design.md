# Cards Category — Design Spec

**Date:** 2026-06-30
**Status:** Approved (verbal), pending spec review

## Goal

Add a dedicated **"Cards"** layout category to Divi5Lab: grids of icon/numbered cards
(like the reference screenshots) generated as Divi 5 sections, browsable by column
count, with an animated card wrapper. Every generated card must render correctly on a
buyer's site (Divi-native icons, no external fonts).

## Why a new type (not a `features` variant)

`features` stays for general feature sections (alternating image+text, etc.). `cards`
is a distinct, browsable category organized by **column count**, which is what the user
asked for ("a new category called CARDS … Cards 2 columns, Cards 3 columns …"). It gets
its own Type facet entry, nav group, taxonomy pages, and a Columns sub-filter.

## Variant model

Stored in the existing `layouts.variant` jsonb (no DB migration — jsonb is schemaless;
only the TS type changes). Shape:

```ts
variant: {
  group?: string;                 // shared key across sibling variants (cross-linking)
  columns?: 2 | 3 | 4;
  icons?: 'none' | 'top' | 'left'; // icon PLACEMENT (existing field, reused)
  iconStyle?: 'circle' | 'plain' | 'number'; // NEW: badge treatment
}
```

`iconStyle` collapses two screenshot dimensions into one axis:
- `circle` — icon inside a colored circle/badge (screenshot 2)
- `plain` — bare icon (screenshots 3, 4)
- `number` — numbered step badge instead of an icon (screenshot 1)

**Full matrix per base** = columns(3) × placement(2: top, left) × iconStyle(3) =
**18 variants**. `group = "cards-<niche>-<style>"` links the 18 siblings.

## Card structure + hover animation

Each card is a **`divi/column`** styled as the wrapper (the user's request: "the flexed
columns are the wrapper with background, border radius, box shadow … transform on
hover"). The column contains a **`divi/blurb`** (Divi-native icon + heading + body) and
an optional CTA button.

Column (card) decoration:
- `background` (white, or a tint for dark/colored sets), `border.radius` (~16–24px),
  `spacing.padding` (~32–40px), subtle `boxShadow`.
- **Hover:** `decoration.transform.{bp}.hover.translate.y` (lift, e.g. -6px) and/or a
  slight scale, plus a deeper `boxShadow` hover value and a transition. All supported by
  the validator (`docs/STYLE.md`: `boxShadow`, `transform`, `.hover` values). Grounded on
  the existing `icon-values` recipe (already uses hover).

Mobile stacking is already handled by the existing `stackLayoutJsonMobile` pipeline step.

## Icons (fidelity)

Divi-native glyphs only — `divi/blurb`/`divi/icon` with `type:"divi"` or `type:"fa"`,
using the **known-good unicodes from the existing recipes** (`blurb-grid`, `icon-features`,
`icon-values`) so they never render as tofu on import. The prompt instructs the model to
choose icons matching each card's content from that palette, not to invent glyph codes.
`number` style is a number inside a styled circle (text/blurb + circular background +
`border.radius:50%`), not an icon module.

## Generation

Extend the existing `set` mode + `buildVariantSet`:
- `buildVariantSet(base, columns[], placements[], iconStyles[])` → cross-product of
  `Target`s, each with `variant` set and a `layout` phrase describing the combo
  ("3 equal columns of cards, icon on top in a colored circle, lifting on hover").
- CLI: `set --type=cards --niche=<n> --style=<s> --columns=2,3,4 --icons=top,left
  --icon-styles=circle,plain,number`.
- Add `cards` to `RECIPE_BY_TYPE` grounding on `icon-values` + `card-grid-3` +
  `blurb-grid`. Add a `cards` entry to `LAYOUTS_BY_TYPE` composition phrases.
- Prompt directives describe the card-wrapper styling + hover + icon placement/style +
  column count, and require Divi-native icons from the known palette.

**First run scope:** the full 18-variant matrix for **2 niches** (SaaS + coaching) ≈
**36 layouts**, then more `set` runs per niche on demand. (Adjustable.)

## Browse / SEO surfacing

- Add `cards` to `AXIS_VALUES.type` (filters), `TYPE_LABELS` + nav blurb (`menu-data.ts`),
  with nav entries for "Cards · 2 / 3 / 4 columns".
- Add a **Columns** filter axis (2/3/4) to the catalog filters + query + facet counts,
  backed by `variant.columns`. So `/browse?type=cards&columns=3` = "Cards 3 columns".
- Taxonomy/landing page for `/type/cards` via the existing programmatic SEO.
- Reuse the existing `VariantSwitcher` to cross-link sibling variants (same `group`) on
  detail pages — verify it surfaces columns/iconStyle siblings.

## Out of scope / non-goals

- No literal Material Icons font (would break on import).
- No new DB migration (jsonb shape change only).
- No `header`-style fake content — cards are real, functional Divi modules.

## Testing

- `buildVariantSet` produces the expected 18-combo matrix with correct `variant` values.
- New `cards` prompt directives include the wrapper/hover/icon-style/column instructions
  and the Divi-native-icon constraint.
- Catalog: `columns` filter parses + filters; `facetCounts` includes column counts for
  cards.
- `VariantSwitcher` query returns sibling variants by `group`.
- Existing suite stays green (filters/seed/sitemap include the new `cards` type).

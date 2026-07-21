# AI Editor — converter cross-promo (design)

**Date:** 2026-07-21 · **Repo:** `Divi 5 Deterministic Validator` (plugin only) · **Status:** Approved → implement

## Goal
Cross-promote JHMG's two Divi↔Elementor converter plugins inside the AI Editor
for Divi 5 admin, in two placements (compact on Dashboard, full on Upgrade/Account).

## Products (hardcoded; upstream source of truth = `layoutlab/lib/nav/menu-data.ts` PLUGIN_MENU)
1. **Elementor → Divi 5 Converter** — blurb "Migrate Elementor pages and kits into
   validated Divi 5."; chip `Free · Pro $25/yr`; CTA "Get it →";
   url `https://divi5lab.com/plugins/elementor-to-divi-5`.
2. **Divi → Elementor Converter** — blurb "Batch-convert Divi sites the other way —
   35+ modules mapped."; chip `Coming soon`; CTA "Join the waitlist →";
   url `https://divi5lab.com/plugins/divi-to-elementor`. (Not purchasable yet — waitlist.)

## Design
- `converterPromos(): array` — pure data helper returning the 2 products, each
  `['name','blurb','chip','cta','url']`. Comment names menu-data.ts as upstream.
- `converterPromoSection(bool $compact): void` — one renderer:
  - `$compact` (Dashboard, below "Recommended for you"): slim full-width
    "More Divi tools from JHMG" card, two compact inline items (name · chip · link).
  - `!$compact` (Upgrade/Account tab): `aied-section-title` + `aied-grid--2` of
    `aied-card`s (name, blurb, chip, CTA button).
- CSS: reuse existing `aied-*`; add one small `.aied-chip` pill.
- All output `esc_html`/`esc_url`/i18n (`ai-editor-divi5`); links `target="_blank" rel="noopener noreferrer"`.

## Tests (TDD, PHPUnit — same pattern as ConnectCardRenderTest)
`tests/ConverterPromoTest.php`:
- `converterPromos()` returns 2 items with the 5 keys.
- Rendered compact + full HTML: both product names; both divi5lab URLs; the
  `$25/yr` chip; Divi→Elementor shows the **waitlist** CTA (assert the phrase
  "waitlist" present and no buyable "$…/yr" attached to that product's block);
  external links carry `target="_blank"` and `rel="noopener`.

## Out of scope (YAGNI)
No license-aware hiding, no dismiss, no live fetch. Static, always shown.

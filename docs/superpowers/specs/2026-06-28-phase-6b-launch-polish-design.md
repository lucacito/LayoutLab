# Phase 6b — Launch Polish & Legal Pages — Design

**Status:** Approved (autonomous — "do all you can do") — 2026-06-28
**Roadmap:** CLAUDE.md §8/§12/§19 Phase 6 (launch polish).
**Predecessor:** Phase 6a (taxonomy landing pages) — complete, tagged `phase-6a-complete`.

---

## Goal

Fix the launch-blocking broken links and round out the storefront: build the
**`/license`** and **`/about`** pages (currently linked from the Header, Footer,
and sitemap but returning 404), and polish **`/pricing`** with free packs + an FAQ.

---

## Why now (the bug)

`components/site/Header.tsx` and `Footer.tsx` link to `/license` and `/about`, and
`lib/seo/sitemap.ts` lists both as static pages — but **neither route exists**, so
every one of those links 404s and the sitemap advertises dead URLs. This is a
concrete pre-launch defect, not just polish.

---

## Decisions (made autonomously)

1. **`/license`** renders the committed commercial license (`readLicense()` from
   `lib/license`, Phase 4b) verbatim, plus a **digital-goods refund policy**
   section (§12: "digital-goods refund policy stated on /license"). One page covers
   both. The refund text is a conventional instant-digital-delivery default the user
   can edit.
2. **`/about`** is a concise branded page (what LayoutLab is + the value prop),
   reusing the home page's primitives.
3. **`/pricing` polish:** add a **free packs** section (from `listPacks()` where
   `kind='free'`, linking to each pack's capture page) and an **FAQ** (licensing,
   refunds, formats, membership) below the existing tiers. Membership dollar amounts
   are NOT invented (the Stripe Price IDs aren't set yet) — the tier keeps its
   monthly/yearly subscribe CTAs.

---

## Components / units

### 1. `/license` — `app/(marketing)/license/page.tsx`
- Server page: `readLicense()` → render the license text in a monospace/`whitespace-pre-wrap`
  block inside a `Card`; a "Refunds" section with the digital-goods policy; `metadata`
  (title/description). `dynamic` not required (static content; no DB).
- A small `lib/legal/refund.ts` exporting `REFUND_POLICY` (the default text) so it's
  reusable (checkout copy later) and testable.

### 2. `/about` — `app/(marketing)/about/page.tsx`
- Server page: hero + a short value-prop section using `SectionTitle`/`Container`/
  `IconFeature`; `metadata`.

### 3. `/pricing` polish — `app/(catalog)/pricing/page.tsx`
- Add a **free packs** block: `listPacks()` filtered to `kind='free'`, each a `Card`
  with a "Get it free" link to `/packs/<slug>` (where the 5b capture form lives).
- Add an **FAQ** block: a small static `FAQ` array (question/answer) rendered as a
  list; include a JSON-LD `FAQPage` for SEO (new `faqJsonLd` helper in `lib/seo/jsonld.ts`).
- Keep the existing membership + paid-pack sections.

---

## Error handling

- `listPacks()` is wrapped in `try/catch` (as today) → empty sections on DB error,
  never a crash.
- `/license` + `/about` are static content — no failure modes beyond render.

---

## Testing strategy (TDD)

- **`/license`:** renders a "License" heading, the license body (a known phrase from
  the committed text, e.g. "COMMERCIAL LICENSE AGREEMENT"), and the "Refunds" section
  (a phrase from `REFUND_POLICY`).
- **`REFUND_POLICY`** is a non-empty exported string mentioning digital goods.
- **`/about`:** renders the brand name + a value-prop heading.
- **`/pricing`:** with mocked `listPacks` returning a free + a paid pack, the free
  pack appears with a `/packs/<slug>` link and the FAQ questions render; `faqJsonLd`
  emits `@type: FAQPage` with the questions.
- **Build:** `/license`, `/about`, `/pricing` compile; the Header/Footer/sitemap
  `/license` + `/about` links now resolve (no 404).

---

## Out of scope (later)

OG-image generation (needs real screenshots / Phase 3b), combo taxonomy pages,
analytics events, the perf pass, Stripe membership price display (needs the Price
IDs), and a full terms-of-service page.

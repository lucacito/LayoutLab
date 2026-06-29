# Phase 6c — Analytics & Funnel Events — Design

**Status:** Approved (autonomous — "continue 6c") — 2026-06-28
**Roadmap:** CLAUDE.md §15/§19 Phase 6 (analytics).
**Predecessor:** Phase 6b (launch polish) — complete.

---

## Goal

Instrument the storefront with **Vercel Analytics** + a **typed, consistently-named
funnel-event catalog** so traffic and conversion events are captured from day one:
product views → checkout started → purchase (Stripe-side), plus free-capture
submissions.

---

## Why now

§15: "keep events named consistently from day one." Retrofitting event names after
launch fragments the funnel data. The catalog + helper are cheap to add now and
expensive to reconcile later. (Vercel Analytics custom events only *report* in
production on Vercel; locally they no-op — the helper, catalog, and the fact that
components fire events are what we build + unit-test now.)

---

## Decisions (made autonomously)

1. **Vercel Analytics** (platform-native, §3). `<Analytics/>` mounted once in the
   root layout (auto page-views + Web Vitals); custom events via `track()`.
2. **A typed event catalog** (`lib/analytics/events.ts`) — `snake_case` event names
   as `const`, so names are uniform and refactor-safe. A thin
   `trackEvent(name, props?)` wrapper (`lib/analytics/track.ts`) around
   `@vercel/analytics`'s `track`, swallowing errors (never breaks the UI).
3. **Three custom funnel events** (page views are automatic):
   - `product_viewed` — fired on a layout or pack detail page (props: `kind`, `slug`).
   - `checkout_started` — fired when a `BuyButton` is clicked (props: `kind`, `packId?`, `plan?`).
   - `free_capture_submitted` — fired when the free-pack capture form is submitted (props: `packId`).
   The purchase/`order` completion is observed server-side via the Stripe webhook
   (4a) — not a client event here.

---

## Components / units

### 1. Foundation — `lib/analytics/{events,track,index}.ts` + `app/layout.tsx`
- `events.ts`: `ANALYTICS_EVENTS = { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } as const`; `type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]`.
- `track.ts`: `trackEvent(name: AnalyticsEvent, props?: Record<string, string | number | boolean | null>): void` → `try { track(name, props) } catch {}`.
- `index.ts`: re-exports.
- `app/layout.tsx`: render `<Analytics/>` (from `@vercel/analytics/react`) inside `<body>`.

### 2. Instrumentation
- **`components/BuyButton.tsx`** (already a client component): at the top of `go()`,
  `trackEvent('checkout_started', { kind, packId?/plan? })` before the fetch.
- **`components/TrackView.tsx`** (new `'use client'`): fires `trackEvent(event, props)`
  once on mount (`useEffect`, empty deps); renders `null`. Mounted on the layout +
  pack detail pages with `product_viewed` + the entity's kind/slug.
- **`components/FreePackForm.tsx`** → `'use client'` with `onSubmit` firing
  `free_capture_submitted` (props: `packId`) before the server action proceeds.

---

## Error handling

- `trackEvent` swallows any error (analytics must never break the page).
- In dev / non-Vercel, `track` is a no-op — the funnel is silent locally, by design.

---

## Testing strategy (TDD)

- **Unit:** `trackEvent` calls the underlying `@vercel/analytics` `track` with the
  exact name + props (mock the module); the catalog exposes the three event names.
- **Component:** `BuyButton` click fires `trackEvent('checkout_started', {...})` (with
  `trackEvent` mocked) before/around the checkout fetch; `TrackView` fires
  `trackEvent` once on mount with its event + props; `FreePackForm` submit fires
  `trackEvent('free_capture_submitted', { packId })`.
- **Build:** the app compiles with `<Analytics/>` mounted; the existing suite stays
  green (BuyButton + FreePackForm behavior otherwise unchanged).
- **Manual (prod-only):** after deploy, the Vercel Analytics dashboard shows page
  views + the three custom events as the funnel is exercised. (Local dev no-ops.)

---

## Out of scope (later)

GA4, a consent/cookie banner, server-side purchase-conversion events tied to the
webhook, combo-page analytics, and a custom events dashboard. Combo taxonomy pages
remain deferred (thin-content risk on the current catalog size).

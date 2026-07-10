# Work with us page (A2) — Design

**Date:** 2026-07-10
**Status:** Approved direction, pre-implementation
**Parent:** [Services-first pivot](2026-07-10-divi5lab-services-pivot-design.md) — Workstream A, item A2

---

## 1. Goal

A dedicated `/work-with-us` services page — the core conversion destination for
the funnel — that goes deeper than the homepage and ends in a qualifying quote
form. It replaces the current stopgap where the "Work with us" nav and every
"Get a free quote" CTA point at `/contact`.

## 2. Context / what already exists (reuse, don't duplicate)

- `ServicesOffer` (3 productized tiers) and `ServicesSteps` (how it works) —
  built in A1, reused here verbatim.
- `/api/contact` — rate-limited, zod-validated `{ name, email, message }` →
  `sendContactMessage` (email). Reused **unchanged**.
- `ContactForm` — the pattern the new `QuoteForm` follows.
- `PRIMARY_NAV` in `lib/nav/menu-data.ts` drives both desktop + mobile nav.

## 3. Decisions (locked)

- **Quote form = qualifying fields.** Name, email, business name, trade
  (HVAC / Roofing / Plumbing / Other), current website URL (optional), project
  type (Landing page / Full website / Site refresh / Not sure), message. The
  qualifying fields are **composed into the `message` string client-side** and
  POSTed to the existing `/api/contact` as `{ name, email, message }` — **no
  backend/schema/email change**, keeping the tested rate-limited endpoint.
- **Consolidate CTAs.** All "Get a free quote" CTAs and the "Work with us" nav
  point to `/work-with-us` (CTAs deep-link to `#quote`). `/contact` remains the
  general/support contact page (still in the footer).

## 4. Page structure (`/work-with-us`)

Server component (static, no DB) with page metadata + canonical. Sections:

1. **Hero** — headline ("Work with us — Divi 5 sites that get trades more
   calls"), subhead, primary CTA → `#quote`, secondary → `/browse` (See
   examples). Trust bar (reuse the A1 hero visual language).
2. **What's included** — deliverables grid (the concrete "what you get" the
   homepage only hints at): mobile-first design, click-to-call, quote/estimate
   form, trust bar (licensed/insured-ready), per-service pages, service-area /
   local-SEO ready, fast load, revisions included, **you own everything (no
   lock-in)**.
3. **Offer tiers** — reuse `ServicesOffer`.
4. **How it works** — reuse `ServicesSteps`.
5. **FAQ** — objection handling: timeline, what we need from you, do I own it,
   hosting, revisions, pricing/quotes. New `ServicesFaq` component (simple
   static Q&A list; page-scoped, not the catalog `FaqSection`).
6. **Quote form** (`id="quote"`) — `QuoteForm` + a short reassurance line
   ("Free quote, no obligation — we reply by email").

## 5. Components

- **Create `app/(marketing)/work-with-us/page.tsx`** — composes the sections;
  exports `metadata` (title, description, `alternates.canonical: '/work-with-us'`).
- **Create `components/services/WhatsIncluded.tsx`** — propless deliverables
  grid (`Container` + `SectionTitle` + `Icon` list).
- **Create `components/services/ServicesFaq.tsx`** — propless static Q&A
  (details/summary or simple stacked list). Services-specific copy.
- **Create `components/services/QuoteForm.tsx`** — `'use client'`. Fields per
  §3; on submit composes the qualifying fields into a `message` string and POSTs
  `{ name, email, message }` to `/api/contact`; sending/sent/error states mirror
  `ContactForm`.
- **Reuse** `ServicesOffer`, `ServicesSteps`.
- **Hero:** a small page-local `WorkHero` section (or inline in the page) — the
  A1 `ServicesHero` is homepage-specific copy, so this is separate but visually
  consistent.

### QuoteForm message composition (exact shape)

```
Business: <business or "—">
Trade: <trade>
Project: <projectType>
Current site: <website or "—">

<message or "(no message)">
```

POST body: `{ name, email, message: <composed string> }`. `name` + `email`
required; `message` textarea optional (compose always yields a non-empty string
so `/api/contact`'s `message.min(1)` passes).

## 6. CTA / nav repointing (consolidation)

- `lib/nav/menu-data.ts` — `PRIMARY_NAV` `work` href `/contact` → `/work-with-us`
  (updates both desktop `PrimaryNav` and `MobileNav`).
- "Get a free quote" CTAs `/contact` → `/work-with-us#quote` in:
  `components/site/Header.tsx`, `components/site/MobileNav.tsx`,
  `components/services/ServicesHero.tsx` (primary CTA only; "See examples" stays
  `/browse`), `components/services/ServicesOffer.tsx`,
  `app/(marketing)/page.tsx` (closing CTA), `components/site/AnnouncementBar.tsx`.
- `/contact` stays reachable via the footer (unchanged).

## 7. Testing

- `QuoteForm` (jsdom): renders all fields; on submit, `fetch` is called with
  `/api/contact` and a body whose `message` contains the composed qualifying
  lines (Business/Trade/Project/Current site); shows the confirmation on ok.
  (Mock `fetch` via `vi.stubGlobal`.)
- `WhatsIncluded`, `ServicesFaq`: render key items/questions.
- `/work-with-us` page: renders `<h1>`, the quote form, and reused sections.
- Update existing tests broken by the intended repoint: `primary-nav.test`
  (work → `/work-with-us`), `mobile-nav.test` (work + quote CTA →
  `/work-with-us`), `services-hero.test` (primary CTA → `/work-with-us#quote`),
  `services-offer.test` (quote CTA → `/work-with-us#quote`),
  `site-chrome.test` (header now links `/work-with-us`, not `/contact`).
- Full suite + `npm run typecheck` + `npm run build` green; visual smoke
  (desktop + mobile screenshot) before done.

## 8. Out of scope

- No `/api/contact` schema/email change (compose into `message`).
- No lead persistence of the structured fields (email body only) — revisit if
  attribution is wanted later.
- A3 portfolio, A4/A5, Workstream B — separate cycles.
- No new "budget" field (YAGNI; project type + message is enough to scope).

## 9. Success criteria

`/work-with-us` live; nav "Work with us" + all "Get a free quote" CTAs land on
it; submitting the quote form emails a qualified lead via `/api/contact`; full
suite + build green; renders correctly desktop + mobile.

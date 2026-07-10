# Divi5Lab — Services-First Pivot (Trades Niche) — Strategy & Build Plan

**Date:** 2026-07-10
**Status:** Approved direction, pre-implementation
**Owner:** Lucas

---

## 1. The problem we're solving

Divi5Lab today is a marketplace that sells AI-generated Divi 5 layouts (packs +
$8/$80 membership). It has ~193 published layouts on prod, live Stripe, a working
generation pipeline, and near-zero traffic and near-zero revenue.

**Root diagnosis:** selling generic layouts is structurally weak in the Divi
world. Elegant Themes ships 200+ *free* high-quality layout packs inside Divi
itself; established paid marketplaces (Divi Cake, Aspen Grove, Divi Den,
Pee-Aye Creative) already own the "polished pre-made pack" axis. A single
*section* has near-zero willingness-to-pay. Competing on layout volume is a
race we're behind in, against a free baseline.

**What we actually own that competitors don't:**

1. A pipeline that produces *validated, render-tested, import-ready* Divi 5
   layouts at near-zero marginal cost, **on demand / bespoke** — not just static
   packs.
2. Lucas's own builder's eye (catches the visual flaws the gates miss).
3. A growing SEO surface aimed at exactly the people who pay real money to have
   Divi sites built.

The strategic error was pointing all of that at an $8 product. The audience that
lands on Divi content spends **$500–$5,000** on a site, not $8.

---

## 2. Positioning

**Stop selling "layouts." Start selling "a great Divi site/page, delivered fast."**

- Layouts are *ammunition* (portfolio, lead magnets, delivery speed), not the
  product.
- The pipeline is the *delivery engine* that makes our speed and price
  unbeatable, and the *content engine* that feeds packs + SEO.

---

## 3. Constraints that shaped this plan

Decisions made during brainstorming (these are load-bearing — revisit before
changing course):

- **Business shape:** Both services and products, **services first** (services
  fund the runway; products are the long game and the funnel).
- **Traffic reality:** Basically zero. So the site is a *long-game asset*, not
  this month's income source.
- **Cold outreach:** No. Lucas would rather not cold-DM / cold-email. Plan must
  route around it — borrow other platforms' traffic instead.
- **Niche:** **Trades — HVAC / roofing / plumbing.** Committed for the first ~90
  days. Rationale: high ticket, high volume, notoriously bad existing sites,
  buyers care about *leads* (calls/quotes) over aesthetics — which makes value
  easy to prove and conversion-focused kits easy to build.

---

## 4. Two distinct customers (don't conflate them)

The pipeline serves both; the sales channels differ:

| | **Services client** | **Theme-pack customer** |
|---|---|---|
| Who | HVAC/roofing/plumbing business owner | Freelancer/agency who builds trades sites |
| Wants | More calls/quotes; a done site | A ready kit that saves 8 hours |
| Pays | $500–$3,000 per site | $49–$79 per kit |
| Found via | Fiverr/Upwork (borrowed traffic), referrals | Divi communities, SEO, our site |

---

## 5. The plan, in priority order

### Priority 1 — Immediate cash engine: Fiverr + Upwork productized gigs (weeks 1–4)

The honest fastest money with **no cold outreach and no traffic of our own**.
Buyers search inside the platform and are fed to us by *its* algorithm.

- **Why the pipeline wins here:** deliver in 24–48h what competitors take a week
  to do → faster delivery + more orders + better reviews → higher search rank →
  flywheel. We can also offer what others can't: a *free custom mockup before you
  buy*, or 3 variations same-day.
- **Gig strategy:**
  - Run at least one **broad** gig for search volume: "I will create a custom
    Divi 5 layout / landing page for your business" (this is Direction B —
    custom-layout-on-demand — which fits Fiverr like a glove and is high margin
    because the pipeline does ~80% of the work).
  - Position the **profile/portfolio around trades** so trades buyers convert
    hard while the broad gig catches everyone.
- **Deliverable target:** 1–3 paying builds/fixes in the first month.

### Priority 2 — Warm inbound: be the helpful Divi person (ongoing, low-ick)

The *opposite* of cold outreach. Show up in the big Divi Facebook groups, r/Divi,
Divi Discord and **answer people's questions**. Occasionally share a free layout.
The "can you just build this for me?" DMs come *to us*. Note: these communities
are mostly *Divi builders* (theme-pack customers + subcontract work), not trades
owners — so this channel primarily feeds pack sales and freelancer referrals.

### Priority 3 — Full site restructure: from store to services funnel (starts now, parallel)

**Decision (2026-07-10): full restructure now**, not a lean pass. The site is
re-architected from a marketplace into a services funnel. The catalog/taxonomy
is not deleted — it is *demoted* to a supporting lead-magnet + SEO asset. See
§7 for the new information architecture.

The website earns its keep as an *asset that closes*, not a store:

- Homepage becomes a **services sales page**, not a catalog showcase.
- Navigation flips from taxonomy mega-menu → services funnel (Work with us,
  Examples, Free layouts, **Get a free quote** CTA).
- Every client build → stripped into a **trades niche theme pack** (Direction C)
  → portfolio piece + SEO page + sellable product.
- **Exit-intent modal** + **scroll-triggered popup** point to the productized
  service + custom-layout offer and **capture emails** — not to $8 packs.
- SEO + niche packs slowly make the site our own traffic source, reducing
  dependence on Fiverr over time.

**Sequencing discipline:** a full restructure is weeks of work before it earns.
The restructure is the headline build, but the revenue engine (Fiverr gig kit +
pipeline fulfillment, §7 Workstream B) must move right behind it — a polished
services site with nothing to sell is still $0. The new homepage + portfolio
also double as sales collateral we link every Fiverr/community lead to, so the
restructure directly supports the revenue push.

---

## 6. Trades-specific product notes (what makes a trades kit convert)

Trades sites are judged on *leads*, not beauty. The theme pack + any client build
must lead with conversion elements:

- Sticky **click-to-call** button (mobile-first — trades traffic is majority
  mobile).
- **Quote/estimate form** in the hero, above the fold.
- **Trust bar:** licensed & insured, BBB, years in business, financing available,
  24/7 emergency service.
- **Service list** (e.g. AC repair, install, maintenance / roof repair, replace,
  inspection / drain, water heater, leak).
- **Service-area** section (local SEO signal + reassurance).
- **Reviews / star ratings** and **before/after gallery**.
- Financing / offers / seasonal promo band.

**Trades kit shape (multi-page):** Home, Services (+ per-service template),
About, Service Area, Reviews, Contact/Quote. This is the first niche pack to
build and doubles as portfolio + SEO.

---

## 7. What we'll actually build (executable scope)

Two parallel workstreams. **A (site restructure)** is the headline;
**B (revenue engine)** must not be starved behind it. Each numbered item is its
own plan/implementation cycle later.

### Workstream A — Full site restructure (store → services funnel)

**A0. New information architecture / navigation.**

From (store): a `Type ▾ / Niche ▾ / Style ▾ / Color ▾` mega-menu + a
"Browse layouts" primary CTA.

To (funnel):

```
Logo   Work with us   Examples   Free Divi layouts   [ Get a free quote ]   · Account
```

- **Work with us** → services/offer page (money page — new).
- **Examples** → portfolio/proof (real builds + theme-pack screenshots — new or
  repurposed catalog).
- **Free Divi layouts** → the *demoted* catalog, framed as a lead magnet with
  email capture; the taxonomy mega-menu lives inside here for SEO, not as the
  front door.
- **Packs / Membership** → demoted into a menu/footer. Stays live, no longer the
  headline.
- Primary CTA: **"Get a free quote"** (replaces "Browse layouts").

**A1. New homepage — services sales page** (replaces the catalog showcase):
1. Hero — outcome headline ("Divi websites that get HVAC/roofing/plumbing
   companies more calls"), primary CTA *Get a quote*, secondary *See examples*,
   trust bar.
2. The problem — "your current site isn't turning visitors into calls."
3. The offer — productized tiers (*Landing page · Full site · Refresh*, "from
   $X").
4. Proof — portfolio grid (real builds + trades theme pack).
5. How it works — brief → mockup → build → launch, fast (pipeline = the "fast").
6. Free lead-magnet band — free trades layouts → email capture (Loops).
7. FAQ + final CTA.

**A2. "Work with us" services/offer page** — the productized offer in full:
tiers, pricing/packaging, what's included, how it works, proof, quote CTA →
`/api/lead` (exists).

**A3. Portfolio / "Examples" system** — showcase real builds + theme packs as
proof (repurpose catalog components; not the taxonomy browse).

**A4. Catalog demotion + re-frame** — browse/taxonomy/packs stay live for SEO
but are re-framed as "Free Divi layouts" lead magnet; nav, headers, and CTAs
updated to route to the funnel, not the store. Footer/About/nav reworked.

**A5. Exit-intent modal + scroll-triggered popup** — site-wide, pointed at the
offer / free-layout capture (Loops), not $8 packs.

### Workstream B — Revenue engine (do NOT starve behind A)

**B1. Pipeline "brief → custom layout" delivery mode.** Turn a customer brief
(business, trade, service area, colors, sections) into a render-tested,
import-ready Divi 5 layout — a repeatable ~20-minute fulfillment flow. Engine
behind Fiverr custom orders *and* Direction B.

**B2. Trades niche theme pack** (multi-page, conversion-first per §6) via the
existing theme generator (`pipeline/theme.ts` + create-*-pack scripts). Sellable
pack + portfolio (feeds A3) + SEO.

**B3. Fiverr/Upwork gig kit** — offer definitions, pricing tiers, and sample
deliverables generated from the pipeline (mockups for the gig gallery).

The existing marketplace (generic packs + $80 membership) **stays live** as
low-effort lead capture — it costs nothing now — but is no longer treated as the
business.

---

## 8. Success criteria (first 90 days)

- **Weeks 1–4:** Fiverr/Upwork gigs live (Workstream B); ≥1 paying services
  client. New homepage + nav shipped (A0/A1) — the site *reads* as a services
  business, usable as sales collateral.
- **Weeks 2–8:** Full restructure landed (Work-with-us page, portfolio, catalog
  demotion, exit-intent + scroll popup — A2–A5); trades theme pack shipped
  (product + portfolio + SEO).
- **Month 2–3:** custom-layout-on-demand offer running through the pipeline
  fulfillment flow; ≥3 total paying clients; first inbound from communities/SEO.
- **North-star mindset shift:** we stop optimizing "$8 layout sales" and start
  optimizing "clients who need a Divi site delivered fast."

---

## 9. Explicitly out of scope / deprioritized

- **Cold outreach** of any kind (Lucas's call).
- Chasing generic layout-pack volume as a revenue line.
- Beautiful-but-crowded niches (med spa, real estate) for *now* — trades first.
  (Maison Verity RE assets stay parked, not deleted.)
- Paid ads — revisit only after the offer is validated by real Fiverr sales.

---

## 10. Open decisions (resolve as we execute)

- [ ] Exact Fiverr gig titles + pricing tiers (draft in the gig-kit step).
- [ ] Trades sub-focus for the first pack: HVAC vs roofing vs plumbing, or one
      flexible "trades" kit that reskins? (Lean: one flexible kit first.)
- [ ] Services offer pricing/packaging on the homepage (fixed-price productized
      tiers vs "get a quote").
- [ ] Whether custom-layout-on-demand is per-order (Fiverr) only, or also a
      subscription ("N custom layouts/month") — decide after first orders.
- [ ] "Examples"/portfolio: build fresh vs repurpose existing catalog components
      (`/browse`, layout cards) — lean toward repurpose.
- [ ] Restructure sequencing within Workstream A: homepage+nav first (A0/A1) as
      collateral, then A2–A5 — confirm during the implementation plan.

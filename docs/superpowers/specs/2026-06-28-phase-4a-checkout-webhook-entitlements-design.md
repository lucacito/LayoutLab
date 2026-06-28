# Phase 4a — Checkout + Webhook Fulfillment + Entitlements — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §12/§19 Phase 4, split: 4a = money path; 4b = downloads + account.
**Predecessor:** Phase 3.5 (storefront design) — complete, tagged `phase-3.5-complete`.

---

## Goal

Build the **money path**: a buyer (no login required) purchases a pack or an
all-access membership through Stripe Checkout; the **Stripe webhook is the single
source of truth** that provisions the buyer's account by email and writes a
durable **entitlement**. No access is ever granted from a client redirect. The
phase ends at "payment → provisioned user → durable entitlement"; gated downloads
and the account dashboard are Phase 4b.

This is money code: **tested first (TDD), server-authoritative, never trusts the
client, idempotent** (CLAUDE.md §2.8, §12, §16).

---

## Key decisions (resolved in brainstorm)

1. **Split:** 4a = entitlements logic + Checkout + webhook fulfillment. 4b =
   entitlement-gated downloads + account dashboard (purchases, re-downloads,
   billing portal).
2. **Guest checkout by email.** No login required to buy. The webhook
   **find-or-creates a `users` row by the Stripe customer email** and binds the
   order/entitlement to it. The buyer later signs in with that email to access
   downloads (dev stub now; magic-link auth in Phase 5). This decouples
   *purchasing* from the password-less-login limitation — buying works in
   production even before real auth lands.
3. **Pre-created Stripe Prices per pack.** A `scripts/stripe-setup.ts` idempotently
   creates a Product + Price per published paid pack in the sandbox and backfills
   `packs.stripe_price_id`. Membership uses `STRIPE_PRICE_MEMBERSHIP_MONTHLY` /
   `_YEARLY` env price ids.
4. **Webhook auto-provisions the user by email** (interpretive call, accepted).
5. **`automatic_tax` (Stripe Tax) enabled on sessions**, with graceful degrade:
   if Tax isn't configured in the sandbox, the session falls back to no
   automatic tax rather than failing (interpretive call, accepted).

### Scope boundaries (deferred to 4b)

Entitlement-gated **downloads** (`GET /api/download/[layoutId]` → signed Blob
URL), the **account dashboard** (purchases, re-downloads, Stripe billing portal),
and free-pack email-capture entitlements (Phase 5). 4a builds the entitlements
*logic* (the SSOT function) but enforces it only in 4b.

---

## Architecture & data flow

```
Buyer (no login)
  │  clicks Buy (pack) / Subscribe (membership) on /packs/[slug] or /pricing
  ▼
POST /api/checkout            (zod-validated, rate-limited)
  │  resolves the price SERVER-SIDE from the DB/env — never from the client
  │  builds a Stripe Checkout Session: mode=payment (pack) | subscription (membership),
  │  automatic_tax, metadata { kind, packId|plan }, success/cancel URLs
  ▼  returns { url } → client redirects to Stripe-hosted checkout
Stripe  (collects payment + email)
  │
  ▼  Stripe → POST /api/stripe/webhook    (signature verified or 400)
  │  idempotent: record the event id first; skip if already processed
  │  checkout.session.completed:
  │     findOrCreateUserByEmail(email)
  │     mode=payment    → record order + grant entitlement(scope='pack:<id>')
  │     mode=subscription → upsert subscription + grant entitlement(scope='all_access', expiresAt=period_end)
  │  invoice.paid / customer.subscription.updated|deleted → keep subscription status + all_access expiry current
  ▼
entitlements (durable grant)            orders / subscriptions (records)
```

`/checkout/success` shows "payment received — we're provisioning your access"
and instructs the buyer to sign in with their email. **It does not read or grant
entitlements** (the webhook may not have fired yet, and access is never granted
client-side).

---

## Components / units

### 1. Schema additions — `db/schema.ts` + migration
- **`stripe_events`** (`id` text PK = Stripe event id, `type` text, `created_at`)
  — webhook idempotency ledger (insert-first, skip on conflict).
- **Unique index** on `entitlements(user_id, scope)` — defense-in-depth against
  double grants.
- **Unique index** on `subscriptions(stripe_subscription_id)` and on
  `orders(stripe_checkout_id)` — idempotent fulfillment.

### 2. Stripe client — `lib/stripe/client.ts`
- `stripe` SDK singleton from `STRIPE_SECRET_KEY` (pinned apiVersion). Server-only.

### 3. Product/price setup — `scripts/stripe-setup.ts`
- Idempotently creates a Product + one-time Price (`unit_amount = price_cents`,
  currency usd) per published **paid** pack lacking a `stripe_price_id`;
  backfills `packs.stripe_price_id`. Prints the membership price-id env hints.
  Run via `npm run stripe:setup`.

### 4. Entitlements SSOT — `lib/stripe/entitlements.ts`
- **`canDownloadLayout(input): boolean`** — pure. A layout is downloadable if any
  of: the user holds `pack:<id>` for a pack the layout belongs to; OR an active
  (non-expired) `all_access`; OR the layout's pack is free AND the user has a
  matching email capture (the free path is wired in Phase 5; the function accepts
  it now). Inputs are plain data (`{ layoutPackIds, packKindsById, userEntitlements, freeCapturedPackIds }`).
- Helpers: `isActiveAllAccess(entitlement, now)`, `entitlementForPack(packId)`.
- Exhaustively unit-tested — this is the gate's heart.

### 5. Checkout — `lib/stripe/checkout.ts`, `app/api/checkout/route.ts`
- **`buildCheckoutSessionParams(input, ctx)`** — pure: returns the Stripe session
  params for `{ kind:'pack', packId }` (mode payment, the pack's price) or
  `{ kind:'membership', plan:'monthly'|'yearly' }` (mode subscription, env price),
  with `automatic_tax`, `metadata`, `customer_email?`, success/cancel URLs.
  Unit-tested for correct mode/price/metadata per kind.
- **`POST /api/checkout`** — zod-validate body → resolve price server-side (pack
  from DB, membership from env) → `stripe.checkout.sessions.create(params)` →
  `{ url }`. 400 on invalid input / unknown pack / missing price. Rate-limited.

### 6. Fulfillment — `lib/stripe/fulfillment.ts`, `app/api/stripe/webhook/route.ts`
- Pure-ish handlers (DB injected for testability):
  - `findOrCreateUserByEmail(email): userId`
  - `fulfillCheckoutCompleted(session)` — pack → order + `pack:<id>` entitlement;
    membership → subscription + `all_access` entitlement.
  - `syncSubscription(sub)` — status + `all_access` expiry from
    `customer.subscription.updated|deleted` / `invoice.paid`.
  - All idempotent (event-id ledger + unique constraints + `onConflictDoNothing`).
- **`POST /api/stripe/webhook`** — read the raw body, `stripe.webhooks.constructEvent`
  with `STRIPE_WEBHOOK_SECRET` (400 on bad signature) → record event id (skip if
  seen) → dispatch to the handler → 200. Errors are logged and return 500 so
  Stripe retries.

### 7. Storefront wiring
- **`/pricing`** (real page, replacing the CTA stub): published paid packs +
  the all-access membership (monthly/yearly), each with a Buy/Subscribe button.
- **Buy button** on `/packs/[slug]` (replace the `/pricing` stub link): a small
  client component POSTing to `/api/checkout` then `window.location = url`.
- **`/checkout/success`** and **`/checkout/cancel`** pages.

---

## Error handling & money-safety

- **Server resolves every price** (pack from DB, membership from env). The client
  sends only an identifier (`packId` / `plan`); a client-sent amount is never
  trusted. (§2.8)
- **Webhook signature verified**; bad/missing signature → 400, nothing written.
- **Idempotent everywhere:** the `stripe_events` ledger skips replays; unique
  constraints + `onConflictDoNothing` prevent duplicate orders/subscriptions/
  entitlements even if an event is delivered twice. (§2.7-style)
- **No client-side grants:** `/checkout/success` never writes entitlements.
- **Rate-limit** `/api/checkout` and the webhook. zod on `/api/checkout` input.
- **Stripe Tax graceful degrade:** if `automatic_tax` errors because Tax isn't set
  up in the sandbox, retry once without it (logged) so dev isn't blocked.
- **Secrets server-only:** `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` never in
  the client bundle; only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public.

---

## Testing strategy (TDD — test first, money code)

- **Pure unit (no network/DB):**
  - `entitlements.ts` — every branch (owns pack, active vs expired all_access,
    free-pack-with-capture, none).
  - `buildCheckoutSessionParams` — pack → mode payment + pack price + metadata;
    membership monthly/yearly → mode subscription + env price; success/cancel urls.
  - `fulfillment` handlers — fed **committed Stripe event JSON fixtures**
    (`checkout.session.completed` for a pack and for a membership, a
    `customer.subscription.updated`, a `deleted`), assert the exact DB writes via
    an injected fake db, and assert **idempotency** (same event twice → one set of
    rows).
- **Integration (gated on `POSTGRES_URL`):** webhook → real DB writes the right
  rows; replaying the same event id writes nothing new; `findOrCreateUserByEmail`
  upserts.
- **Manual acceptance (your test keys + Stripe CLI):**
  1. `npm run stripe:setup` → creates pack Prices, backfills ids; create the two
     membership Prices, put their ids in `.env.local`.
  2. `stripe listen --forward-to localhost:3000/api/stripe/webhook` → copy the
     `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
  3. Buy a pack with test card `4242…` → webhook provisions the user + grants
     `pack:<id>` (verify in the DB). Subscribe → grants `all_access`.
- CI: pure unit + fixtures run everywhere; DB-gated webhook tests skip without a
  DB; no live Stripe calls in CI.

---

## Prerequisites (user-provided)

- **Stripe test keys** — already in `.env.local` (publishable + secret).
- **`STRIPE_WEBHOOK_SECRET`** — from `stripe listen` (acceptance only).
- **Membership Price IDs** — created in the sandbox; put in `.env.local`
  (acceptance only).
- The **Stripe CLI** for local webhook forwarding (acceptance only).

## Out of scope for 4a

Downloads + signed Blob URLs, the account dashboard + Stripe billing portal,
free-pack email capture (Phase 4b / Phase 5), refunds tooling, and real
password/magic-link auth (Phase 5).

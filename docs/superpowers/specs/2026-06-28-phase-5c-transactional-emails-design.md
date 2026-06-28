# Phase 5c — Transactional Emails (one-click receipt) — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §12/§14/§19 Phase 5 (transactional email). Pricing polish deferred.
**Predecessor:** Phase 5b (free-pack capture) — complete, tagged `phase-5b-complete`.

---

## Goal

Close the post-purchase gap: after a (guest) checkout, email the buyer a **purchase
receipt with a one-click sign-in link** that drops them straight on their downloads.
Reuses the gated `lib/email` sender (5a) and the existing webhook fulfillment.

---

## Key decisions (resolved in brainstorm)

1. **Embed a one-click magic link in the receipt.** A server-only helper mints an
   Auth.js-compatible verification token and link; clicking it uses Auth.js's real
   email callback to sign the buyer in and redirect to `/account/downloads`. The
   webhook already created their user + entitlement by email, so it just works.
2. **Scope: transactional emails only**, plus the two deferred webhook hardenings
   (email lowercase-normalize on user write + a shared `findOrCreateUserByEmail`
   helper). **Pricing-page polish is out** (a later pass).

---

## The magic-link mechanism (verified against next-auth 5.0.0-beta.31 / @auth/core)

Auth.js's email flow (`@auth/core/lib/actions/signin/send-token.js`,
`.../callback/index.js`): the token row stores `SHA-256(`${rawToken}${secret}`)`
where `secret = config.secret = process.env.AUTH_SECRET` (a string —
`next-auth/lib/env.js:22`); the sign-in URL is
`${origin}/api/auth/callback/email?callbackUrl=…&token=<raw>&email=<identifier>`;
the callback re-hashes the raw token, matches the row by hash, requires
`invite.identifier === email`, single-uses it, then issues a (JWT) session and
redirects to `callbackUrl`.

`createMagicSignInUrl(email, callbackPath)` reproduces exactly this:
1. `token = randomBytes(32).toString('hex')`.
2. `hashed = createHash('sha256').update(`${token}${process.env.AUTH_SECRET}`).digest('hex')`
   (node crypto — byte-identical to Auth.js's Web-Crypto SHA-256 hex).
3. Insert `verification_tokens { identifier: normalizedEmail, token: hashed, expires: now + 24h }`.
4. Return `${NEXT_PUBLIC_SITE_URL}/api/auth/callback/email?` +
   `URLSearchParams({ callbackUrl: `${NEXT_PUBLIC_SITE_URL}${callbackPath}`, token, email: normalizedEmail })`.

**Coupling is contained in this one helper** (a comment cites the exact `@auth/core`
files) and pinned by the exact-version `next-auth` (5a). The manual acceptance
(click → signed in) is the verification gate. Single-use + 24h expiry come for free.

---

## Architecture & data flow

```
Stripe webhook → handleStripeEvent → case 'checkout.session.completed':
  │  …existing: findOrCreateUserByEmail → linkStripeCustomer → grants…
  │  try {
  │    await store.notifyPurchase({ email, kind: 'pack'|'membership', packId?, amountCents? })
  │  } catch (err) { console.error('receipt email failed', err) }     ← best-effort
  ▼  markEventProcessed  (unchanged)

store.notifyPurchase(input):
  · signInUrl = createMagicSignInUrl(input.email, '/account/downloads')
  · packTitle = input.packId ? (select packs.title where id) : undefined
  · { subject, html, text } = purchaseReceiptEmail({ kind, packTitle, amountCents, signInUrl })
  · sendEmail({ to: input.email, subject, html, text })   (Resend prod / console dev)
```

`notifyPurchase` is called ONLY in `checkout.session.completed` (the purchase
moment) — not in `customer.subscription.*` (avoids welcome-spam on renewals/updates).
Email is best-effort so a send failure never throws into the webhook → Stripe does
not retry → no double grants/emails.

---

## Components / units

### 1. Magic sign-in URL — `lib/auth/sign-in-url.ts`
- `interface SignInUrlDeps { storeToken(identifier: string, hashedToken: string, expires: Date): Promise<void>; now?(): Date; }`
- `createMagicSignInUrl(email: string, callbackPath: string, deps: SignInUrlDeps): Promise<string>`
  — normalizes the email, generates a token, hashes it with `AUTH_SECRET`, stores
  the hash, returns the callback URL with the raw token. Throws if `AUTH_SECRET` is
  unset.
- `signInUrlDeps: SignInUrlDeps` — the real impl inserting into `verification_tokens`.

### 2. Receipt email — `lib/email/receipt.ts`
- `purchaseReceiptEmail(input: { kind: 'pack' | 'membership'; packTitle?: string; amountCents?: number; signInUrl: string }): { subject: string; html: string; text: string }`
  — pure builder. A clear "Access your downloads" button → `signInUrl`; shows the
  pack title (or "All-access membership") and the amount. The `signInUrl` appears in
  both html and text.

### 3. Shared user upsert — `lib/users/find-or-create.ts`
- `findOrCreateUserByEmail(email: string): Promise<string>` — normalizes the email
  (`trim().toLowerCase()`), select-or-insert `users`, return the id. Replaces the
  duplicated copies in `lib/stripe/fulfillment-store.ts` and `lib/capture/store.ts`
  (both import this; behavior unchanged except normalization).

### 4. notifyPurchase — `lib/stripe/fulfillment.ts` (interface) + `fulfillment-store.ts` (impl)
- Add to `FulfillmentStore`:
  `notifyPurchase(input: { email: string; kind: 'pack' | 'membership'; packId?: string; amountCents?: number }): Promise<void>`.
- Call it in `handleStripeEvent`'s `checkout.session.completed` branch, after the
  grants, inside `try/catch` (log on failure). For the pack branch pass
  `{ email, kind: 'pack', packId, amountCents }`; for membership
  `{ email, kind: 'membership' }`.
- Real impl: `createMagicSignInUrl(email, '/account/downloads', signInUrlDeps)` →
  resolve pack title → `purchaseReceiptEmail(...)` → `sendEmail(...)`.

---

## Error handling

- **Email/link failure** (Resend down, missing key in dev, token insert error) →
  caught in `handleStripeEvent`, logged, never thrown → the event is still marked
  processed; Stripe does not retry; grants are unaffected.
- **Keyless dev** → `sendEmail` logs the receipt (incl. the sign-in URL) to the
  console; the flow is fully testable locally.
- **Expired/used link** → Auth.js's standard verification error → `/login` (the
  buyer can request a fresh link there; their entitlement persists).
- **Membership renewals/updates** → no email (notify only on checkout).

---

## Testing strategy (TDD)

- **Unit:** `createMagicSignInUrl` with an injected `storeToken` — asserts the URL
  contains `/api/auth/callback/email`, the raw `token`, the `email`, and the
  `callbackUrl`, and that `storeToken` got `SHA-256(token+secret)` (set a known
  `AUTH_SECRET` in the test). `purchaseReceiptEmail` — contains the `signInUrl`
  (html + text), the pack title / "All-access membership", and the amount.
  `findOrCreateUserByEmail` normalization (pure-ish; the select/insert behavior is
  covered by existing fulfillment/capture suites staying green).
- **Fulfillment:** extend the existing `handleStripeEvent` test's mock store with a
  `notifyPurchase` spy; assert it's called once for a pack checkout and once for a
  membership checkout (with the right args), NOT on `customer.subscription.*`, and
  that a `notifyPurchase` that REJECTS does not fail `handleStripeEvent` (event
  still marked processed).
- **Integration (gated on `POSTGRES_URL`):** `signInUrlDeps.storeToken` inserts a
  `verification_tokens` row; `findOrCreateUserByEmail` upserts + normalizes.
- **Manual acceptance:** a Stripe test purchase (pack) → the dev console logs the
  receipt with the sign-in URL → open it → land signed-in on `/account/downloads`
  with the pack unlocked. (With `RESEND_API_KEY` set, the email is delivered.)

---

## Out of scope (later)

Pricing-page polish, Stripe-side receipt configuration, double-opt-in, dunning/
past-due emails, and a shared-store rate limiter.

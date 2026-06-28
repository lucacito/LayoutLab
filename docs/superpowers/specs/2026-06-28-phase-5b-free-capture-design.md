# Phase 5b — Free-Pack Email Capture — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §6/§8/§14/§19 Phase 5, second half (free packs + Loops).
**Predecessor:** Phase 5a (magic-link auth) — complete, tagged `phase-5a-complete`.

---

## Goal

Turn free packs into working lead magnets: a visitor enters their email on a free
pack, we **capture + sync to Loops**, **grant a free entitlement**, and **email a
magic sign-in link**; they click it and download the pack from their account. No
new download path — it reuses the 5a magic-link auth and the 4b download flow.

---

## Key decisions (resolved in brainstorm)

1. **Magic-link-verified free flow.** Capture grants a `pack:<id>` entitlement
   (`source:'free'`) and triggers `signIn('email', …)`. The emailed link both
   verifies the address (good for the Loops list) and signs the user in; the
   existing 4b download route then serves the pack. **No download without inbox
   control.** Because `canDownloadLayout` already honors any `pack:<id>`
   entitlement regardless of source, **nothing in the download SSOT changes** and
   the dormant `freeCapturedPackIds` param stays unused.
2. **Scope: the capture flow only.** Purchase-receipt/download-link transactional
   emails and pricing-page polish are Phase 5c.
3. **Loops gated (keyless dev).** With `LOOPS_API_KEY`, sync the contact; without
   it (dev), log + mark `loops_synced=false` and never throw. Same pattern as
   Resend/Stripe.

---

## Architecture & data flow

```
Free-pack page → FreePackForm (email) → server action captureFreePackAction(packId, formData)
  │  captureFreePack({ email, packId }, deps):
  │    1. getFreePack(packId)  → reject if not found / not kind='free' / not published
  │    2. recordCapture(email, packId)            → email_captures row
  │    3. syncContact({ email, packId })          → Loops (gated); returns { synced }
  │       → update the capture row's loops_synced
  │    4. findOrCreateUserByEmail(email)          → userId (reuses the 4a helper)
  │    5. grantFreeEntitlement(userId, packId)    → entitlements(pack:<id>, 'free'), idempotent
  │  signIn('email', { email, redirectTo: '/account/downloads' })   ← sends the magic link
  ▼  → /verify-request → user clicks → /account/downloads → download (4b route, unchanged)

Programmatic: POST /api/capture { email, packId }  → zod + rate-limit → captureFreePack → { ok }
  (capture + Loops + entitlement only; sign-in is the on-site form's job)
```

Emails are **normalized to lowercase** at the capture entry point (folds in the
deferred 4b/5a case-mismatch nit for this path; the webhook-side normalization
stays Phase 5c to avoid touching the money path here).

---

## Components / units

### 1. Loops client — `lib/email/loops.ts`
- `syncContact(input: { email: string; source?: string; packId?: string }): Promise<{ synced: boolean }>`
  — with `LOOPS_API_KEY`: `POST https://app.loops.so/api/v1/contacts/update`
  (create-or-update) with `Authorization: Bearer`; returns `{ synced: true }`.
  Without a key (dev): `console.log` + `{ synced: false }`. Never throws on a
  missing key; on a network/API error, logs + returns `{ synced: false }` (capture
  must not fail because Loops is down).

### 2. Rate limiter — `lib/rate-limit/index.ts`
- `rateLimit(key: string, opts: { limit: number; windowMs: number; now?: number }): { ok: boolean; remaining: number }`
  — in-memory fixed-window counter (best-effort; per-instance). Documented as a
  stopgap to be replaced by a shared store (Vercel KV/Upstash) — §16. Pure enough
  to unit-test with an injected `now`.

### 3. Capture orchestration — `lib/capture/capture.ts`
- `normalizeEmail(email: string): string` — `email.trim().toLowerCase()`.
- `CaptureDeps` — injected: `getFreePack(packId) → { id } | null` (returns a value
  ONLY for a published `kind='free'` pack), `recordCapture(email, packId) → captureId`,
  `setCaptureSynced(captureId, synced)`, `syncContact`, `findOrCreateUserByEmail(email) → userId`,
  `grantFreeEntitlement(userId, packId) → void` (idempotent).
- `captureFreePack(input: { email: string; packId: string }, deps: CaptureDeps): Promise<{ ok: true; email: string }>`
  — runs steps 1–5; throws `CaptureError('not_free')` when `getFreePack` returns
  null. Unit-tested with mocked deps (non-free rejected; happy path calls record →
  sync → setSynced(result) → user → grant; idempotent grant; Loops failure still
  succeeds with `loops_synced=false`).

### 4. Real deps + DB helpers — `lib/capture/store.ts`
- Concrete `CaptureDeps` over Drizzle: `getFreePack` (select published free pack by
  id), `recordCapture`/`setCaptureSynced` (email_captures), reuse
  `findOrCreateUserByEmail`, `grantFreeEntitlement` (insert entitlements
  `onConflictDoNothing` on `entitlements_user_scope_uq`).

### 5. Server action — `lib/capture/actions.ts` (`'use server'`)
- `captureFreePackAction(packId: string, formData: FormData): Promise<void>` —
  read `email`, `captureFreePack({ email, packId }, realDeps)`, then
  `signIn('email', { email, redirectTo: '/account/downloads' })`. On a
  `CaptureError`, `redirect` back to the pack with an error flag (no throw to the
  user).

### 6. API route — `app/api/capture/route.ts`
- `POST` — zod `{ email: string().email(), packId: string() }`; `rateLimit` by IP
  (e.g. 5/min) → 429; `captureFreePack(…, realDeps)` → `{ ok: true }`; 422
  `not_free` on `CaptureError`; 400 on a bad body. `runtime='nodejs'`.

### 7. UI — `components/FreePackForm.tsx` + `app/(catalog)/packs/[slug]/page.tsx`
- `FreePackForm({ packId })` — branded email form whose `action` is
  `captureFreePackAction.bind(null, packId)`. Replaces the placeholder
  `<Button href="/pricing">Get this pack</Button>` in the pack page's `free`
  branch.

---

## Error handling

- **Not a free/published pack** → 422 (`route`) / redirect-with-error (`action`).
  No capture row, no entitlement.
- **Loops missing key or failure** → capture + entitlement still succeed;
  `loops_synced=false`. The free download never depends on Loops.
- **Re-capture (same email+pack)** → idempotent: a second capture row may be
  recorded (audit), but the entitlement grant is a no-op (unique `user+scope`).
- **Over the rate limit** → 429 (route).
- **Unverified email** → the magic link is the verification; until clicked, the
  user has an entitlement but no session, so cannot download.

---

## Testing strategy (TDD)

- **Unit (no network/DB):** `syncContact` (no-key → `{synced:false}`+log, no fetch;
  with-key → fetch called with bearer + email; API error → `{synced:false}`).
  `rateLimit` (allows `limit`, then blocks; window resets with injected `now`).
  `captureFreePack` with mocked deps (reject non-free; happy path ordering;
  idempotent grant; Loops-down still ok). `normalizeEmail`.
- **Route (mocked deps):** `POST /api/capture` → 400 bad body, 429 over limit, 422
  not-free, 200 ok.
- **Component:** `FreePackForm` renders an email input + submit, bound to the
  action.
- **Integration (gated on `POSTGRES_URL`):** `lib/capture/store` grant is
  idempotent; `getFreePack` rejects paid/unpublished.
- **Manual acceptance:** on a seeded **free** pack page, enter an email → redirected
  to `/verify-request`; the dev console logs the magic link (and a Loops dev log) →
  click the link → land on `/account/downloads` → the free pack's layouts are
  listed and downloadable. A **paid** pack page still shows Buy, not the form.

---

## Out of scope (5c / later)

Purchase-receipt + download-link transactional emails, pricing-page polish,
webhook-side email normalization, a shared-store rate limiter, and double-opt-in
/ Loops list-segmentation niceties.

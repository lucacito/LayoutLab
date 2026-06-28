# Phase 4b — Entitlement-gated Downloads + Account Dashboard — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §12/§19 Phase 4, second half (4a = money path, done). This completes Phase 4.
**Predecessor:** Phase 4a (checkout + webhook + entitlements) — complete, tagged `phase-4a-complete`.

---

## Goal

Let buyers actually get their files: an **entitlement-gated download endpoint** that
streams a zip of the layout JSON + the commercial license, and an **account
dashboard** where signed-in users see purchases, re-download anytime, and manage
billing through the Stripe customer portal. The 4a entitlements SSOT
(`canDownloadLayout`) is the gate; this phase enforces it.

---

## Key decisions (resolved in brainstorm)

1. **Delivery: proxy through the gated API.** `GET /api/download/[layoutId]`
   checks the entitlement server-side, then streams the file as an attachment.
   The JSON is never reachable without an entitlement, regardless of Blob being
   public (no private-Blob/signed-URL infra change in this phase). (§2.5)
2. **Bundle: a zip of `<slug>.json` + `LICENSE.txt`** per download (jszip). The
   license always travels with the file. (§12; resolves the §21 open question.)
3. **License text: user-provided** (`lib/license/commercial-license.txt`), the
   exact text the user supplied, with the `[Your Name / Company Name]` ownership
   placeholder filled as **Lucas Lopvet** to match the copyright line. (Not legal
   advice; the user can edit the file anytime — no code change needed.)

### Scope boundaries

- **Free-pack email-capture downloads** → Phase 5 (the `free` path in
  `canDownloadLayout` accepts captured packs, wired when capture ships).
- **Private Blob + signed URLs** → future (the proxy enforces the gate now).
- **Real auth:** downloads/account require a signed-in user — works locally via
  the Phase-0 dev login stub; production needs the Phase 5 real auth. (Buying
  already works in production via 4a guest checkout.)

---

## Architecture & data flow

```
Signed-in user → GET /api/download/[layoutId]
  │  requireUser()                         → redirect /login if not signed in
  │  load layout (published) + its pack context {packIds, packKindById}
  │  load the user's entitlements (+ Phase 5: free email-captured packIds)
  │  canDownloadLayout({...})              → 403 if not entitled        ← the 4a SSOT gate
  │  fetchAsset(layout.diviJsonBlobKey)    → 404 if the JSON isn't available
  │  buildLayoutZip(json, slug, license)   → zip { <slug>.json, LICENSE.txt }
  │  insert downloads row (userId, layoutId, ip)   ← audit
  ▼  Response: application/zip, Content-Disposition: attachment; filename="<slug>.zip"

Account (all requireUser):
  /account            dashboard: greeting + active-subscription status + links
  /account/purchases  orders + entitlements
  /account/downloads  entitled layouts, each → /api/download/[id] (re-download anytime)
  /account/billing    button → POST /api/billing/portal → Stripe customer portal
```

---

## Components / units

### 1. Auth — `lib/auth/admin.ts` (extend)
- `userGateDecision(session): 'ok' | 'unauthenticated'` (pure).
- `requireUser(): Promise<Session>` — `auth()` → `redirect('/login')` if not
  signed in, else returns the session. (Sibling of the existing `requireAdmin`.)

### 2. License — `lib/license/commercial-license.txt`, `lib/license/index.ts`
- The committed license text (user-provided).
- `readLicense(): string` — reads the file (server-only).

### 3. Asset fetch — `lib/blob/index.ts` (extend)
- `fetchAsset(key: string): Promise<Buffer | null>` — if `key` is an absolute URL
  or a Blob key, `fetch` it; if it's a local path (e.g. `pipeline/out/<hash>.json`),
  read the file; return `null` when the asset doesn't exist (→ route 404).

### 4. Zip — `lib/download/zip.ts`
- `buildLayoutZip(layoutJson: string, slug: string, license: string): Promise<Buffer>`
  — pure (jszip); produces a zip containing `<slug>.json` and `LICENSE.txt`.
  Unit-tested (unzip → both entries present with the right content).

### 5. Entitlement context — `lib/account/queries.ts`
- `getLayoutPackContext(layoutId): { packIds: string[]; packKindById: Record<string,'free'|'paid'> }`
  — the layout's packs + their kinds (feeds `canDownloadLayout`).
- `getEntitlementsForUser(userId): UserEntitlement[]`.
- `getOrdersForUser(userId)`, `getActiveSubscription(userId)`.
- `getDownloadableLayouts(userId): LayoutRow[]` — layouts in owned packs, OR all
  published layouts if the user has active `all_access`.

### 6. Download route — `app/api/download/[layoutId]/route.ts`
- `GET` per the flow above: `requireUser` → context + entitlements →
  `canDownloadLayout` (403) → `fetchAsset` (404) → `buildLayoutZip` → record
  download → stream the zip. `runtime='nodejs'`.

### 7. Stripe billing portal — `lib/stripe/portal.ts`, `app/api/billing/portal/route.ts`
- `createBillingPortalSession(customerId, returnUrl): Promise<string>` —
  `stripe.billingPortal.sessions.create`.
- `POST /api/billing/portal` — `requireUser` → look up `users.stripeCustomerId`
  → create portal session → `{ url }`. 400 if the user has no Stripe customer.

### 8. Account pages — `app/(account)/account/*`
- `/account`, `/account/purchases`, `/account/downloads`, `/account/billing`,
  each calling `requireUser()` and rendering with the brand primitives. A small
  client `DownloadButton`/`BillingButton` where a fetch+redirect is needed.

---

## Error handling

- Not signed in (download or account) → redirect `/login`.
- Signed in but not entitled → `403` (download route) / the layout simply doesn't
  appear in `/account/downloads`.
- Entitled but the JSON asset is missing (seed layouts carry placeholder
  `diviJsonBlobKey`s; only pipeline-generated layouts have real files) → `404`
  `asset_unavailable`, not a crash.
- No Stripe customer on the user → billing portal returns `400` with a clear
  message (e.g. a free-only or not-yet-purchased account).
- Every successful download writes a `downloads` row (audit; future rate-limit).

---

## Testing strategy (TDD)

- **Pure unit:** `userGateDecision`; `buildLayoutZip` (unzip → `<slug>.json` +
  `LICENSE.txt` present, correct bytes); the pack-context → `canDownloadLayout`
  mapping for owned / all-access / not-entitled.
- **Integration (gated on `POSTGRES_URL`):** `getDownloadableLayouts` (owned vs
  all-access), `getEntitlementsForUser`; the download route returns 403 for a
  non-entitled user and a zip for an entitled one (using a real local pipeline
  JSON or a fixture asset).
- **Manual acceptance:** buy a pack (4a) → sign in with that email → `/account/
  downloads` lists it → download the zip (contains JSON + LICENSE) → a layout the
  user doesn't own 403s; `/account/billing` opens the Stripe portal.
- CI: pure unit + zip run everywhere; DB/Stripe paths gated/skipped.

---

## Out of scope

Free-pack email capture + capture-based downloads (Phase 5), private Blob/signed
URLs, real password/magic-link auth (Phase 5), refund tooling, and download
rate-limiting (the `downloads` audit table is created/populated now; enforcement
later). This phase completes the Phase 4 commerce arc.

# Free Individual Downloads (email-gated) — Design

**Status:** Approved (user-directed model change) — 2026-06-29
**Predecessor:** Phase 4b (entitlement-gated downloads), 5b (free-pack capture), 5c (transactional emails).
**Branch:** phase-6d-previews (free-first redesign + this model change).

---

## Goal

Adopt the **"individual layouts free, packs paid"** model: any single published
layout is **free to download**, gated only by a **quick inline email capture**
(lead-gen). Login and paid entitlements are no longer required for a single
layout. **Packs and all-access membership remain the paid SKUs** (the bundle /
convenience / bulk value).

---

## Model change vs CLAUDE.md §2

§2 says "Downloads require a valid entitlement" and "Free-pack downloads require a
captured email." This change makes **every individual layout free** (so no
individual layout is "paid layout JSON"), gated by a **captured email** — which is
exactly the §2 bar for free content. PAID content is now only **packs / all-access
membership**; those still require entitlement (enforced when the paid pack-bundle
download is built — a follow-up). The asset is still served through the **gated
proxy route** (never a public URL).

---

## Decisions

1. **Gate = inline email capture, not login.** Enter email → it's recorded +
   synced to Loops → a **signed, httpOnly cookie** marks the visitor as
   email-captured → the download proceeds. No magic-link round-trip (lowest
   friction). A signed cookie (HMAC with `AUTH_SECRET`) keeps most downloads
   tied to a real captured email without trivial forging.
2. **Signed-in users skip the email form** (their session already proves an
   email). Entitled/owner users likewise.
3. **All individual published layouts are free** — the download route no longer
   checks `canDownloadLayout`/entitlements for single layouts. (`canDownloadLayout`
   stays in the codebase for the future **paid pack-bundle** download.)
4. **Keep the existing free-pack flow (5b) unchanged** — that path still grants a
   pack entitlement + magic link. This change adds the lighter single-layout path.

---

## Architecture & flow

```
Layout detail page (server) reads the signed capture cookie:
  ├─ captured (or signed-in)  → render a direct "Download free" link → GET /api/download/[id]
  └─ not captured             → render an inline email form (server action)
                                  → captureAndDownloadAction(layoutId, {email})
                                     · recordLeadCapture(email)  (email_captures + Loops sync)
                                     · setCaptureCookie(email)   (signed, httpOnly, ~30d)
                                     · redirect → GET /api/download/[id]   (cookie now present)

GET /api/download/[layoutId]  (runtime nodejs):
  · rate-limit by IP (abuse guard)
  · load published layout                       → 404 if missing
  · gate: capturedEmail(cookie) || session.user → else 403 { email_required }
  · fetchAsset(diviJsonBlobKey)                 → 404 if absent (seed placeholders)
  · buildLayoutZip(json, slug, LICENSE)         · recordDownload(userId|null, id, ip)
  ▼ stream application/zip (attachment <slug>.zip)
```

---

## Components / units

### 1. Capture cookie — `lib/capture/cookie.ts`
- `signCapture(email, secret): string` / `verifyCapture(value, secret): string | null`
  — pure HMAC-SHA256 sign/verify (`<b64url(email)>.<hex hmac>`); `verify` returns
  the email iff the signature matches (constant-time compare). Unit-tested.
- `setCaptureCookie(email): Promise<void>` — `cookies().set('ll_capture', signed,
  { httpOnly, secure(prod), sameSite:'lax', maxAge: 60*60*24*30, path:'/' })`.
- `readCaptureEmail(): Promise<string | null>` — read + verify the cookie.
- (Cookie I/O via `next/headers`; the crypto is the tested part.)

### 2. Lead capture — `lib/capture/lead.ts`
- `recordLeadCapture(email: string): Promise<void>` — normalize (`normalizeEmail`),
  insert an `email_captures` row (`packId: null`), `syncContact({ email,
  source:'free_download' })` (best-effort), set `loops_synced`. Never throws on a
  Loops failure (capture must not block the download).

### 3. Server action — `lib/capture/download-actions.ts`
- `captureAndDownloadAction(layoutId: string, formData: FormData): Promise<void>`
  (`'use server'`) — read+normalize email; if empty/invalid → `redirect` back to the
  layout with `?capture=error`; else `recordLeadCapture(email)` →
  `setCaptureCookie(email)` → `redirect('/api/download/' + layoutId)`.

### 4. Download route — `app/api/download/[layoutId]/route.ts` (rewrite the gate)
- Drop `requireUser` + the `canDownloadLayout`/entitlement check.
- `rateLimit('dl:' + ip, { limit: 40, windowMs: 60_000 })` → 429.
- Gate: `const email = await readCaptureEmail(); const session = await auth();`
  `if (!email && !session?.user) return 403 { error: 'email_required' }`.
- `userId = session.user?.email ? getUserIdByEmail(...) : null` (for the audit row).
- Keep: published-layout 404, `fetchAsset` 404, `buildLayoutZip`, `recordDownload`,
  zip stream. `runtime='nodejs'`.

### 5. Layout detail UI — `app/(catalog)/layouts/[slug]/page.tsx` + `components/FreeDownloadGate.tsx`
- Page reads `readCaptureEmail()` (server) and `auth()`; passes `captured` (bool) to
  a `FreeDownloadGate({ layoutId, slug, captured })` rendered prominently under the
  title.
- `FreeDownloadGate`: if `captured` → a pill **"Download free"** `<a
  href="/api/download/[id]" download>`; else an inline email `<form
  action={captureAndDownloadAction.bind(null, layoutId)}>` (email input +
  "Get it free" button) with a small "Free · no account needed" note.

---

## Error handling & security

- Loops down / missing key → capture still succeeds (cookie set, download proceeds);
  `loops_synced=false`.
- Cookie forged/invalid → `verifyCapture` returns null → treated as not-captured
  (the page shows the email form; the route 403s `email_required`).
- Rate-limit on the download route (scraping guard) + the capture path; every
  download writes a `downloads` audit row (userId may be null for anonymous
  captured visitors — the column is nullable).
- Asset is only ever served through the gated route (no public URL); secrets
  (`AUTH_SECRET` for signing) stay server-only.

## Out of scope (follow-ups)

- **Paid pack-bundle download** (one zip per owned pack, gated by entitlement /
  `canDownloadLayout`) — the paid value; build next.
- Double-opt-in, captured-email → account linking, `/account/downloads` changes,
  per-layout `email_captures.layoutId` column (record with `packId: null` for now).

---

## Testing strategy (TDD)

- **Unit:** `signCapture`/`verifyCapture` round-trip + reject tampered/foreign-secret
  values; `recordLeadCapture` orchestration with mocked deps (records + Loops +
  setSynced; Loops failure still resolves).
- **Route (mocked deps):** `/api/download/[id]` → 403 `email_required` when neither
  cookie nor session; 200 zip when a valid capture cookie is present; 200 when
  signed-in without a cookie; 404 for unknown layout / missing asset; recordDownload
  only on success; 429 over the rate limit.
- **Component:** `FreeDownloadGate` renders the email form when `!captured` and a
  direct `/api/download/[id]` link when `captured`.
- **Build + full suite** stay green (the 4b download-route tests are updated to the
  new gate; the 5b free-pack flow is untouched).
- **Manual:** open a layout → enter email → file downloads + a row in
  `email_captures`; reload the layout → now a direct "Download free" button (cookie
  set); hitting `/api/download/[id]` with no cookie + no session → 403.

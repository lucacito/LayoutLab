# Phase 2 — Ingest API + Admin Queue — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §19, Phase 2
**Predecessor:** Phase 1 (data model & read-only catalog) — complete, tagged `phase-1-complete`

---

## Goal

Give layouts a way **into** the catalog and a **human gate** before they go live.
A trusted producer (the Phase 3 pipeline, or a manual `curl` now) POSTs a
validated layout to a token-protected ingest API, where it lands as `pending`.
An admin signs in, reviews the queue, and with one click approves & publishes it
— at which point the Phase 1 catalog (published-only) shows it. Provable
end-to-end in Phase 2 by manually POSTing a sample layout and approving it.

Definition of done (CLAUDE.md §20): tests written first and passing, typecheck +
lint clean, no secrets in the client bundle, ingest + admin auth enforced
server-side, verification output shown.

---

## Key decisions (resolved in brainstorm)

1. **Admin access via env email allowlist.** `ADMIN_EMAILS` (comma-separated)
   lists admin emails. The allowlist drives the `role='admin'` assignment in the
   Auth.js JWT callback, so the existing `isAdmin(session)` helper is reused
   unchanged. Real password auth / user management stays in Phase 4/5.
2. **One-click approve = publish immediately.** The queue's primary action sets
   `status='published'` + `publishedAt=now`, so the layout appears in the catalog
   at once. `Reject` (→ `rejected`) and `Unpublish` (→ `approved`, de-listed but
   retained) are also provided. The `approved` status remains in the schema but is
   not a required stop on the happy path.
3. **Ingest auth via bearer token.** `Authorization: Bearer <INGEST_API_TOKEN>`.
   `INGEST_API_TOKEN` becomes required for this route (it stays optional in the
   global env schema for other phases; the route checks it is configured).
4. **Idempotent on `content_hash`.** A duplicate POST does not create a second
   row or error — it returns the existing record. (CLAUDE.md §2.7.)
5. **Quality gate re-checked at ingest.** The route rejects any payload not marked
   `validatorPassed === true`. (CLAUDE.md §2.2, §16.) Phase 2 trusts the boolean
   flag — it does NOT re-run the validator (that runs in the Phase 3 pipeline).

### Scope boundaries (deferred, by design)

- **The pipeline that calls ingest** → Phase 3. Phase 2 proves ingest with a
  manual `curl` + a committed sample payload.
- **Real password auth / user management** → Phase 4/5. The allowlist is the v1
  admin gate.
- **Dedupe admin view / perceptual-hash near-duplicate flagging** → Phase 3+.
- **Rate-limiting** the ingest route — the bearer token is the gate; the
  rate-limited public endpoints (`/api/capture` etc.) arrive in their phases.

---

## Architecture & data flow

```
producer (Phase 3 pipeline | manual curl)
   │  POST /api/ingest   Authorization: Bearer <INGEST_API_TOKEN>
   ▼
app/api/ingest/route.ts
   │  1. bearer token check        → 401 if missing/wrong
   │  2. zod IngestPayload parse    → 422 if invalid
   │  3. require validatorPassed    → 422 if not true
   │  4. insert status='pending', idempotent on content_hash
   │  5. (optional) attach tag slugs via layout_tags
   ▼
layouts (status='pending')        ── invisible to the public catalog
   ▲
admin (session email ∈ ADMIN_EMAILS)
   │  /admin/queue → server action approveLayout(id)
   ▼
layouts (status='published', publishedAt=now)
   ▼
Phase 1 catalog queries (published-only) → layout is live
```

**Visibility split:** catalog queries (`lib/catalog/queries.ts`) return only
`published` rows. Admin queries (`lib/admin/queries.ts`) see **all** statuses.
These are deliberately separate modules so the public path can never accidentally
surface `pending`/`rejected` content.

**Auth split:** `middleware.ts` provides a coarse redirect (unauthenticated →
`/login`) for `/admin/:path*`; the authoritative admin check (`requireAdmin()`)
runs server-side in every admin page and every server action. Never trust the UI
or middleware alone (CLAUDE.md §16).

---

## Components / units (each independently testable)

### 1. Admin auth — `lib/auth/`
- **`lib/env.ts`** — add `ADMIN_EMAILS` (optional string) to the schema;
  document in `.env.example`.
- **`isAdminEmail(email: string | null | undefined): boolean`** — pure; parses
  `ADMIN_EMAILS`, case-insensitive, trims. Unit-tested.
- **JWT callback (`lib/auth/config.ts`)** — when a user signs in, set
  `token.role = isAdminEmail(user.email) ? 'admin' : 'user'`. `isAdmin(session)`
  (already exists) then reports admin correctly.
- **`requireAdmin(): Promise<Session>`** — server helper; `auth()` →
  `redirect('/login')` if not signed in, `notFound()`/forbidden if signed in but
  not admin. Used by admin pages and actions.
- **`middleware.ts`** — matcher `/admin/:path*`; redirect to `/login` when no
  session. (Coarse gate; `requireAdmin` is authoritative.)

### 2. Ingest API — `app/api/ingest/route.ts`, `lib/ingest/schema.ts`
- **`lib/ingest/schema.ts`** — zod `IngestPayload`: `slug`, `title`,
  `description?`, `type`, `niche?`, `style?`, `colors: string[]`,
  `diviJsonBlobKey`, `previewImageKeys: string[]`, `contentHash`,
  `perceptualHash?`, `validatorPassed: boolean`, `seo?` (metaTitle,
  metaDescription, ogImageKey?, keywords?[]), `tags?: { axis, slug }[]`.
  Exports `parseIngestPayload(raw): Result`. Pure, unit-tested.
- **`parseBearer(header: string | null): string | null`** — pure; extracts the
  token from an `Authorization: Bearer x` header. Unit-tested.
- **`POST` handler** — orchestrates: token check (401) → parse (422) →
  `validatorPassed` gate (422) → idempotent insert as `pending`
  (`onConflictDoNothing` on `content_hash`, then read-back) → optional tag
  attach → JSON `{ id, status, deduped }` (201 new / 200 deduped). DB paths
  integration-tested; pure helpers unit-tested.

### 3. Admin queue — `app/admin/`, `lib/admin/`, `components/admin/`
- **`lib/admin/queries.ts`** — `listLayoutsByStatus(status)`,
  `statusCounts()`. All-status reads (admin only).
- **`lib/admin/actions.ts`** — server actions, each `requireAdmin()` then
  `revalidatePath` of the affected catalog routes:
  - `approveLayout(id)` → `published` + `publishedAt=now`
  - `rejectLayout(id)` → `rejected`
  - `unpublishLayout(id)` → `approved` (de-listed, retained)
  - `bulkApprove(ids: string[])` → all to `published`
- **`app/admin/layout.tsx`** (or per-page) — calls `requireAdmin()`.
- **`app/admin/page.tsx`** — dashboard: status counts + links.
- **`app/admin/queue/page.tsx`** — pending list: inline preview thumbnail +
  metadata, Approve / Reject per row, bulk-select → Bulk Approve.
- **`components/admin/`** — `QueueTable` / `QueueRow`, `ApproveButton` /
  `RejectButton` (client, invoke server actions), `BulkApproveBar` (client).
  Client components import only the server actions, never DB modules directly.

### 4. Sample + docs
- **`tests/fixtures/sample-ingest.json`** — a valid sample payload
  (`validatorPassed: true`, placeholder preview URLs).
- A documented `curl` (in the plan / a short `docs` note) for the manual
  acceptance walkthrough: POST → approve → live.

---

## Error handling

- **Ingest:** missing/bad bearer → `401`. Malformed JSON or schema violation →
  `422` with the zod issues. `validatorPassed !== true` → `422` (`reason:
  'not_validated'`). Duplicate `content_hash` → `200 { deduped: true }` (not an
  error). `INGEST_API_TOKEN` not configured server-side → `500` (misconfiguration,
  logged) — never silently accept.
- **Admin:** unauthenticated on `/admin/*` → redirect `/login`. Authenticated but
  not in allowlist → forbidden (404/redirect, not a silent empty page). Server
  actions re-check `requireAdmin()` and throw if not admin — the UI button is
  never the gate.
- **Mutations:** acting on a non-existent id → no-op with a surfaced error, not a
  crash. After any status change, `revalidatePath('/browse')` (and the affected
  detail route) so the catalog reflects it.

---

## Testing strategy (TDD — test first)

- **Unit (no DB, pure):** `isAdminEmail` (allowlist parsing, case/whitespace,
  empty), `parseBearer`, `parseIngestPayload` (valid / missing required /
  `validatorPassed:false` rejected / extra-field handling).
- **Integration (gated on a real DB, skips without one):** ingest route — 401 bad
  token, 422 invalid + 422 un-validated, 201 creates `pending`, 200 idempotent on
  duplicate `content_hash`; admin actions — `approveLayout` flips to `published`
  and sets `publishedAt`, `rejectLayout`/`unpublishLayout` transitions,
  `requireAdmin` denies a non-admin session.
- **e2e smoke (gated on a seeded DB):** POST the sample fixture → sign in as an
  allowlisted admin → `/admin/queue` shows it → Approve → `/browse` shows it and
  `/admin/queue` no longer does.
- CI stays green: pure unit tests run everywhere; DB-gated tests skip without
  `POSTGRES_URL` (matching the Phase 1 convention).

---

## Out of scope for Phase 2

The generation pipeline (Phase 3), real password auth / OAuth / user management
(Phase 4/5), Stripe/commerce, free-pack capture, perceptual-hash dedupe admin
view, pack-assembly admin tools, and taxonomy landing pages. All have later
phases.

# Download notifications + admin emails page — design

**Date:** 2026-07-02
**Status:** Approved (design), pending implementation
**Area:** `app/api/download`, `app/admin`, `lib/notify`, `lib/admin`, `db/`

## Problem

The owner has no visibility into activity: (1) no notification when a layout is
downloaded, and (2) no UI to see captured emails or download activity — captures
live only in the `email_captures` table and downloads in the `downloads` table.
Additionally, anonymous (email-capture) downloads record `user_id = null` and do
not store the email that gated them, so the captured email cannot be shown in
download activity.

## Decisions (from brainstorming)

- **Notification:** an immediate email to the owner (ADMIN_EMAILS) per download.
- **Admin page:** list captured emails AND recent download activity. (No CSV
  export, no Loops-synced column in v1.)
- **Schema:** add a nullable `email` column to `downloads` so the downloader's
  email (session or captured) is recorded and shown.

## Feature A — Email per download

New `lib/notify/download.ts`:

```
notifyDownload(input: {
  layoutTitle: string; slug: string; downloader: string; ip: string;
}): Promise<void>
```

- Recipients: `ADMIN_EMAILS` (comma-separated env). If empty/unset → no-op
  (resolves without sending).
- Sends one email per recipient via the existing `sendEmail({ to, subject, html,
  text })` (`lib/email/resend.ts`). Subject: `New download: {layoutTitle}`. Body
  (html + text): layout title + slug, downloader, IP, and a timestamp.
- **Never throws.** Wrap the send so a Resend failure resolves quietly (logged
  server-side). A notification failure must not affect the download.

Wire into `app/api/download/[layoutId]/route.ts`:

- After the zip is built and `recordDownload(...)` runs, resolve the downloader
  string = `sessionEmail ?? capturedEmail ?? 'guest'`, then
  `await notifyDownload({ layoutTitle: layout.title, slug: layout.slug,
  downloader, ip })` inside a `try/catch` (belt-and-suspenders — `notifyDownload`
  already swallows, but the route must return the zip regardless).

## Feature B — `/admin/emails` page

New `app/admin/emails/page.tsx` (server component):

- Gated with `requireAdmin()` (same as other admin server actions/pages).
- Linked from the admin dashboard (`app/admin/page.tsx`) nav alongside the queue.
- Two tables, each newest-first:
  1. **Captured emails** — from `listEmailCaptures()`: email, source (pack title
     if `pack_id`, else `—`), captured date.
  2. **Download activity** — from `listRecentDownloads(limit = 100)`: layout
     title, downloader email (the new `downloads.email`, or `—`), IP, date.

New queries in `lib/admin/queries.ts`:

```
listEmailCaptures(): Promise<{ email: string; packTitle: string | null; createdAt: Date }[]>
listRecentDownloads(limit?: number): Promise<{ layoutTitle: string; email: string | null; ip: string | null; createdAt: Date }[]>
```

- `listEmailCaptures` left-joins `packs` for the title; orders by `created_at desc`.
- `listRecentDownloads` joins `layouts` for the title; orders by `created_at desc`,
  limited (default 100).

## Schema change

Add to the `downloads` table (`db/schema.ts`): `email: text('email')` (nullable).
Generate a Drizzle migration and apply it. Update:

- `recordDownload(userId, layoutId, ip, email?)` (`lib/account/queries.ts`) — write
  the new column. The added parameter is optional/nullable so existing callers and
  logged-out flows are unaffected.
- The download route passes the resolved downloader email (session or captured;
  `null` if neither — but the route already 403s when neither is present, so a
  successful download always has one).

## Error handling

- `notifyDownload` swallows send errors (logs, resolves). Route wraps the call in
  `try/catch` anyway.
- Empty `ADMIN_EMAILS` → no send, no error.
- Admin page: `requireAdmin()` redirects non-admins (existing behavior).

## Testing (TDD)

- **notifyDownload** — builds the recipient list from `ADMIN_EMAILS`, calls
  `sendEmail` once per recipient with a subject containing the layout title;
  empty ADMIN_EMAILS → `sendEmail` not called; a throwing `sendEmail` → the
  promise still resolves (swallowed). Inject `sendEmail` (and the env) so no
  network.
- **download route** — with a captured email set, a stub `notifyDownload` that
  throws still returns a 200 zip (notification failure never breaks download);
  `recordDownload` is called with the resolved email.
- **listEmailCaptures / listRecentDownloads** — DB-gated (skipIf no POSTGRES_URL)
  tests asserting shape + newest-first order + the pack/layout join.
- **admin gate** — a non-admin request to the page is blocked/redirected (follow
  the existing `admin-gate.test` pattern).
- **table render** — the page's tables render rows from stub query data (follow
  `admin-queue-table.test` pattern) — extract the tables into a small presentational
  component if that makes them testable without a DB.

## Non-goals (YAGNI)

- No digest/scheduled notification (immediate per-download only; the send is
  isolated in `notifyDownload` so a future digest is a localized change).
- No CSV export.
- No Loops-synced column (LOOPS_API_KEY is empty; nothing to show yet).
- No pagination on the admin tables in v1 (limit download activity to 100).

## Integration / cost

Purely web-app (no pipeline). One extra Resend call per download (async, isolated).
One additive nullable column + migration; no backfill needed (existing rows show
`—` for email).

# Phase 5a — Real Magic-Link Auth — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §3/§14/§19 Phase 5, first half (auth). 5b = free-pack capture + transactional.
**Predecessor:** Phase 4b (downloads + account) — complete, tagged `phase-4b-complete`.

---

## Goal

Replace the password-less Phase-0 credentials stub with **real passwordless
magic-link authentication** (Auth.js Email provider + Resend), backed by the
existing Drizzle adapter tables. This **closes the production login
release-blocker**: signing in as an email now requires controlling that inbox, so
the `ADMIN_EMAILS` allowlist only grants admin to verified inbox owners.

---

## Key decisions (resolved in brainstorm)

1. **Magic link, passwordless.** Auth.js **Email provider** issues a one-time
   sign-in link; verification tokens are stored in the DB via
   `@auth/drizzle-adapter`. No passwords stored or hashed.
2. **Build gated (keyless dev).** When `RESEND_API_KEY` is unset (local dev), the
   sign-in URL is **logged to the console** instead of emailed — the flow works
   end-to-end without a real key. With a key set, the link is sent via Resend.
   (The user plugs the key for real delivery later.)
3. **Keep JWT sessions.** Session strategy stays `jwt` so the `/admin` edge
   middleware (`NextAuth(authConfig)`) keeps validating sessions without a DB
   call. The `role`-from-`ADMIN_EMAILS` jwt/session callbacks are unchanged.
4. **Remove the credentials stub entirely.** Magic-link is the only provider; the
   `NODE_ENV==='production'` refusal guard is deleted (magic-link is safe in
   prod). The admin-by-email hole is closed by email verification.

### Scope boundary (5b)

Free-pack email capture → Loops + free entitlement, purchase receipts +
download-link emails, and pricing-page polish are Phase 5b.

---

## Architecture & data flow

```
/login → email-only form → signIn('email', { email, redirectTo: '/account' })
  │  Auth.js Email provider creates a one-time verification token (DB, drizzle adapter)
  │  sendVerificationRequest({ identifier: email, url }) → lib/email.sendMagicLink(email, url)
  │     RESEND_API_KEY set → send via Resend (from RESEND_FROM)
  │     no key (dev)       → console.log the sign-in URL
  ▼  → redirect to /verify-request ("check your email")
user clicks the link
  │  Auth.js verifies the token (single use, expiring)
  │  drizzle adapter getUserByEmail → existing user (incl. a 4a-webhook-created buyer) OR createUser
  │  jwt callback sets role = isAdminEmail(user.email) ? 'admin' : 'user'
  ▼  JWT session issued → redirect to /account
```

Because the adapter links by **email**, a buyer whose `users` row the 4a webhook
created (by Stripe email) signs in to **that same user** — purchases/entitlements
carry over. Edge middleware keeps working (JWT sessions).

---

## Components / units

### 1. Email sender — `lib/email/resend.ts`, `lib/email/magic-link.ts`
- `sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean }>`
  — if `RESEND_API_KEY` set, send via the Resend SDK (from `RESEND_FROM`);
  else `console.log` a dev notice and return `{ sent: false }` (never throws on a
  missing key in dev).
- `magicLinkEmail(url: string): { subject: string; html: string; text: string }`
  — pure builder for the sign-in email (contains the `url`).
- `sendMagicLink(email: string, url: string): Promise<void>` — composes the two;
  in dev with no key, logs the URL so the flow is testable locally.

### 2. Auth wiring — `lib/auth/index.ts` (rewrite the providers + adapter)
- Add `DrizzleAdapter(db, { usersTable: users, accountsTable: accounts,
  sessionsTable: sessions, verificationTokensTable: verificationTokens })`.
- Replace the `Credentials` provider with the **Email provider**
  (`maxAge` link TTL) whose `sendVerificationRequest` calls
  `sendMagicLink(identifier, url)`.
- Keep `...authConfig` (JWT strategy, `pages.signIn='/login'`, the jwt/session
  role callbacks). Remove the credentials stub + its prod guard.
- Add `pages.verifyRequest = '/verify-request'`.

### 3. Pages — `app/(account)/login/page.tsx` (rewrite), `app/(account)/verify-request/page.tsx` (new)
- `/login` — branded email-only form: a server action calling
  `signIn('email', { email, redirectTo: '/account' })`. Styled with the brand
  primitives (replaces the Phase-0 unstyled form).
- `/verify-request` — branded "Check your email for a sign-in link" page.

### 4. Env + deps
- `package.json`: add `@auth/drizzle-adapter`.
- `lib/env.ts`: `RESEND_FROM` (optional). `RESEND_API_KEY` already present.
- `.env.example`: document `RESEND_API_KEY` + `RESEND_FROM`.

---

## Error handling

- **No `RESEND_API_KEY` (dev):** the magic link is logged to the console (clearly
  labeled), never silently dropped — the flow is fully usable locally.
- **Resend send failure (prod):** logged; Auth.js shows its error page; the user
  can retry from `/login`.
- **Expired / already-used / unknown token:** Auth.js's standard verification
  error → redirect to `/login` (no session granted).
- **Existing users:** the adapter links by email (unique), so a buyer's
  webhook-created account is reused, not duplicated.

---

## Testing strategy (TDD)

- **Unit (no network):** `sendEmail` — the no-key dev path returns
  `{ sent: false }` + logs and does NOT throw; the with-key path mocks the Resend
  SDK and asserts it's called with `{ from, to, subject, html }`.
  `magicLinkEmail(url)` — the built email contains the URL in both html + text.
  `isAdminEmail` regression (unchanged).
- **Build/typecheck:** the app compiles with the adapter + Email provider wired;
  the existing suite stays green (the removed credentials stub's
  `lib/auth/index` is re-exported the same — `auth`/`handlers`/`signIn`/`signOut`).
- **Manual acceptance (keyless dev):** open `/login`, submit an email → redirected
  to `/verify-request` → copy the sign-in URL from the dev server console → open
  it → land signed-in on `/account`. Sign in with an `ADMIN_EMAILS` address →
  `/admin` is reachable; a non-admin address → `/admin` 404s. (With a real
  `RESEND_API_KEY` + `RESEND_FROM`, the link arrives by email instead.)

---

## Out of scope (5b / later)

Free-pack email capture + Loops sync + free entitlement, purchase-receipt and
download-link transactional emails, pricing-page polish, OAuth providers, and
account email-change/normalization (the email-lowercase note from 4b folds in
with capture/auth hardening in 5b).

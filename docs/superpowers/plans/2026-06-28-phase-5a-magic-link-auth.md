# Phase 5a — Magic-Link Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the password-less Phase-0 credentials stub with passwordless magic-link auth (Auth.js Email provider + Resend, Drizzle adapter), closing the production login release-blocker.

**Architecture:** A custom `type:'email'` Auth.js provider whose `sendVerificationRequest` delegates to `lib/email.sendMagicLink` (Resend in prod; console-logged URL in keyless dev). `@auth/drizzle-adapter` stores verification tokens + creates/links users by email (so a 4a-webhook-created buyer signs into the same account). Sessions stay JWT (edge middleware preserved); the `role`-from-`ADMIN_EMAILS` callbacks are unchanged.

**Tech Stack:** next-auth `5.0.0-beta.31`, `@auth/drizzle-adapter` `^1.11.2`, `resend` (already a dep), Drizzle, Vitest.

## Global Constraints

- **Magic-link only; remove the credentials provider** and its `NODE_ENV==='production'` refusal guard. Magic-link is safe in prod (must control the inbox to sign in).
- **Keep `session.strategy='jwt'`** — so the `/admin` edge middleware validates sessions without a DB call. The existing `jwt`/`session` role callbacks in `lib/auth/config.ts` are UNCHANGED.
- **Keyless dev:** with no `RESEND_API_KEY`, `sendEmail` logs the sign-in URL to the console and returns `{ sent: false }` — it MUST NOT throw. With a key, it sends via Resend from `RESEND_FROM`.
- **The Email provider must be a hand-built object** (`{ id:'email', type:'email', name, from, maxAge, options:{}, sendVerificationRequest }`). Do NOT use `next-auth/providers/email` or `/nodemailer` — those throw `"Nodemailer requires a \`server\` configuration"` at construction.
- **Adapter:** `DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens })`. The existing auth tables already match the adapter's column contract — do NOT alter the schema.
- **`lib/auth/index.ts` keeps exporting `{ handlers, auth, signIn, signOut }`** with the same names (consumed across the app + middleware).
- Secrets server-only; no `NEXT_PUBLIC_` for `RESEND_API_KEY`/`RESEND_FROM`.
- Commit after every task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Email sender (`lib/email`)

**Files:**
- Create: `lib/email/resend.ts`, `lib/email/magic-link.ts`, `lib/email/index.ts`
- Modify: `lib/env.ts` (add `RESEND_FROM`), `.env.example`
- Test: `tests/email.test.ts`

**Interfaces:**
- Consumes: `env` (`@/lib/env`), `Resend` (`resend`).
- Produces:
  - `sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean }>`
  - `magicLinkEmail(url: string): { subject: string; html: string; text: string }` (pure)
  - `sendMagicLink(email: string, url: string): Promise<void>`

- [ ] **Step 1: Add `RESEND_FROM` to the env schema**

In `lib/env.ts`, in the server schema object alongside `RESEND_API_KEY`, add:
```ts
  RESEND_FROM: z.string().optional(),
```
(If the file lists vars in a `z.object({...})` and also reads them from `process.env`, add `RESEND_FROM` in BOTH places following the existing pattern for `RESEND_API_KEY`.)

- [ ] **Step 2: Document the vars in `.env.example`**

Ensure these two lines exist (add `RESEND_FROM` if missing):
```
RESEND_API_KEY=
RESEND_FROM=onboarding@resend.dev
```

- [ ] **Step 3: Write the failing test**

```ts
// tests/email.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted so the mock var is available to the hoisted vi.mock factory
// (project pattern — bare top-level vars trip Vitest's hoisting guard).
const { create } = vi.hoisted(() => ({ create: vi.fn(async () => ({ data: { id: 'eml_1' }, error: null })) }));
vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: create } })) }));

const ORIG = { ...process.env };
beforeEach(() => { create.mockClear(); });
afterEach(() => { process.env = { ...ORIG }; vi.unstubAllGlobals(); });

describe('magicLinkEmail', () => {
  it('includes the url in html and text', async () => {
    const { magicLinkEmail } = await import('@/lib/email/magic-link');
    const m = magicLinkEmail('https://layoutlab.com/api/auth/callback/email?token=abc');
    expect(m.subject).toMatch(/sign in/i);
    expect(m.html).toContain('https://layoutlab.com/api/auth/callback/email?token=abc');
    expect(m.text).toContain('https://layoutlab.com/api/auth/callback/email?token=abc');
  });
});

describe('sendEmail', () => {
  it('without RESEND_API_KEY: logs, does not throw, returns { sent: false }', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await import('@/lib/email/resend');
    const res = await sendEmail({ to: 'a@b.c', subject: 'S', html: '<p>hi</p>' });
    expect(res).toEqual({ sent: false });
    expect(log).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('with RESEND_API_KEY: sends via Resend and returns { sent: true }', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'LayoutLab <noreply@layoutlab.com>';
    vi.resetModules();
    const { sendEmail } = await import('@/lib/email/resend');
    const res = await sendEmail({ to: 'a@b.c', subject: 'S', html: '<p>hi</p>', text: 'hi' });
    expect(res).toEqual({ sent: true });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'LayoutLab <noreply@layoutlab.com>', to: 'a@b.c', subject: 'S', html: '<p>hi</p>' }),
    );
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm run test -- tests/email.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Implement**

```ts
// lib/email/magic-link.ts
export function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  const subject = 'Sign in to LayoutLab';
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F8F9FB;padding:32px">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="color:#0B3558;font-size:22px;margin:0 0 12px">Sign in to LayoutLab</h1>
      <p style="color:#476788;font-size:15px;line-height:1.5;margin:0 0 24px">Click the button below to sign in. This link expires soon and can be used once.</p>
      <a href="${url}" style="display:inline-block;background:#006BFF;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:4px">Sign in</a>
      <p style="color:#476788;font-size:13px;margin:24px 0 0">Or paste this link into your browser:<br><a href="${url}" style="color:#006BFF">${url}</a></p>
    </td></tr>
  </table></body></html>`;
  const text = `Sign in to LayoutLab\n\nOpen this link to sign in (expires soon, single use):\n${url}\n`;
  return { subject, html, text };
}
```

```ts
// lib/email/resend.ts
import { Resend } from 'resend';

const FALLBACK_FROM = 'LayoutLab <onboarding@resend.dev>';

export async function sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Keyless dev: never block the flow — surface the email so it's testable locally.
    console.log(`[email:dev] no RESEND_API_KEY — would send to ${input.to}: ${input.subject}`);
    return { sent: false };
  }
  const from = process.env.RESEND_FROM || FALLBACK_FROM;
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text });
  return { sent: true };
}
```

```ts
// lib/email/index.ts
import { sendEmail } from './resend';
import { magicLinkEmail } from './magic-link';

export { sendEmail } from './resend';
export { magicLinkEmail } from './magic-link';

export async function sendMagicLink(email: string, url: string): Promise<void> {
  const { subject, html, text } = magicLinkEmail(url);
  const { sent } = await sendEmail({ to: email, subject, html, text });
  if (!sent) console.log(`[auth:dev] magic sign-in link for ${email}:\n${url}`);
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- tests/email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/email lib/env.ts .env.example tests/email.test.ts
git commit -m "feat: email sender (Resend + keyless-dev console fallback) + magic-link email

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire the adapter + magic-link provider

**Files:**
- Modify: `lib/auth/index.ts` (rewrite providers + add adapter), `lib/auth/config.ts` (add `pages.verifyRequest`)
- Modify: `package.json` (add `@auth/drizzle-adapter`)
- Test: manual + build (no new unit test file — the wiring is integration; the suite must stay green)

**Interfaces:**
- Consumes: `sendMagicLink` (Task 1), `db` (`@/db/client`), `users`/`accounts`/`sessions`/`verificationTokens` (`@/db/schema`), `authConfig` (`@/lib/auth/config`).
- Produces: unchanged exports `{ handlers, auth, signIn, signOut }` from `@/lib/auth`. Sign-in provider id is `email` (so `signIn('email', {...})`).

- [ ] **Step 1: Install the adapter**

Run: `npm install @auth/drizzle-adapter@^1.11.2`
Expected: installs (peer of `@auth/core`, which next-auth beta provides).

- [ ] **Step 2: Add the verify-request page to the auth config**

In `lib/auth/config.ts`, extend `pages`:
```ts
  pages: { signIn: '/login', verifyRequest: '/verify-request' },
```
(Leave `session`, `callbacks`, `isAdmin`, `isAdminEmail` exactly as they are.)

- [ ] **Step 3: Rewrite `lib/auth/index.ts`**

Replace the whole file with:
```ts
import NextAuth from 'next-auth';
import type { EmailConfig } from 'next-auth/providers';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db/client';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';
import { authConfig } from './config';
import { sendMagicLink } from '@/lib/email';

// Hand-built magic-link provider. We do NOT use next-auth/providers/email or
// /nodemailer — those throw "Nodemailer requires a `server` configuration" at
// construction. type:'email' drives Auth.js's verification-token flow; our
// sendVerificationRequest delivers the link via Resend (or console in dev).
const magicLink: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: process.env.RESEND_FROM || 'LayoutLab <onboarding@resend.dev>',
  maxAge: 24 * 60 * 60,
  options: {},
  // @ts-expect-error Auth.js types sendVerificationRequest with the full provider ctx; we only need identifier+url.
  sendVerificationRequest: async ({ identifier, url }: { identifier: string; url: string }) => {
    await sendMagicLink(identifier, url);
  },
} as EmailConfig;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [magicLink],
});
```

> **If the build rejects the `DrizzleAdapter(db, {...})` second-arg shape** for the installed `@auth/drizzle-adapter@1.11.2`, check `node_modules/@auth/drizzle-adapter/index.d.ts` for the exact param name(s) and adjust the keys (the four tables map to users/accounts/sessions/verificationTokens). Do not change the schema. **If the `EmailConfig`/`sendVerificationRequest` typing fights you**, type `magicLink` as `any` rather than weakening behavior — the runtime shape (id/type/from/maxAge/options/sendVerificationRequest) is what matters.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the `@ts-expect-error`/`any` confines the provider typing; exports unchanged).

- [ ] **Step 5: Run the full unit suite (no regressions)**

Run: `npm run test`
Expected: PASS — nothing imports the removed credentials provider; `auth`/`handlers`/`signIn`/`signOut` still export.

- [ ] **Step 6: Production build (wiring compiles)**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://layoutlab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@layoutlab.com npm run build
```
Expected: PASS — the app compiles with the adapter + provider wired; `/api/auth/[...nextauth]` route present.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/index.ts lib/auth/config.ts package.json package-lock.json
git commit -m "feat: magic-link auth (Drizzle adapter + Resend email provider), drop credentials stub

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Login + verify-request pages

**Files:**
- Rewrite: `app/(account)/login/page.tsx`
- Create: `app/(account)/verify-request/page.tsx`
- Test: `tests/login-page.test.tsx`

**Interfaces:**
- Consumes: `signIn` (`@/lib/auth`), `Container` (`@/components/ui/Container`), `Card` (`@/components/ui/Card`).
- Produces: `/login` (email-only magic-link request form) + `/verify-request` ("check your email").

- [ ] **Step 1: Write the failing test**

```tsx
// tests/login-page.test.tsx
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }));

import LoginPage from '@/app/(account)/login/page';
import VerifyRequestPage from '@/app/(account)/verify-request/page';
import { render } from '@testing-library/react';

describe('LoginPage', () => {
  it('renders an email-only magic-link form (no password field)', () => {
    const { container, getByText } = render(<LoginPage />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(getByText(/sign in|email me a link|magic link/i)).toBeTruthy();
  });
});

describe('VerifyRequestPage', () => {
  it('tells the user to check their email', () => {
    const { getByText } = render(<VerifyRequestPage />);
    expect(getByText(/check your email/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/login-page.test.tsx`
Expected: FAIL — `verify-request` page missing / password field still present.

- [ ] **Step 3: Rewrite the login page**

```tsx
// app/(account)/login/page.tsx
import { signIn } from '@/lib/auth';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  return (
    <main className="py-16">
      <Container className="max-w-md">
        <Card className="p-8">
          <h1 className="text-h3 text-navy">Sign in</h1>
          <p className="mt-2 text-small text-muted">
            Enter your email and we&apos;ll send you a magic sign-in link.
          </p>
          <form
            action={async (formData: FormData) => {
              'use server';
              await signIn('email', { email: formData.get('email'), redirectTo: '/account' });
            }}
            className="mt-6 space-y-3"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-card border border-fog bg-paper px-3 py-2 text-body text-navy outline-none focus:border-action"
            />
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
            >
              Email me a sign-in link
            </button>
          </form>
        </Card>
      </Container>
    </main>
  );
}
```

- [ ] **Step 4: Create the verify-request page**

```tsx
// app/(account)/verify-request/page.tsx
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function VerifyRequestPage() {
  return (
    <main className="py-16">
      <Container className="max-w-md">
        <Card className="p-8 text-center">
          <h1 className="text-h3 text-navy">Check your email</h1>
          <p className="mt-3 text-body text-muted">
            We sent a sign-in link to your inbox. Open it on this device to finish signing in.
            The link expires soon and can be used once.
          </p>
        </Card>
      </Container>
    </main>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/login-page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add "app/(account)/login/page.tsx" "app/(account)/verify-request/page.tsx" tests/login-page.test.tsx
git commit -m "feat: branded magic-link login + verify-request pages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> If `Container`/`Card` accept a `className` prop they're used with elsewhere (e.g. account pages in Phase 4b), reuse the same prop API. If `Card` does NOT accept `className`, wrap it in a `<div className="max-w-md">` instead — match the existing primitive's real signature.

---

### Task 4: Acceptance — verification + manual walkthrough

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: PASS — `email`, `login-page`, plus all prior suites green; DB-gated suites skip without `POSTGRES_URL`.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://layoutlab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@layoutlab.com npm run build
```
Expected: PASS — `/login`, `/verify-request`, `/api/auth/[...nextauth]` compile.

- [ ] **Step 4: Manual acceptance (user-run, keyless dev — local DB required)**

```bash
# verification_tokens migration is already applied (Phase 1). Then:
npm run dev
# 1. Open /login, enter your email, submit → redirected to /verify-request.
# 2. Copy the sign-in URL printed in the dev server console
#    ("[auth:dev] magic sign-in link for <email>: http://localhost:3000/api/auth/callback/email?...").
# 3. Open that URL → you land signed-in on /account.
# 4. Sign in with the ADMIN_EMAILS address (lucacito@gmail.com) → /admin is reachable.
#    Sign in with a different address → /admin 404s, /account works.
# (With a real RESEND_API_KEY + RESEND_FROM set, the link arrives by email instead of the console.)
```

- [ ] **Step 5: Commit (empty if nothing changed) + done**

```bash
git commit --allow-empty -m "chore: Phase 5a acceptance verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes / external prerequisites (user-provided)

- **Keyless dev works out of the box** — the magic link is logged to the dev
  console. For real email delivery, set `RESEND_API_KEY` + `RESEND_FROM`
  (a verified Resend sender; `onboarding@resend.dev` works for testing) in
  `.env.local`.
- The local DB must be up (`docker compose up -d` + migrations applied) for the
  manual sign-in flow — the adapter writes verification tokens + the user row.

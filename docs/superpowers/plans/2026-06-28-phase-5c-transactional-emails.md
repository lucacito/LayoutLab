# Phase 5c — Transactional Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a (guest) checkout, email the buyer a purchase receipt containing a one-click magic sign-in link that lands them on their downloads.

**Architecture:** A server-only `createMagicSignInUrl` mints an Auth.js-compatible verification token + link (reproducing Auth.js's exact hashing). The Stripe webhook calls a best-effort `store.notifyPurchase` (mint link → build receipt → send via the gated `lib/email`). Fold in two deferred hardenings: a shared, email-normalizing `findOrCreateUserByEmail`.

**Tech Stack:** Next.js 15, next-auth `5.0.0-beta.31` (token scheme), Drizzle, node crypto, Resend (via `lib/email`), Vitest.

## Global Constraints

- **Magic-link scheme is fixed by Auth.js** (verified vs `@auth/core` send-token/callback): stored token = `SHA-256(`${rawToken}${AUTH_SECRET}`)`; URL = `${SITE_URL}/api/auth/callback/email?callbackUrl=…&token=<raw>&email=<identifier>`; identifier MUST equal the `email` query param; both are the lowercased email. Do NOT deviate.
- **Email is best-effort in the webhook:** `notifyPurchase` is called inside `try/catch` in `handleStripeEvent`; a failure is logged and swallowed so Stripe never retries (no double grants/emails). `markEventProcessed` stays the last step, unchanged.
- **notifyPurchase fires only on `checkout.session.completed`** (pack + membership) — NOT on `customer.subscription.*` (no renewal spam).
- **Keyless dev:** the receipt (incl. the sign-in URL) is logged by `sendEmail`; the flow works with no `RESEND_API_KEY`.
- **`AUTH_SECRET` is server-only**; `verification_tokens` writes are server-only. Email normalized to `trim().toLowerCase()`.
- Existing suites must stay green (the `handleStripeEvent` mock-store tests, the capture suites).
- Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `createMagicSignInUrl` (`lib/auth/sign-in-url.ts`)

**Files:**
- Create: `lib/auth/sign-in-url.ts`
- Test: `tests/sign-in-url.test.ts`

**Interfaces:**
- Produces:
  - `interface SignInUrlDeps { storeToken(identifier: string, hashedToken: string, expires: Date): Promise<void>; now(): Date; }`
  - `createMagicSignInUrl(email: string, callbackPath: string, deps: SignInUrlDeps): Promise<string>`
  - `signInUrlDeps: SignInUrlDeps` (real impl — inserts into `verification_tokens`)

- [ ] **Step 1: Write the failing test**

```ts
// tests/sign-in-url.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';

const ORIG = { ...process.env };
beforeEach(() => { process.env.AUTH_SECRET = 'test-secret-test-secret-32chars!!'; process.env.NEXT_PUBLIC_SITE_URL = 'https://divi5lab.com'; });
afterEach(() => { process.env = { ...ORIG }; });

describe('createMagicSignInUrl', () => {
  it('stores SHA-256(token+secret) and returns the Auth.js callback URL with the raw token', async () => {
    const { createMagicSignInUrl } = await import('@/lib/auth/sign-in-url');
    let stored: { identifier: string; hashedToken: string; expires: Date } | null = null;
    const deps = {
      storeToken: async (identifier: string, hashedToken: string, expires: Date) => { stored = { identifier, hashedToken, expires }; },
      now: () => new Date('2026-06-28T00:00:00Z'),
    };
    const url = await createMagicSignInUrl('  Buyer@Example.COM ', '/account/downloads', deps);

    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://divi5lab.com/api/auth/callback/email');
    expect(u.searchParams.get('callbackUrl')).toBe('https://divi5lab.com/account/downloads');
    expect(u.searchParams.get('email')).toBe('buyer@example.com');
    const rawToken = u.searchParams.get('token')!;
    expect(rawToken.length).toBeGreaterThan(20);

    // stored hash must equal SHA-256(rawToken + secret), identifier normalized, +24h expiry
    expect(stored!.identifier).toBe('buyer@example.com');
    expect(stored!.hashedToken).toBe(createHash('sha256').update(`${rawToken}${process.env.AUTH_SECRET}`).digest('hex'));
    expect(stored!.expires.getTime()).toBe(new Date('2026-06-29T00:00:00Z').getTime());
  });

  it('throws if AUTH_SECRET is unset', async () => {
    delete process.env.AUTH_SECRET;
    const { createMagicSignInUrl } = await import('@/lib/auth/sign-in-url');
    await expect(createMagicSignInUrl('a@b.com', '/x', { storeToken: async () => {}, now: () => new Date() })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/sign-in-url.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/auth/sign-in-url.ts
import { randomBytes, createHash } from 'node:crypto';
import { db } from '@/db/client';
import { verificationTokens } from '@/db/schema';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface SignInUrlDeps {
  storeToken(identifier: string, hashedToken: string, expires: Date): Promise<void>;
  now(): Date;
}

// Reproduces Auth.js's email verification-token scheme so a receipt link clicks
// straight through Auth.js's real callback. Verified vs next-auth 5.0.0-beta.31:
//   @auth/core/lib/actions/signin/send-token.js  — token row = SHA-256(`${token}${secret}`), secret = AUTH_SECRET
//   @auth/core/lib/actions/callback/index.js      — re-hashes ?token, requires invite.identifier === ?email
// URL: ${SITE}/api/auth/callback/email?callbackUrl=&token=<raw>&email=<identifier>
export async function createMagicSignInUrl(email: string, callbackPath: string, deps: SignInUrlDeps): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required to mint a sign-in link');
  const identifier = email.trim().toLowerCase();
  const token = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(`${token}${secret}`).digest('hex');
  await deps.storeToken(identifier, hashedToken, new Date(deps.now().getTime() + TOKEN_TTL_MS));

  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const params = new URLSearchParams({ callbackUrl: `${site}${callbackPath}`, token, email: identifier });
  return `${site}/api/auth/callback/email?${params.toString()}`;
}

export const signInUrlDeps: SignInUrlDeps = {
  async storeToken(identifier, hashedToken, expires) {
    await db.insert(verificationTokens).values({ identifier, token: hashedToken, expires });
  },
  now: () => new Date(),
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/sign-in-url.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/auth/sign-in-url.ts tests/sign-in-url.test.ts
git commit -m "feat: createMagicSignInUrl — mint an Auth.js-compatible one-click sign-in link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Receipt email builder (`lib/email/receipt.ts`)

**Files:**
- Create: `lib/email/receipt.ts`
- Test: `tests/receipt.test.ts`

**Interfaces:**
- Produces: `purchaseReceiptEmail(input: { kind: 'pack' | 'membership'; packTitle?: string; amountCents?: number; signInUrl: string }): { subject: string; html: string; text: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/receipt.test.ts
import { describe, it, expect } from 'vitest';
import { purchaseReceiptEmail } from '@/lib/email/receipt';

const URL = 'https://divi5lab.com/api/auth/callback/email?token=abc&email=a%40b.com';

describe('purchaseReceiptEmail', () => {
  it('pack receipt: contains the pack title, amount, and the one-click sign-in URL', () => {
    const m = purchaseReceiptEmail({ kind: 'pack', packTitle: 'Bold SaaS Heroes', amountCents: 4900, signInUrl: URL });
    expect(m.subject).toMatch(/receipt|purchase|thank/i);
    expect(m.html).toContain('Bold SaaS Heroes');
    expect(m.html).toContain('$49');
    expect(m.html).toContain(URL);
    expect(m.text).toContain(URL);
  });

  it('membership receipt: names all-access and contains the sign-in URL', () => {
    const m = purchaseReceiptEmail({ kind: 'membership', signInUrl: URL });
    expect(m.html).toMatch(/all-access|membership/i);
    expect(m.html).toContain(URL);
    expect(m.text).toContain(URL);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/receipt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/email/receipt.ts
export function purchaseReceiptEmail(input: { kind: 'pack' | 'membership'; packTitle?: string; amountCents?: number; signInUrl: string }): { subject: string; html: string; text: string } {
  const item = input.kind === 'membership' ? 'All-access membership' : (input.packTitle ?? 'Your pack');
  const amount = input.amountCents != null ? `$${(input.amountCents / 100).toFixed(input.amountCents % 100 === 0 ? 0 : 2)}` : '';
  const subject = 'Your Divi5Lab purchase receipt';
  const amountLine = amount ? `<p style="color:#476788;font-size:15px;margin:0 0 8px">Amount: <strong>${amount}</strong></p>` : '';
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F8F9FB;padding:32px">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="color:#0B3558;font-size:22px;margin:0 0 12px">Thank you for your purchase</h1>
      <p style="color:#476788;font-size:15px;margin:0 0 8px">Item: <strong>${item}</strong></p>
      ${amountLine}
      <p style="color:#476788;font-size:15px;line-height:1.5;margin:16px 0 24px">Your files are ready. Click below to sign in and download — no password needed.</p>
      <a href="${input.signInUrl}" style="display:inline-block;background:#006BFF;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:4px">Access your downloads</a>
      <p style="color:#476788;font-size:13px;margin:24px 0 0">Or paste this link into your browser:<br><a href="${input.signInUrl}" style="color:#006BFF">${input.signInUrl}</a></p>
    </td></tr>
  </table></body></html>`;
  const text = `Thank you for your purchase\n\nItem: ${item}${amount ? `\nAmount: ${amount}` : ''}\n\nYour files are ready. Open this link to sign in and download (no password needed):\n${input.signInUrl}\n`;
  return { subject, html, text };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/receipt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/email/receipt.ts tests/receipt.test.ts
git commit -m "feat: purchase-receipt email builder (one-click access button)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Shared `findOrCreateUserByEmail` (`lib/users/find-or-create.ts`)

**Files:**
- Create: `lib/users/find-or-create.ts`
- Modify: `lib/stripe/fulfillment-store.ts`, `lib/capture/store.ts`
- Test: `tests/find-or-create-user.test.ts`

**Interfaces:**
- Produces: `findOrCreateUserByEmail(email: string): Promise<string>` (normalizes `trim().toLowerCase()`).
- Consumed by: `fulfillment-store.ts` + `capture/store.ts` (both delegate to it).

- [ ] **Step 1: Write the failing test (normalization + gated integration)**

```ts
// tests/find-or-create-user.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the value passed to drizzle's eq() so we can prove the email was
// normalized BEFORE it hit the query.
const eqArgs: unknown[] = [];
vi.mock('drizzle-orm', async (orig) => {
  const mod = await orig<typeof import('drizzle-orm')>();
  return { ...mod, eq: (col: unknown, val: unknown) => { eqArgs.push(val); return (mod.eq as any)(col, val); } };
});

const limit = vi.fn(async () => [{ id: 'u1' }]);
vi.mock('@/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: async () => {} }) }),
  },
}));

beforeEach(() => { eqArgs.length = 0; limit.mockResolvedValue([{ id: 'u1' }]); });

describe('findOrCreateUserByEmail', () => {
  it('normalizes the email (trim + lowercase) before querying', async () => {
    const { findOrCreateUserByEmail } = await import('@/lib/users/find-or-create');
    const id = await findOrCreateUserByEmail('  Buyer@Example.COM ');
    expect(id).toBe('u1');
    expect(eqArgs).toContain('buyer@example.com');
    expect(eqArgs).not.toContain('  Buyer@Example.COM ');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('findOrCreateUserByEmail integration (needs POSTGRES_URL)', () => {
  it('upserts and returns a stable id regardless of email casing', async () => {
    vi.resetModules();
    const real = await vi.importActual<typeof import('@/lib/users/find-or-create')>('@/lib/users/find-or-create');
    const a = await real.findOrCreateUserByEmail('Case@Test.com');
    const b = await real.findOrCreateUserByEmail('case@test.com');
    expect(a).toBe(b);
  });
});
```

> The unit test mocks drizzle's `eq` to capture its argument, directly proving the email is normalized before the query. The gated integration block proves the upsert + case-insensitive stability end to end.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/find-or-create-user.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the shared helper**

```ts
// lib/users/find-or-create.ts
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/** Find or create a user by email (normalized to lowercase). Returns the user id. */
export async function findOrCreateUserByEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (existing[0]) return existing[0].id;
  const id = randomUUID();
  await db.insert(users).values({ id, email: normalized, role: 'user' }).onConflictDoNothing();
  const row = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  return row[0]?.id ?? id;
}
```

- [ ] **Step 4: Delegate from `fulfillment-store.ts`**

In `lib/stripe/fulfillment-store.ts`: add `import { findOrCreateUserByEmail } from '@/lib/users/find-or-create';` and replace the inline `async findOrCreateUserByEmail(email) { … }` method body with a delegate:
```ts
  findOrCreateUserByEmail,
```
(Use the imported function as the method — the object property shorthand. Remove the now-unused inline implementation. If `randomUUID`/`users` imports become unused in this file, leave them only if still used elsewhere in the file; otherwise remove to keep lint clean.)

- [ ] **Step 5: Delegate from `capture/store.ts`**

In `lib/capture/store.ts`: replace the inline `async findOrCreateUserByEmail(email) { … }` with `findOrCreateUserByEmail,` (import it from `@/lib/users/find-or-create`). Remove now-unused imports if any.

- [ ] **Step 6: Run the helper test + the suites that exercise the two stores**

Run: `npm run test -- tests/find-or-create-user.test.ts tests/fulfillment.test.ts tests/capture-store.test.ts`
Expected: PASS — helper unit passes (integration skips); the fulfillment + capture-store suites stay green (their mock stores / shape are unaffected).

- [ ] **Step 7: Full suite + typecheck + lint + commit**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS (no regressions).

```bash
git add lib/users/find-or-create.ts lib/stripe/fulfillment-store.ts lib/capture/store.ts tests/find-or-create-user.test.ts
git commit -m "refactor: shared findOrCreateUserByEmail with email normalization

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `notifyPurchase` — webhook wiring

**Files:**
- Modify: `lib/stripe/fulfillment.ts` (interface + call site), `lib/stripe/fulfillment-store.ts` (impl)
- Modify: `tests/fulfillment.test.ts` (extend the mock store + assertions)

**Interfaces:**
- Consumes: `createMagicSignInUrl` + `signInUrlDeps` (Task 1), `purchaseReceiptEmail` (Task 2), `sendEmail` (`@/lib/email`), `packs`/`db`.
- Produces: `FulfillmentStore.notifyPurchase(input: { email: string; kind: 'pack' | 'membership'; packId?: string; amountCents?: number }): Promise<void>`.

- [ ] **Step 1: Extend the existing fulfillment test (RED)**

In `tests/fulfillment.test.ts`, the existing mock-store factory is `fakeStore(over?)` and the fixtures are `pack`, `membership`, `subUpdated`, `subDeleted` (imported JSON). FIRST add `notifyPurchase: vi.fn(async () => {}),` to the `fakeStore` return object (alongside `revokeAllAccess`). Then add these cases (reusing the real names — do NOT invent new fixtures, do NOT weaken existing assertions):

```ts
it('sends a one-click receipt on a pack checkout', async () => {
  const s = fakeStore();
  await handleStripeEvent(pack as unknown as Stripe.Event, s);
  expect(s.notifyPurchase).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'buyer@example.com', kind: 'pack', packId: 'pack_saas', amountCents: 4900 }),
  );
});

it('sends a receipt on a membership checkout', async () => {
  const s = fakeStore();
  await handleStripeEvent(membership as unknown as Stripe.Event, s);
  expect(s.notifyPurchase).toHaveBeenCalledWith(expect.objectContaining({ kind: 'membership' }));
});

it('does NOT send a receipt on subscription.updated', async () => {
  const s = fakeStore();
  await handleStripeEvent(subUpdated as unknown as Stripe.Event, s);
  expect(s.notifyPurchase).not.toHaveBeenCalled();
});

it('a failing notifyPurchase does not fail the webhook (event still processed)', async () => {
  const s = fakeStore({ notifyPurchase: vi.fn(async () => { throw new Error('resend down'); }) });
  await expect(handleStripeEvent(pack as unknown as Stripe.Event, s)).resolves.toBeUndefined();
  expect(s.markEventProcessed).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `npm run test -- tests/fulfillment.test.ts`
Expected: FAIL — `notifyPurchase` not called (not yet wired) / not on the interface.

- [ ] **Step 3: Add `notifyPurchase` to the interface + call site**

In `lib/stripe/fulfillment.ts`:
- Add to the `FulfillmentStore` interface:
```ts
  notifyPurchase(input: { email: string; kind: 'pack' | 'membership'; packId?: string; amountCents?: number }): Promise<void>;
```
- In `handleStripeEvent`'s `checkout.session.completed` branch, after the grant calls, add (still inside that `case`, after the `if (meta.kind === 'pack' …) … else if (meta.kind === 'membership') …` block):
```ts
      try {
        if (meta.kind === 'pack' && meta.packId) {
          await store.notifyPurchase({ email, kind: 'pack', packId: meta.packId, amountCents: s.amount_total ?? 0 });
        } else if (meta.kind === 'membership') {
          await store.notifyPurchase({ email, kind: 'membership' });
        }
      } catch (err) {
        console.error('[webhook] receipt email failed:', err);
      }
```
(Do NOT add notifyPurchase to the subscription cases.)

- [ ] **Step 4: Implement the real `notifyPurchase` in `fulfillment-store.ts`**

Add the method to the exported store object:
```ts
  async notifyPurchase(input) {
    const signInUrl = await createMagicSignInUrl(input.email, '/account/downloads', signInUrlDeps);
    let packTitle: string | undefined;
    if (input.packId) {
      const rows = await db.select({ title: packs.title }).from(packs).where(eq(packs.id, input.packId)).limit(1);
      packTitle = rows[0]?.title;
    }
    const { subject, html, text } = purchaseReceiptEmail({ kind: input.kind, packTitle, amountCents: input.amountCents, signInUrl });
    await sendEmail({ to: input.email, subject, html, text });
  },
```
Add imports to `fulfillment-store.ts`: `createMagicSignInUrl`, `signInUrlDeps` (`@/lib/auth/sign-in-url`), `purchaseReceiptEmail` (`@/lib/email/receipt`), `sendEmail` (`@/lib/email`), and `packs` (`@/db/schema`) if not already imported.

- [ ] **Step 5: Run the fulfillment suite**

Run: `npm run test -- tests/fulfillment.test.ts`
Expected: PASS — pack + membership receipts asserted; not on subscription updates; a thrown notify doesn't fail the webhook.

- [ ] **Step 6: Full suite + typecheck + lint + commit**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/stripe/fulfillment.ts lib/stripe/fulfillment-store.ts tests/fulfillment.test.ts
git commit -m "feat: webhook sends a one-click purchase receipt (best-effort notifyPurchase)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Acceptance — verification + manual walkthrough

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: PASS — sign-in-url, receipt, find-or-create-user, the extended fulfillment suite, plus all prior suites green; DB-gated suites skip without `POSTGRES_URL`.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://divi5lab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@divi5lab.com npm run build
```
Expected: PASS — the app compiles (webhook route unchanged in shape).

- [ ] **Step 4: Manual acceptance (user-run — local DB + Stripe test mode)**

```bash
# Needs: local DB up + migrated; Stripe test keys + `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
npm run dev
# 1. Buy a pack in Stripe test mode (a real test card) → webhook fires checkout.session.completed.
# 2. The dev server console logs the receipt incl. the sign-in URL
#    ("[email:dev] ..." + the Access-your-downloads link, since no RESEND_API_KEY).
# 3. Open that sign-in URL → you land signed-in on /account/downloads with the pack unlocked.
# 4. (With RESEND_API_KEY + RESEND_FROM set, the receipt is delivered by email instead.)
```

- [ ] **Step 5: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore: Phase 5c acceptance verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes / external prerequisites (user-provided)

- **Keyless dev works** — the receipt + sign-in link are logged to the dev console.
  For real delivery set `RESEND_API_KEY` + `RESEND_FROM` (5a).
- The minted link reproduces Auth.js's token scheme (verified vs next-auth
  5.0.0-beta.31, which is pinned). If next-auth is ever upgraded, re-run the manual
  acceptance (click the link → signed in) — that is the contract's gate.

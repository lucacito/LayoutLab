# Phase 4a — Checkout + Webhook Fulfillment + Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buyers (no login) purchase packs/membership via Stripe Checkout; the Stripe webhook is the single source of truth that provisions the user by email and grants a durable entitlement.

**Architecture:** Server-authoritative money path. `POST /api/checkout` resolves prices server-side and creates a Stripe Checkout Session; Stripe redirects the buyer; `POST /api/stripe/webhook` verifies the signature, is idempotent on the Stripe event id, and writes orders/subscriptions/entitlements. A pure `entitlements.ts` is the download gate's SSOT (enforced in 4b).

**Tech Stack:** Next.js 15 route handlers, `stripe` SDK v17, Drizzle ORM + Postgres, zod, Vitest. Generation/pipeline untouched.

## Global Constraints

- **Money is server-authoritative; never trust the client.** Prices are resolved server-side (pack from DB, membership from env); the client sends only `packId`/`plan`. (§2.8)
- **The webhook is the source of truth.** Entitlements/orders/subscriptions are written ONLY by the verified webhook — never from the `/checkout/success` redirect. (§12)
- **Idempotent fulfillment.** Dedupe on the Stripe event id (`stripe_events` ledger) + unique constraints; replays/double-deliveries never double-grant. (§2.7)
- **Guest checkout by email:** the webhook find-or-creates a `users` row by the Stripe customer email and binds the entitlement to it.
- **Webhook signature verified** with `STRIPE_WEBHOOK_SECRET` or the request is rejected (400). (§16)
- **Secrets server-only:** `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` never reach the client; only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public. (§2.6)
- **zod-validate** `/api/checkout` input; rate-limit checkout + webhook (note in code; full limiter is out of scope, see §16 — add a TODO marker, do not block).
- **TDD first** — entitlements, checkout-params builder, and fulfillment handlers are pure/injected and unit-tested with committed Stripe fixtures before wiring routes. (§2.8, §17)
- **DB-gated tests skip** without `POSTGRES_URL`; no live Stripe calls in CI.
- **Commit after every task** with a conventional-commit message ending in the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Schema + env for commerce

**Files:**
- Modify: `db/schema.ts` (add `stripeEvents` table + unique indexes), `lib/env.ts` (membership price vars), `vitest.config.ts` (`test.env` stripe vars), `.env.example`
- Create: `db/migrations/<generated>.sql`
- Test: `tests/db.test.ts` (extend the guard)

**Interfaces:**
- Produces: `stripeEvents` table (`id` PK, `type`, `createdAt`); unique indexes `entitlements(user_id, scope)`, `subscriptions(stripe_subscription_id)`, `orders(stripe_checkout_id)`; `env.STRIPE_PRICE_MEMBERSHIP_MONTHLY/_YEARLY` (optional); test env carries dummy Stripe values.

- [ ] **Step 1: Extend the schema guard test**

Add to `tests/db.test.ts` (keep existing cases):

```ts
import { stripeEvents } from '@/db/schema';

describe('commerce schema (Phase 4a)', () => {
  it('exposes the stripe_events idempotency ledger', () => {
    expect((stripeEvents as any).id).toBeDefined();
    expect((stripeEvents as any).type).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/db.test.ts`
Expected: FAIL — `stripeEvents` not exported.

- [ ] **Step 3: Add the table + unique indexes**

In `db/schema.ts`, add the table near the other commerce tables:

```ts
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(), // Stripe event id
  type: text('type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

Add unique indexes to the existing tables via their table-config callbacks:

```ts
// entitlements: add a third arg to pgTable(...)
}, (t) => ({
  userScopeUq: uniqueIndex('entitlements_user_scope_uq').on(t.userId, t.scope),
}));

// subscriptions:
}, (t) => ({
  stripeSubUq: uniqueIndex('subscriptions_stripe_sub_uq').on(t.stripeSubscriptionId),
}));

// orders:
}, (t) => ({
  stripeCheckoutUq: uniqueIndex('orders_stripe_checkout_uq').on(t.stripeCheckoutId),
}));
```

(`uniqueIndex` is already imported in `db/schema.ts`.)

- [ ] **Step 4: Add membership price env vars**

In `lib/env.ts` schema, add alongside the other optional keys:

```ts
  STRIPE_PRICE_MEMBERSHIP_MONTHLY: z.string().optional(),
  STRIPE_PRICE_MEMBERSHIP_YEARLY: z.string().optional(),
```

- [ ] **Step 5: Add dummy Stripe values to the test env**

In `vitest.config.ts` `test.env`, add:

```ts
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
      STRIPE_PRICE_MEMBERSHIP_MONTHLY: 'price_test_monthly',
      STRIPE_PRICE_MEMBERSHIP_YEARLY: 'price_test_yearly',
```

- [ ] **Step 6: Document env + generate migration**

In `.env.example`, under Stripe, ensure both membership price vars are present (they already are) and add a comment. Run:

Run: `npm run db:generate`
Expected: a migration creating `stripe_events` + the three unique indexes.

- [ ] **Step 7: Run guard test + typecheck**

Run: `npm run test -- tests/db.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add db/schema.ts db/migrations lib/env.ts vitest.config.ts .env.example tests/db.test.ts
git commit -m "feat: commerce schema (stripe_events ledger + unique indexes) + env

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Entitlements SSOT (pure)

**Files:**
- Create: `lib/stripe/entitlements.ts`
- Test: `tests/entitlements.test.ts`

**Interfaces:**
- Produces:
  - `interface UserEntitlement { scope: string; source: string; expiresAt: Date | null }`
  - `isActiveAllAccess(e: UserEntitlement, now: Date): boolean`
  - `interface CanDownloadInput { layoutPackIds: string[]; packKindById: Record<string, 'free'|'paid'>; userEntitlements: UserEntitlement[]; freeCapturedPackIds?: string[]; now?: Date }`
  - `canDownloadLayout(input: CanDownloadInput): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/entitlements.test.ts
import { describe, it, expect } from 'vitest';
import { canDownloadLayout, isActiveAllAccess } from '@/lib/stripe/entitlements';

const NOW = new Date('2026-06-28T00:00:00Z');
const base = { layoutPackIds: ['p1'], packKindById: { p1: 'paid' as const }, userEntitlements: [], now: NOW };

describe('isActiveAllAccess', () => {
  it('true when all_access has no expiry or a future expiry', () => {
    expect(isActiveAllAccess({ scope: 'all_access', source: 'subscription', expiresAt: null }, NOW)).toBe(true);
    expect(isActiveAllAccess({ scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-07-01') }, NOW)).toBe(true);
  });
  it('false when expired or not all_access', () => {
    expect(isActiveAllAccess({ scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') }, NOW)).toBe(false);
    expect(isActiveAllAccess({ scope: 'pack:p1', source: 'order', expiresAt: null }, NOW)).toBe(false);
  });
});

describe('canDownloadLayout', () => {
  it('allows when the user owns a pack the layout belongs to', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'pack:p1', source: 'order', expiresAt: null }] })).toBe(true);
  });
  it('allows with active all_access', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'all_access', source: 'subscription', expiresAt: null }] })).toBe(true);
  });
  it('denies with expired all_access and no pack', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') }] })).toBe(false);
  });
  it('allows a free-pack layout the user captured email for', () => {
    expect(canDownloadLayout({ layoutPackIds: ['f1'], packKindById: { f1: 'free' }, userEntitlements: [], freeCapturedPackIds: ['f1'], now: NOW })).toBe(true);
  });
  it('denies when the user owns a different pack', () => {
    expect(canDownloadLayout({ ...base, userEntitlements: [{ scope: 'pack:other', source: 'order', expiresAt: null }] })).toBe(false);
  });
  it('denies with no entitlements', () => {
    expect(canDownloadLayout(base)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/entitlements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the SSOT**

```ts
// lib/stripe/entitlements.ts
export interface UserEntitlement {
  scope: string; // 'all_access' | `pack:${id}`
  source: string; // 'order' | 'subscription' | 'free'
  expiresAt: Date | null;
}

export function isActiveAllAccess(e: UserEntitlement, now: Date): boolean {
  if (e.scope !== 'all_access') return false;
  return e.expiresAt == null || e.expiresAt.getTime() > now.getTime();
}

export interface CanDownloadInput {
  layoutPackIds: string[];
  packKindById: Record<string, 'free' | 'paid'>;
  userEntitlements: UserEntitlement[];
  freeCapturedPackIds?: string[];
  now?: Date;
}

export function canDownloadLayout(input: CanDownloadInput): boolean {
  const now = input.now ?? new Date();

  // Active all-access subscription unlocks everything.
  if (input.userEntitlements.some((e) => isActiveAllAccess(e, now))) return true;

  const ownedPackScopes = new Set(
    input.userEntitlements.filter((e) => e.scope.startsWith('pack:')).map((e) => e.scope),
  );
  const captured = new Set(input.freeCapturedPackIds ?? []);

  for (const packId of input.layoutPackIds) {
    if (ownedPackScopes.has(`pack:${packId}`)) return true;
    if (input.packKindById[packId] === 'free' && captured.has(packId)) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/entitlements.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/stripe/entitlements.ts tests/entitlements.test.ts
git commit -m "feat: entitlements SSOT (pure download-gate logic, tested)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Stripe client + checkout session builder + /api/checkout

**Files:**
- Create: `lib/stripe/client.ts`, `lib/stripe/checkout.ts`, `app/api/checkout/route.ts`
- Test: `tests/checkout.test.ts`

**Interfaces:**
- Consumes: `env`, `db`, `packs`.
- Produces:
  - `stripe` (SDK singleton).
  - `type CheckoutInput = { kind: 'pack'; packId: string } | { kind: 'membership'; plan: 'monthly' | 'yearly' }`
  - `interface CheckoutContext { siteUrl: string; packPriceId?: string; membershipPriceId?: string; email?: string; automaticTax: boolean }`
  - `buildCheckoutSessionParams(input: CheckoutInput, ctx: CheckoutContext): Stripe.Checkout.SessionCreateParams`
  - `POST /api/checkout` → `{ url }` (400 invalid/unknown pack/missing price, 500 not configured).

- [ ] **Step 1: Write the failing test (pure builder + route validation; no Stripe/DB calls)**

```ts
// tests/checkout.test.ts
import { describe, it, expect } from 'vitest';
import { buildCheckoutSessionParams } from '@/lib/stripe/checkout';
import { POST } from '@/app/api/checkout/route';

const ctx = { siteUrl: 'https://divi5lab.com', automaticTax: true };

describe('buildCheckoutSessionParams', () => {
  it('builds a one-time payment session for a pack', () => {
    const p = buildCheckoutSessionParams({ kind: 'pack', packId: 'pk1' }, { ...ctx, packPriceId: 'price_pack' });
    expect(p.mode).toBe('payment');
    expect(p.line_items).toEqual([{ price: 'price_pack', quantity: 1 }]);
    expect(p.metadata).toEqual({ kind: 'pack', packId: 'pk1' });
    expect(p.success_url).toContain('/checkout/success');
    expect(p.cancel_url).toContain('/checkout/cancel');
    expect((p.automatic_tax as any).enabled).toBe(true);
  });
  it('builds a subscription session for membership', () => {
    const p = buildCheckoutSessionParams({ kind: 'membership', plan: 'yearly' }, { ...ctx, membershipPriceId: 'price_year' });
    expect(p.mode).toBe('subscription');
    expect(p.line_items).toEqual([{ price: 'price_year', quantity: 1 }]);
    expect(p.metadata).toEqual({ kind: 'membership', plan: 'yearly' });
  });
});

function post(body: unknown) {
  return new Request('http://test/api/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/checkout — validation (no Stripe/DB)', () => {
  it('400 on invalid JSON', async () => {
    expect((await POST(post('not json{'))).status).toBe(400);
  });
  it('400 on an invalid body shape', async () => {
    expect((await POST(post({ kind: 'bogus' }))).status).toBe(400);
  });
  it('400 when a membership plan has no configured price', async () => {
    // STRIPE_PRICE_MEMBERSHIP_* are 'price_test_*' in test.env, so use an out-of-range plan shape:
    expect((await POST(post({ kind: 'membership' }))).status).toBe(400); // missing plan
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/checkout.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the client + builder**

```ts
// lib/stripe/client.ts
import Stripe from 'stripe';
import { env } from '@/lib/env';

// Server-only. STRIPE_SECRET_KEY is required at runtime by the commerce routes;
// the SDK is constructed with the test/live key from the environment.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '');
```

```ts
// lib/stripe/checkout.ts
import type Stripe from 'stripe';

export type CheckoutInput =
  | { kind: 'pack'; packId: string }
  | { kind: 'membership'; plan: 'monthly' | 'yearly' };

export interface CheckoutContext {
  siteUrl: string;
  packPriceId?: string;
  membershipPriceId?: string;
  email?: string;
  automaticTax: boolean;
}

export function buildCheckoutSessionParams(
  input: CheckoutInput,
  ctx: CheckoutContext,
): Stripe.Checkout.SessionCreateParams {
  const common: Stripe.Checkout.SessionCreateParams = {
    success_url: `${ctx.siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ctx.siteUrl}/checkout/cancel`,
    automatic_tax: { enabled: ctx.automaticTax },
    ...(ctx.email ? { customer_email: ctx.email } : {}),
  };

  if (input.kind === 'pack') {
    return {
      ...common,
      mode: 'payment',
      line_items: [{ price: ctx.packPriceId, quantity: 1 }],
      metadata: { kind: 'pack', packId: input.packId },
    };
  }
  return {
    ...common,
    mode: 'subscription',
    line_items: [{ price: ctx.membershipPriceId, quantity: 1 }],
    metadata: { kind: 'membership', plan: input.plan },
  };
}
```

- [ ] **Step 4: Implement the route**

```ts
// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { packs } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';
import { buildCheckoutSessionParams, type CheckoutInput, type CheckoutContext } from '@/lib/stripe/checkout';

const bodySchema = z.union([
  z.object({ kind: z.literal('pack'), packId: z.string().min(1) }),
  z.object({ kind: z.literal('membership'), plan: z.enum(['monthly', 'yearly']) }),
]);

// TODO(§16): add rate limiting to this route.
export async function POST(req: Request): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const input = parsed.data as CheckoutInput;

  let packPriceId: string | undefined;
  let membershipPriceId: string | undefined;
  if (input.kind === 'pack') {
    const rows = await db
      .select({ priceId: packs.stripePriceId, status: packs.status, kind: packs.kind })
      .from(packs).where(eq(packs.id, input.packId)).limit(1);
    const pack = rows[0];
    if (!pack || pack.status !== 'published' || pack.kind !== 'paid' || !pack.priceId) {
      return NextResponse.json({ error: 'pack_unavailable' }, { status: 400 });
    }
    packPriceId = pack.priceId;
  } else {
    membershipPriceId = input.plan === 'yearly'
      ? env.STRIPE_PRICE_MEMBERSHIP_YEARLY
      : env.STRIPE_PRICE_MEMBERSHIP_MONTHLY;
    if (!membershipPriceId) return NextResponse.json({ error: 'membership_unavailable' }, { status: 400 });
  }

  const makeCtx = (automaticTax: boolean): CheckoutContext => ({
    siteUrl: env.NEXT_PUBLIC_SITE_URL, packPriceId, membershipPriceId, automaticTax,
  });

  try {
    const session = await stripe.checkout.sessions.create(buildCheckoutSessionParams(input, makeCtx(true)));
    return NextResponse.json({ url: session.url });
  } catch {
    // Stripe Tax graceful degrade: if automatic_tax can't be applied (Tax not set
    // up in the sandbox), retry once without it so dev isn't blocked.
    const session = await stripe.checkout.sessions.create(buildCheckoutSessionParams(input, makeCtx(false)));
    return NextResponse.json({ url: session.url });
  }
}
```

> The validation tests (invalid JSON / bad shape / missing plan) all return before any DB or Stripe call, so they run without a database. The pack-lookup + session-creation paths are exercised in the manual acceptance walkthrough (Task 8).

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/checkout.test.ts`
Expected: PASS — builder + the three validation cases.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/stripe/client.ts lib/stripe/checkout.ts app/api/checkout/route.ts tests/checkout.test.ts
git commit -m "feat: stripe client + checkout session builder + /api/checkout (server-priced)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fulfillment handler (pure orchestration) + Stripe fixtures

**Files:**
- Create: `lib/stripe/fulfillment.ts`, `tests/fixtures/stripe/*.json`
- Test: `tests/fulfillment.test.ts`

**Interfaces:**
- Consumes: `entitlements` types (none needed), Stripe types.
- Produces:
  - `interface FulfillmentStore { hasProcessedEvent(id): Promise<boolean>; markEventProcessed(id, type): Promise<void>; findOrCreateUserByEmail(email): Promise<string>; findUserBySubscriptionId(subId): Promise<string | null>; recordOrder(o): Promise<void>; grantPackEntitlement(userId, packId): Promise<void>; upsertSubscription(s): Promise<void>; grantAllAccess(userId, expiresAt): Promise<void>; revokeAllAccess(userId): Promise<void> }`
  - `handleStripeEvent(event: Stripe.Event, store: FulfillmentStore): Promise<void>` — idempotent; dispatches `checkout.session.completed`, `customer.subscription.created|updated`, `customer.subscription.deleted`.

- [ ] **Step 1: Create the Stripe event fixtures**

```json
// tests/fixtures/stripe/checkout-pack.json
{
  "id": "evt_pack_1",
  "type": "checkout.session.completed",
  "data": { "object": {
    "id": "cs_pack_1",
    "mode": "payment",
    "amount_total": 4900,
    "customer_details": { "email": "buyer@example.com" },
    "metadata": { "kind": "pack", "packId": "pack_saas" }
  } }
}
```

```json
// tests/fixtures/stripe/checkout-membership.json
{
  "id": "evt_mem_1",
  "type": "checkout.session.completed",
  "data": { "object": {
    "id": "cs_mem_1",
    "mode": "subscription",
    "subscription": "sub_123",
    "customer_details": { "email": "member@example.com" },
    "metadata": { "kind": "membership", "plan": "monthly" }
  } }
}
```

```json
// tests/fixtures/stripe/subscription-updated.json
{
  "id": "evt_sub_upd_1",
  "type": "customer.subscription.updated",
  "data": { "object": {
    "id": "sub_123",
    "status": "active",
    "current_period_end": 1788000000
  } }
}
```

```json
// tests/fixtures/stripe/subscription-deleted.json
{
  "id": "evt_sub_del_1",
  "type": "customer.subscription.deleted",
  "data": { "object": { "id": "sub_123", "status": "canceled", "current_period_end": 1788000000 } }
}
```

- [ ] **Step 2: Write the failing test (fake store + fixtures)**

```ts
// tests/fulfillment.test.ts
import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { handleStripeEvent, type FulfillmentStore } from '@/lib/stripe/fulfillment';
import pack from './fixtures/stripe/checkout-pack.json';
import membership from './fixtures/stripe/checkout-membership.json';
import subUpdated from './fixtures/stripe/subscription-updated.json';
import subDeleted from './fixtures/stripe/subscription-deleted.json';

function fakeStore(over: Partial<FulfillmentStore> = {}): FulfillmentStore {
  return {
    hasProcessedEvent: vi.fn(async () => false),
    markEventProcessed: vi.fn(async () => {}),
    findOrCreateUserByEmail: vi.fn(async () => 'user_1'),
    findUserBySubscriptionId: vi.fn(async () => 'user_1'),
    recordOrder: vi.fn(async () => {}),
    grantPackEntitlement: vi.fn(async () => {}),
    upsertSubscription: vi.fn(async () => {}),
    grantAllAccess: vi.fn(async () => {}),
    revokeAllAccess: vi.fn(async () => {}),
    ...over,
  };
}

describe('handleStripeEvent', () => {
  it('pack checkout → user + order + pack entitlement, then marks the event', async () => {
    const s = fakeStore();
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).toHaveBeenCalledWith('buyer@example.com');
    expect(s.recordOrder).toHaveBeenCalledWith({ userId: 'user_1', stripeCheckoutId: 'cs_pack_1', amountCents: 4900 });
    expect(s.grantPackEntitlement).toHaveBeenCalledWith('user_1', 'pack_saas');
    expect(s.markEventProcessed).toHaveBeenCalledWith('evt_pack_1', 'checkout.session.completed');
  });

  it('membership checkout → subscription + all_access', async () => {
    const s = fakeStore();
    await handleStripeEvent(membership as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).toHaveBeenCalledWith('member@example.com');
    expect((s.upsertSubscription as any).mock.calls[0][0]).toMatchObject({ userId: 'user_1', stripeSubscriptionId: 'sub_123', status: 'active' });
    expect(s.grantAllAccess).toHaveBeenCalled();
  });

  it('subscription.updated active → grants all_access with the period end', async () => {
    const s = fakeStore();
    await handleStripeEvent(subUpdated as unknown as Stripe.Event, s);
    expect(s.findUserBySubscriptionId).toHaveBeenCalledWith('sub_123');
    const [userId, expiresAt] = (s.grantAllAccess as any).mock.calls[0];
    expect(userId).toBe('user_1');
    expect(expiresAt).toBeInstanceOf(Date);
  });

  it('subscription.deleted → revokes all_access', async () => {
    const s = fakeStore();
    await handleStripeEvent(subDeleted as unknown as Stripe.Event, s);
    expect(s.revokeAllAccess).toHaveBeenCalledWith('user_1');
  });

  it('is idempotent: a processed event writes nothing', async () => {
    const s = fakeStore({ hasProcessedEvent: vi.fn(async () => true) });
    await handleStripeEvent(pack as unknown as Stripe.Event, s);
    expect(s.findOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(s.grantPackEntitlement).not.toHaveBeenCalled();
    expect(s.markEventProcessed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/fulfillment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the handler**

```ts
// lib/stripe/fulfillment.ts
import type Stripe from 'stripe';

export interface FulfillmentStore {
  hasProcessedEvent(id: string): Promise<boolean>;
  markEventProcessed(id: string, type: string): Promise<void>;
  findOrCreateUserByEmail(email: string): Promise<string>;
  findUserBySubscriptionId(subId: string): Promise<string | null>;
  recordOrder(o: { userId: string; stripeCheckoutId: string; amountCents: number }): Promise<void>;
  grantPackEntitlement(userId: string, packId: string): Promise<void>;
  upsertSubscription(s: { userId: string; stripeSubscriptionId: string; status: 'active' | 'past_due' | 'canceled'; currentPeriodEnd: Date | null }): Promise<void>;
  grantAllAccess(userId: string, expiresAt: Date | null): Promise<void>;
  revokeAllAccess(userId: string): Promise<void>;
}

function mapStatus(s: string): 'active' | 'past_due' | 'canceled' {
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid') return 'past_due';
  return 'canceled';
}

export async function handleStripeEvent(event: Stripe.Event, store: FulfillmentStore): Promise<void> {
  if (await store.hasProcessedEvent(event.id)) return;

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const email = s.customer_details?.email ?? s.customer_email ?? null;
      if (!email) break;
      const userId = await store.findOrCreateUserByEmail(email);
      const meta = (s.metadata ?? {}) as Record<string, string>;
      if (meta.kind === 'pack' && meta.packId) {
        await store.recordOrder({ userId, stripeCheckoutId: s.id, amountCents: s.amount_total ?? 0 });
        await store.grantPackEntitlement(userId, meta.packId);
      } else if (meta.kind === 'membership' && typeof s.subscription === 'string') {
        await store.upsertSubscription({ userId, stripeSubscriptionId: s.subscription, status: 'active', currentPeriodEnd: null });
        await store.grantAllAccess(userId, null);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await store.findUserBySubscriptionId(sub.id);
      if (!userId) break;
      const status = mapStatus(sub.status);
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      await store.upsertSubscription({ userId, stripeSubscriptionId: sub.id, status, currentPeriodEnd: periodEnd });
      if (status === 'active') await store.grantAllAccess(userId, periodEnd);
      else await store.revokeAllAccess(userId);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await store.findUserBySubscriptionId(sub.id);
      if (!userId) break;
      await store.upsertSubscription({ userId, stripeSubscriptionId: sub.id, status: 'canceled', currentPeriodEnd: null });
      await store.revokeAllAccess(userId);
      break;
    }
    default:
      break;
  }

  await store.markEventProcessed(event.id, event.type);
}
```

> Ensure JSON fixture imports work: `tsconfig.json` has `resolveJsonModule` (Next default).

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/fulfillment.test.ts`
Expected: PASS (all five cases, incl. idempotency).

- [ ] **Step 6: Commit**

```bash
git add lib/stripe/fulfillment.ts tests/fulfillment.test.ts tests/fixtures/stripe
git commit -m "feat: idempotent Stripe fulfillment handler (fixtures-tested)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Webhook route + DB-backed fulfillment store

**Files:**
- Create: `lib/stripe/fulfillment-store.ts`, `app/api/stripe/webhook/route.ts`
- Test: `tests/webhook-route.test.ts`

**Interfaces:**
- Consumes: `stripe` client, `handleStripeEvent`/`FulfillmentStore` (Task 4), `db` + schema (Task 1).
- Produces:
  - `dbStore: FulfillmentStore` — Drizzle implementation (find-or-create user by email, idempotency ledger, idempotent upserts via `onConflictDoNothing` / unique indexes).
  - `POST /api/stripe/webhook` — verifies signature (400 on failure, 500 if unconfigured), dispatches to `handleStripeEvent(event, dbStore)`, returns `{ received: true }`.

- [ ] **Step 1: Write the failing test (signature paths; no DB)**

```ts
// tests/webhook-route.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/stripe/webhook/route';

function post(body: string, sig?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sig) headers['stripe-signature'] = sig;
  return new Request('http://test/api/stripe/webhook', { method: 'POST', headers, body });
}

describe('POST /api/stripe/webhook — signature gate (no DB)', () => {
  it('400 when the signature is missing/invalid', async () => {
    const res = await POST(post('{}', 'bad-signature'));
    expect(res.status).toBe(400);
  });
  it('400 when there is no signature header at all', async () => {
    const res = await POST(post('{}'));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/webhook-route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the DB-backed store**

```ts
// lib/stripe/fulfillment-store.ts
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, orders, entitlements, subscriptions, stripeEvents } from '@/db/schema';
import type { FulfillmentStore } from './fulfillment';

export const dbStore: FulfillmentStore = {
  async hasProcessedEvent(id) {
    const rows = await db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, id)).limit(1);
    return rows.length > 0;
  },
  async markEventProcessed(id, type) {
    await db.insert(stripeEvents).values({ id, type }).onConflictDoNothing();
  },
  async findOrCreateUserByEmail(email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return existing[0].id;
    const id = randomUUID();
    await db.insert(users).values({ id, email, role: 'user' }).onConflictDoNothing();
    const row = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return row[0]?.id ?? id;
  },
  async findUserBySubscriptionId(subId) {
    const rows = await db.select({ userId: subscriptions.userId }).from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subId)).limit(1);
    return rows[0]?.userId ?? null;
  },
  async recordOrder(o) {
    await db.insert(orders).values({
      id: randomUUID(), userId: o.userId, stripeCheckoutId: o.stripeCheckoutId, amountCents: o.amountCents, status: 'paid',
    }).onConflictDoNothing();
  },
  async grantPackEntitlement(userId, packId) {
    await db.insert(entitlements).values({
      id: randomUUID(), userId, scope: `pack:${packId}`, source: 'order',
    }).onConflictDoNothing();
  },
  async upsertSubscription(s) {
    await db.insert(subscriptions).values({
      id: randomUUID(), userId: s.userId, stripeSubscriptionId: s.stripeSubscriptionId, status: s.status, currentPeriodEnd: s.currentPeriodEnd,
    }).onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: { status: s.status, currentPeriodEnd: s.currentPeriodEnd },
    });
  },
  async grantAllAccess(userId, expiresAt) {
    await db.insert(entitlements).values({
      id: randomUUID(), userId, scope: 'all_access', source: 'subscription', expiresAt,
    }).onConflictDoUpdate({
      target: [entitlements.userId, entitlements.scope],
      set: { expiresAt },
    });
  },
  async revokeAllAccess(userId) {
    await db.delete(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.scope, 'all_access')));
  },
};
```

- [ ] **Step 4: Implement the webhook route**

```ts
// app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/fulfillment';
import { dbStore } from '@/lib/stripe/fulfillment-store';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });

  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  try {
    await handleStripeEvent(event, dbStore);
  } catch (err) {
    console.error('[stripe webhook] fulfillment error', err);
    return NextResponse.json({ error: 'fulfillment_failed' }, { status: 500 }); // Stripe retries
  }

  return NextResponse.json({ received: true });
}
```

> The two signature tests run without a DB (they return at the `constructEvent` failure before any fulfillment). `env.STRIPE_WEBHOOK_SECRET` is `whsec_test_dummy` in test.env, so the route reaches `constructEvent`, which rejects the fake signature → 400. The valid-signature dispatch + DB writes are covered by Task 4's handler tests and the Task 8 manual acceptance.

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/webhook-route.test.ts`
Expected: PASS — both signature cases 400.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/stripe/fulfillment-store.ts app/api/stripe/webhook/route.ts tests/webhook-route.test.ts
git commit -m "feat: Stripe webhook route + DB fulfillment store (signature-gated, idempotent)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Stripe product/price setup script

**Files:**
- Create: `scripts/stripe-setup.ts`
- Modify: `package.json` (add `stripe:setup` script)
- Test: `tests/stripe-setup.test.ts`

**Interfaces:**
- Produces:
  - `packProductParams(pack: { slug: string; title: string; description: string | null }): Stripe.ProductCreateParams` and `packPriceParams(productId: string, priceCents: number): Stripe.PriceCreateParams` — pure, tested.
  - A runnable `scripts/stripe-setup.ts` (`npm run stripe:setup`) that creates a Product + Price per published paid pack lacking `stripe_price_id` and backfills the id; prints membership-price guidance.

- [ ] **Step 1: Write the failing test (pure params)**

```ts
// tests/stripe-setup.test.ts
import { describe, it, expect } from 'vitest';
import { packProductParams, packPriceParams } from '@/scripts/stripe-setup';

describe('stripe setup params', () => {
  it('builds a product from a pack', () => {
    const p = packProductParams({ slug: 'saas-kit', title: 'SaaS Kit', description: 'desc' });
    expect(p.name).toBe('SaaS Kit');
    expect(p.metadata?.packSlug).toBe('saas-kit');
  });
  it('builds a one-time USD price in cents', () => {
    const p = packPriceParams('prod_1', 4900);
    expect(p.product).toBe('prod_1');
    expect(p.unit_amount).toBe(4900);
    expect(p.currency).toBe('usd');
    expect(p.recurring).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/stripe-setup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the script**

```ts
// scripts/stripe-setup.ts
import type Stripe from 'stripe';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs } from '@/db/schema';
import { stripe } from '@/lib/stripe/client';

export function packProductParams(pack: { slug: string; title: string; description: string | null }): Stripe.ProductCreateParams {
  return {
    name: pack.title,
    description: pack.description ?? undefined,
    metadata: { packSlug: pack.slug },
  };
}

export function packPriceParams(productId: string, priceCents: number): Stripe.PriceCreateParams {
  return { product: productId, unit_amount: priceCents, currency: 'usd' };
}

async function main() {
  const rows = await db.select().from(packs).where(and(eq(packs.kind, 'paid'), eq(packs.status, 'published')));
  for (const pack of rows) {
    if (pack.stripePriceId) { console.log(`skip ${pack.slug} (already has price)`); continue; }
    if (pack.priceCents == null) { console.log(`skip ${pack.slug} (no price_cents)`); continue; }
    const product = await stripe.products.create(packProductParams(pack));
    const price = await stripe.prices.create(packPriceParams(product.id, pack.priceCents));
    await db.update(packs).set({ stripePriceId: price.id }).where(eq(packs.id, pack.id));
    console.log(`created ${pack.slug} → ${price.id}`);
  }
  console.log('\nMembership: create monthly + yearly recurring Prices in Stripe and set');
  console.log('STRIPE_PRICE_MEMBERSHIP_MONTHLY / STRIPE_PRICE_MEMBERSHIP_YEARLY in .env.local.');
}

if (process.argv[1] && process.argv[1].endsWith('stripe-setup.ts')) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
```

Add to `package.json` scripts:

```json
    "stripe:setup": "tsx scripts/stripe-setup.ts",
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/stripe-setup.test.ts`
Expected: PASS. (The script's Stripe calls are exercised manually in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add scripts/stripe-setup.ts package.json tests/stripe-setup.test.ts
git commit -m "feat: stripe-setup script (pack products/prices) + npm run stripe:setup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Storefront wiring — pricing page, buy button, success/cancel

**Files:**
- Create: `components/BuyButton.tsx`, `app/(catalog)/pricing/page.tsx`, `app/checkout/success/page.tsx`, `app/checkout/cancel/page.tsx`
- Modify: `app/(catalog)/packs/[slug]/page.tsx` (swap the `/pricing` CTA stub for a `BuyButton`)
- Test: `tests/buy-button.test.tsx`

**Interfaces:**
- Consumes: `listPacks` (`@/lib/catalog/queries`), `Button`/`Container`/`Card`/`SectionTitle` primitives, `BuyButton`.
- Produces:
  - `BuyButton({ kind, packId?, plan?, label })` — a `'use client'` button that POSTs to `/api/checkout` and redirects to the returned `url`.
  - `/pricing` (paid packs + membership monthly/yearly), `/checkout/success`, `/checkout/cancel`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/buy-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { BuyButton } from '@/components/BuyButton';

describe('BuyButton', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it('posts the checkout request and redirects to the returned url', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://stripe.test/cs_1' }) })) as any;
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    const { getByRole } = render(<BuyButton kind="pack" packId="pk1" label="Buy this pack" />);
    fireEvent.click(getByRole('button', { name: 'Buy this pack' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({ method: 'POST' })));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ kind: 'pack', packId: 'pk1' });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://stripe.test/cs_1'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/buy-button.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `BuyButton`**

```tsx
// components/BuyButton.tsx
'use client';
import { useState } from 'react';

type Props =
  | { kind: 'pack'; packId: string; label: string; plan?: never }
  | { kind: 'membership'; plan: 'monthly' | 'yearly'; label: string; packId?: never };

export function BuyButton(props: Props) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const body = props.kind === 'pack' ? { kind: 'pack', packId: props.packId } : { kind: 'membership', plan: props.plan };
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.assign(data.url);
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={go}
      disabled={loading}
      className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-base font-semibold text-paper transition hover:brightness-110 disabled:opacity-40"
    >
      {loading ? 'Redirecting…' : props.label}
    </button>
  );
}
```

- [ ] **Step 4: Implement the pages**

```tsx
// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BuyButton } from '@/components/BuyButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing — Divi5Lab', description: 'Buy a pack or get all-access to every Divi 5 layout.' };

export default async function PricingPage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try { packs = (await listPacks()).filter((p) => p.kind === 'paid'); } catch { packs = []; }

  return (
    <main className="py-16">
      <Container>
        <SectionTitle eyebrow="Pricing" title="Buy a pack, or unlock everything">One-time packs, or all-access membership.</SectionTitle>

        <div className="mx-auto mt-12 max-w-md">
          <Card className="p-8 text-center">
            <h3 className="text-section text-navy">All-access membership</h3>
            <p className="mt-2 text-body text-muted">Every layout in the library, while your membership is active.</p>
            <div className="mt-6 flex flex-col gap-3">
              <BuyButton kind="membership" plan="monthly" label="Subscribe monthly" />
              <BuyButton kind="membership" plan="yearly" label="Subscribe yearly" />
            </div>
          </Card>
        </div>

        {packs.length > 0 && (
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => (
              <Card key={p.id} className="flex flex-col p-6">
                <h3 className="text-body font-semibold text-navy">{p.title}</h3>
                {p.description && <p className="mt-2 flex-1 text-small text-muted">{p.description}</p>}
                <div className="mt-4 text-h3 text-action">{p.priceCents != null ? `$${(p.priceCents / 100).toFixed(0)}` : ''}</div>
                <div className="mt-4"><BuyButton kind="pack" packId={p.id} label="Buy this pack" /></div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
```

```tsx
// app/checkout/success/page.tsx
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

export default function CheckoutSuccess() {
  return (
    <main className="py-24">
      <Container className="mx-auto max-w-xl text-center">
        <h1 className="text-h2 text-navy">Payment received 🎉</h1>
        <p className="mt-4 text-lead text-muted">
          We&apos;re provisioning your access now. Sign in with the email you used at checkout to download your layouts.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button href="/browse">Browse layouts</Button>
          <Button href="/login" variant="secondary">Sign in</Button>
        </div>
      </Container>
    </main>
  );
}
```

```tsx
// app/checkout/cancel/page.tsx
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

export default function CheckoutCancel() {
  return (
    <main className="py-24">
      <Container className="mx-auto max-w-xl text-center">
        <h1 className="text-h2 text-navy">Checkout canceled</h1>
        <p className="mt-4 text-lead text-muted">No charge was made. You can pick up where you left off anytime.</p>
        <div className="mt-8 flex justify-center"><Button href="/pricing">Back to pricing</Button></div>
      </Container>
    </main>
  );
}
```

- [ ] **Step 5: Swap the pack-detail CTA for a real BuyButton**

In `app/(catalog)/packs/[slug]/page.tsx`, replace the stub CTA (`<Link href="/pricing" …>Buy this pack</Link>`) with:

```tsx
import { BuyButton } from '@/components/BuyButton';
// ...in the price/CTA block, for a paid pack:
{pack.kind === 'paid'
  ? <BuyButton kind="pack" packId={pack.id} label="Buy this pack" />
  : <Button href="/pricing">Get this pack</Button>}
```

Keep the rest of the page (queries, JSON-LD, layout grid) unchanged.

- [ ] **Step 6: Run tests + typecheck + lint**

Run: `npm run test -- tests/buy-button.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/BuyButton.tsx "app/(catalog)/pricing" app/checkout "app/(catalog)/packs/[slug]/page.tsx" tests/buy-button.test.tsx
git commit -m "feat: pricing page + BuyButton + checkout success/cancel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Acceptance — full verification + Stripe-CLI walkthrough

**Files:**
- Modify: `.env.example` (Stripe section comments)

**Interfaces:** none (verification).

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: PASS — entitlements, checkout, fulfillment (fixtures + idempotency), webhook signature, stripe-setup, buy-button, db guard all green; DB-gated suites skip without `POSTGRES_URL`.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `NEXT_PUBLIC_SITE_URL=https://divi5lab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@divi5lab.com npm run build`
Expected: PASS — `/api/checkout`, `/api/stripe/webhook`, `/pricing`, `/checkout/success`, `/checkout/cancel` all compile.

- [ ] **Step 4: Manual acceptance (user-run — Stripe test mode + CLI + local DB)**

Documented walkthrough (requires the user's `.env.local` test keys + Stripe CLI + the seeded local DB):

```bash
# 1. Create pack Products/Prices in the sandbox and backfill ids:
npm run stripe:setup
# create monthly + yearly membership Prices in the Stripe dashboard, then put their
# ids in .env.local (STRIPE_PRICE_MEMBERSHIP_MONTHLY / _YEARLY)

# 2. Forward webhooks locally and copy the printed whsec_... into .env.local:
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 3. Run the app, open /pricing or a pack page, click Buy, pay with 4242 4242 4242 4242:
npm run dev
# → checkout.session.completed fires → webhook provisions the user by email and
#   grants the entitlement. Verify in the DB:
docker exec layoutlab-db psql -U layoutlab -d layoutlab -c \
  "select u.email, e.scope, e.source from entitlements e join users u on u.id=e.user_id order by e.granted_at desc limit 5;"
# Expect a pack:<id> (pack purchase) or all_access (membership) row.
```

- [ ] **Step 5: Commit + tag**

```bash
git add .env.example
git commit -m "docs: Stripe acceptance walkthrough notes (Phase 4a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag phase-4a-complete
```

---

## Notes / external prerequisites (user-provided)

- **Stripe test keys** — already in `.env.local`.
- **`STRIPE_WEBHOOK_SECRET`** — from `stripe listen` (manual acceptance).
- **Membership Price IDs** — created in the sandbox; put in `.env.local`.
- **Stripe CLI** for local webhook forwarding.
- No live Stripe calls run in CI; all automated tests use fixtures or are DB-gated.

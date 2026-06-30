# Phase 4b — Entitlement-gated Downloads + Account Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in buyer downloads a zip (layout JSON + commercial LICENSE) only for layouts they're entitled to, and manages purchases/re-downloads/billing in an account dashboard.

**Architecture:** `GET /api/download/[layoutId]` calls `requireUser()`, resolves the DB user by session email, checks the 4a `canDownloadLayout` SSOT, streams a zip via the gated route (Blob/local source), and records a `downloads` audit row. Account pages + a Stripe billing-portal route round it out.

**Tech Stack:** Next.js 15 route handlers + RSC, Drizzle ORM, Stripe SDK (billing portal), `jszip`, Vitest. Builds on the 4a entitlements/orders/subscriptions + `users.stripeCustomerId`.

## Global Constraints

- **Entitlement enforced server-side on every download** via `canDownloadLayout` (the 4a SSOT). The layout JSON is never reachable without an entitlement. (§2.5)
- **Resolve the user by session EMAIL → DB user id**, NOT the session id. The dev login stub sets `session.user.id='temp'`; entitlements bind to the real DB user (created by the 4a webhook keyed on email). Email is the link (matches guest-checkout).
- **Every download is a zip of `<slug>.json` + `LICENSE.txt`** (jszip). (§12)
- **License text is the committed user-provided file** `lib/license/commercial-license.txt` — used verbatim; editing the file needs no code change.
- **Downloads + account require a signed-in user** (`requireUser` → redirect `/login`). Works locally via the dev login; production needs Phase 5 auth.
- **Record a `downloads` row** on each successful download (audit).
- **Secrets server-only.** Stripe portal uses `users.stripeCustomerId` (from 4a).
- **TDD first**; DB/Stripe-touching tests gated on `POSTGRES_URL` / skip without live deps.
- **Commit after every task** with a conventional-commit message ending in the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `requireUser` gate

**Files:**
- Modify: `lib/auth/admin.ts`
- Test: `tests/user-gate.test.ts`

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`).
- Produces: `userGateDecision(session): 'ok' | 'unauthenticated'` (pure); `requireUser(): Promise<Session>` (redirects `/login` if not signed in, else returns the session).

- [ ] **Step 1: Write the failing test**

```ts
// tests/user-gate.test.ts
import { describe, it, expect } from 'vitest';
import { userGateDecision } from '@/lib/auth/admin';

describe('userGateDecision', () => {
  it('ok for any signed-in user', () => {
    expect(userGateDecision({ user: { email: 'a@b.c' } } as any)).toBe('ok');
  });
  it('unauthenticated for no session / no user', () => {
    expect(userGateDecision(null)).toBe('unauthenticated');
    expect(userGateDecision({} as any)).toBe('unauthenticated');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/user-gate.test.ts`
Expected: FAIL — `userGateDecision` not exported.

- [ ] **Step 3: Implement (append to `lib/auth/admin.ts`)**

```ts
export function userGateDecision(session: Session | null): 'ok' | 'unauthenticated' {
  return session?.user ? 'ok' : 'unauthenticated';
}

export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session as Session;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/user-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/auth/admin.ts tests/user-gate.test.ts
git commit -m "feat: requireUser gate for signed-in routes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: License file + zip builder

**Files:**
- Create: `lib/license/commercial-license.txt`, `lib/license/index.ts`, `lib/download/zip.ts`
- Modify: `package.json` (add `jszip`)
- Test: `tests/zip.test.ts`

**Interfaces:**
- Produces: `readLicense(): string`; `buildLayoutZip(layoutJson: string, slug: string, license: string): Promise<Buffer>` — a zip containing `<slug>.json` + `LICENSE.txt`.

- [ ] **Step 1: Install jszip**

Run: `npm install jszip`
Expected: installs (jszip ships its own types).

- [ ] **Step 2: Create the license file (user-provided text)**

```text
// lib/license/commercial-license.txt
COMMERCIAL LICENSE AGREEMENT

Copyright © 2026 Lucas Lopvet - Lucas Lopvet

This license grants the purchaser the right to use the purchased Divi layout files
for creating websites for themselves or their clients.

Allowed:
- Use the layout on unlimited websites owned by the purchaser.
- Use the layout to build websites for clients.
- Modify, customize, and adapt the layout.
- Use the finished websites for commercial purposes.

Not allowed:
- Redistribute, resell, sublicense, or share the original layout JSON files.
- Include the layout files in another product, marketplace, bundle, or template library.
- Claim the original layout design as your own product.

Ownership:
The original layout files and design assets remain the property of
Lucas Lopvet.

By downloading these files, you agree to these terms.

For support:

divi5lab.com
info@divi5lab.com
```

- [ ] **Step 3: Write the failing test**

```ts
// tests/zip.test.ts
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildLayoutZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';

describe('readLicense', () => {
  it('returns the committed commercial license text', () => {
    const txt = readLicense();
    expect(txt).toContain('COMMERCIAL LICENSE AGREEMENT');
    expect(txt).toContain('Not allowed:');
  });
});

describe('buildLayoutZip', () => {
  it('produces a zip with <slug>.json and LICENSE.txt', async () => {
    const buf = await buildLayoutZip('{"content":[]}', 'bold-saas-hero', 'LICENSE BODY');
    const zip = await JSZip.loadAsync(buf);
    expect(zip.file('bold-saas-hero.json')).not.toBeNull();
    expect(zip.file('LICENSE.txt')).not.toBeNull();
    expect(await zip.file('bold-saas-hero.json')!.async('string')).toBe('{"content":[]}');
    expect(await zip.file('LICENSE.txt')!.async('string')).toBe('LICENSE BODY');
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm run test -- tests/zip.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 5: Implement**

```ts
// lib/license/index.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readLicense(): string {
  return readFileSync(join(process.cwd(), 'lib', 'license', 'commercial-license.txt'), 'utf8');
}
```

```ts
// lib/download/zip.ts
import JSZip from 'jszip';

export async function buildLayoutZip(layoutJson: string, slug: string, license: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${slug}.json`, layoutJson);
  zip.file('LICENSE.txt', license);
  return zip.generateAsync({ type: 'nodebuffer' });
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- tests/zip.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/license lib/download/zip.ts package.json package-lock.json tests/zip.test.ts
git commit -m "feat: commercial license file + layout zip builder (json + LICENSE)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `fetchAsset` (Blob or local)

**Files:**
- Modify: `lib/blob/index.ts`
- Test: `tests/fetch-asset.test.ts`

**Interfaces:**
- Consumes: `assetUrl` (`@/lib/blob/url`).
- Produces: `fetchAsset(key: string): Promise<Buffer | null>` — returns the bytes for a key, reading a local file if `key` is an existing local path, else fetching `assetUrl(key)`; `null` when missing/unreachable.

- [ ] **Step 1: Write the failing test**

```ts
// tests/fetch-asset.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchAsset } from '@/lib/blob';

afterEach(() => vi.unstubAllGlobals());

describe('fetchAsset', () => {
  it('reads a local file path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'asset-'));
    const file = join(dir, 'layout.json');
    writeFileSync(file, '{"x":1}');
    const buf = await fetchAsset(file);
    expect(buf?.toString('utf8')).toBe('{"x":1}');
    rmSync(dir, { recursive: true, force: true });
  });
  it('returns null for a missing local path', async () => {
    expect(await fetchAsset('/no/such/file.json')).toBeNull();
  });
  it('fetches an absolute URL and returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })) as any);
    expect(await fetchAsset('https://example.com/x.json')).toBeNull();
  });
  it('returns the bytes for an ok URL response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('hi').buffer })) as any);
    expect((await fetchAsset('https://example.com/x.json'))?.toString('utf8')).toBe('hi');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/fetch-asset.test.ts`
Expected: FAIL — `fetchAsset` not exported.

- [ ] **Step 3: Implement (append to `lib/blob/index.ts`)**

```ts
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { assetUrl } from './url';

// Reads an asset's bytes for the download route: a local pipeline file if the
// key is an existing local path, else fetches the resolved (Blob/absolute) URL.
// Returns null when the asset doesn't exist (→ route 404).
export async function fetchAsset(key: string): Promise<Buffer | null> {
  if (!key) return null;
  if (!/^https?:\/\//.test(key) && existsSync(key)) {
    return readFile(key).catch(() => null);
  }
  try {
    const res = await fetch(assetUrl(key));
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/fetch-asset.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/blob/index.ts tests/fetch-asset.test.ts
git commit -m "feat: fetchAsset (local file or Blob) for gated downloads

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Account/download queries

**Files:**
- Create: `lib/account/queries.ts`
- Test: `tests/account-queries.test.ts`

**Interfaces:**
- Consumes: `db`, schema tables, `LayoutRow` (`@/lib/catalog/queries`), `UserEntitlement` (`@/lib/stripe/entitlements`).
- Produces:
  - `summarizeEntitlements(entitlements: UserEntitlement[], now?: Date): { allAccess: boolean; ownedPackIds: string[] }` (pure).
  - `getUserIdByEmail(email: string): Promise<string | null>`
  - `getEntitlementsForUser(userId: string): Promise<UserEntitlement[]>`
  - `getLayoutForDownload(layoutId: string): Promise<{ id: string; slug: string; diviJsonBlobKey: string } | null>` (published only)
  - `getLayoutPackContext(layoutId: string): Promise<{ packIds: string[]; packKindById: Record<string,'free'|'paid'> }>`
  - `getOrdersForUser(userId)`, `getActiveSubscription(userId)`
  - `getDownloadableLayouts(userId: string): Promise<LayoutRow[]>` — owned-pack layouts, or all published if active `all_access`.
  - `recordDownload(userId: string | null, layoutId: string, ip: string | null): Promise<void>`

- [ ] **Step 1: Write the failing test (pure summarizer + gated integration)**

```ts
// tests/account-queries.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeEntitlements } from '@/lib/account/queries';

const NOW = new Date('2026-06-28T00:00:00Z');

describe('summarizeEntitlements', () => {
  it('flags active all_access', () => {
    expect(summarizeEntitlements([{ scope: 'all_access', source: 'subscription', expiresAt: null }], NOW).allAccess).toBe(true);
  });
  it('ignores expired all_access and collects owned pack ids', () => {
    const r = summarizeEntitlements([
      { scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') },
      { scope: 'pack:p1', source: 'order', expiresAt: null },
      { scope: 'pack:p2', source: 'order', expiresAt: null },
    ], NOW);
    expect(r.allAccess).toBe(false);
    expect(r.ownedPackIds.sort()).toEqual(['p1', 'p2']);
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('account queries (integration — needs a seeded POSTGRES_URL)', () => {
  it('getUserIdByEmail returns null for an unknown email', async () => {
    const q = await import('@/lib/account/queries');
    expect(await q.getUserIdByEmail('nobody@example.com')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails / skips**

Run: `npm run test -- tests/account-queries.test.ts`
Expected: FAIL — module not found. (Integration block skips without a DB.)

- [ ] **Step 3: Implement**

```ts
// lib/account/queries.ts
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, layouts, packs, packLayouts, entitlements, orders, subscriptions, downloads } from '@/db/schema';
import type { LayoutRow } from '@/lib/catalog/queries';
import { type UserEntitlement, isActiveAllAccess } from '@/lib/stripe/entitlements';

export function summarizeEntitlements(
  entitlementsList: UserEntitlement[],
  now: Date = new Date(),
): { allAccess: boolean; ownedPackIds: string[] } {
  const allAccess = entitlementsList.some((e) => isActiveAllAccess(e, now));
  const ownedPackIds = entitlementsList
    .filter((e) => e.scope.startsWith('pack:'))
    .map((e) => e.scope.slice('pack:'.length));
  return { allAccess, ownedPackIds };
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0]?.id ?? null;
}

export async function getEntitlementsForUser(userId: string): Promise<UserEntitlement[]> {
  return db.select({ scope: entitlements.scope, source: entitlements.source, expiresAt: entitlements.expiresAt })
    .from(entitlements).where(eq(entitlements.userId, userId));
}

export async function getLayoutForDownload(layoutId: string) {
  const rows = await db.select({ id: layouts.id, slug: layouts.slug, diviJsonBlobKey: layouts.diviJsonBlobKey })
    .from(layouts).where(and(eq(layouts.id, layoutId), eq(layouts.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function getLayoutPackContext(layoutId: string): Promise<{ packIds: string[]; packKindById: Record<string, 'free' | 'paid'> }> {
  const rows = await db.select({ packId: packs.id, kind: packs.kind })
    .from(packLayouts).innerJoin(packs, eq(packLayouts.packId, packs.id))
    .where(eq(packLayouts.layoutId, layoutId));
  const packIds = rows.map((r) => r.packId);
  const packKindById: Record<string, 'free' | 'paid'> = {};
  for (const r of rows) packKindById[r.packId] = r.kind;
  return { packIds, packKindById };
}

export async function getOrdersForUser(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getActiveSubscription(userId: string) {
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.currentPeriodEnd)).limit(1);
  return rows[0] ?? null;
}

export async function getDownloadableLayouts(userId: string): Promise<LayoutRow[]> {
  const ents = await getEntitlementsForUser(userId);
  const { allAccess, ownedPackIds } = summarizeEntitlements(ents);
  if (allAccess) {
    return db.select().from(layouts).where(eq(layouts.status, 'published')).orderBy(desc(layouts.createdAt));
  }
  if (ownedPackIds.length === 0) return [];
  const rows = await db.selectDistinct({ layout: layouts }).from(packLayouts)
    .innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
    .where(and(inArray(packLayouts.packId, ownedPackIds), eq(layouts.status, 'published')));
  return rows.map((r) => r.layout);
}

export async function recordDownload(userId: string | null, layoutId: string, ip: string | null): Promise<void> {
  await db.insert(downloads).values({ id: randomUUID(), userId: userId ?? undefined, layoutId, ip: ip ?? undefined });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/account-queries.test.ts`
Expected: PASS — `summarizeEntitlements` cases pass; integration skips without a DB.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/account/queries.ts tests/account-queries.test.ts
git commit -m "feat: account/download queries + entitlement summarizer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Download route

**Files:**
- Create: `app/api/download/[layoutId]/route.ts`
- Test: `tests/download-route.test.ts`

**Interfaces:**
- Consumes: `requireUser` (Task 1), `getUserIdByEmail`/`getLayoutForDownload`/`getLayoutPackContext`/`getEntitlementsForUser`/`recordDownload` (Task 4), `canDownloadLayout` (`@/lib/stripe/entitlements`), `fetchAsset` (Task 3), `buildLayoutZip` (Task 2), `readLicense` (Task 2).
- Produces: `GET(req, { params })` at `/api/download/[layoutId]` — 404 unknown layout, 403 not entitled, 404 asset missing, 200 zip attachment for an entitled user.

- [ ] **Step 1: Write the failing test (deps mocked — no DB/auth/network)**

```ts
// tests/download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireUser = vi.fn(async () => ({ user: { email: 'buyer@example.com' } }));
const getUserIdByEmail = vi.fn(async () => 'u1');
const getLayoutForDownload = vi.fn(async () => ({ id: 'l1', slug: 'bold-saas-hero', diviJsonBlobKey: 'pipeline/out/x.json' }));
const getLayoutPackContext = vi.fn(async () => ({ packIds: ['p1'], packKindById: { p1: 'paid' } }));
const getEntitlementsForUser = vi.fn(async () => [] as any[]);
const recordDownload = vi.fn(async () => {});
const fetchAsset = vi.fn(async () => Buffer.from('{"content":[]}'));

vi.mock('@/lib/auth/admin', () => ({ requireUser }));
vi.mock('@/lib/account/queries', () => ({ getUserIdByEmail, getLayoutForDownload, getLayoutPackContext, getEntitlementsForUser, recordDownload }));
vi.mock('@/lib/blob', () => ({ fetchAsset }));

import { GET } from '@/app/api/download/[layoutId]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ layoutId: id }) });
const req = () => new Request('http://test/api/download/l1');

beforeEach(() => { getEntitlementsForUser.mockResolvedValue([]); fetchAsset.mockResolvedValue(Buffer.from('{"content":[]}')); recordDownload.mockClear(); });

describe('GET /api/download/[layoutId]', () => {
  it('403 when the user is not entitled', async () => {
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(403);
    expect(recordDownload).not.toHaveBeenCalled();
  });

  it('200 zip when entitled (owns the pack)', async () => {
    getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:p1', source: 'order', expiresAt: null }]);
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('bold-saas-hero.zip');
    expect(recordDownload).toHaveBeenCalledWith('u1', 'l1', null);
  });

  it('404 when the asset is unavailable', async () => {
    getEntitlementsForUser.mockResolvedValue([{ scope: 'all_access', source: 'subscription', expiresAt: null }]);
    fetchAsset.mockResolvedValue(null);
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/download-route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

```ts
// app/api/download/[layoutId]/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/admin';
import {
  getUserIdByEmail, getLayoutForDownload, getLayoutPackContext, getEntitlementsForUser, recordDownload,
} from '@/lib/account/queries';
import { canDownloadLayout } from '@/lib/stripe/entitlements';
import { fetchAsset } from '@/lib/blob';
import { buildLayoutZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ layoutId: string }> }): Promise<Response> {
  const session = await requireUser();
  const { layoutId } = await params;

  const layout = await getLayoutForDownload(layoutId);
  if (!layout) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const email = session.user?.email ?? null;
  const userId = email ? await getUserIdByEmail(email) : null;
  const ctx = await getLayoutPackContext(layout.id);
  const userEntitlements = userId ? await getEntitlementsForUser(userId) : [];

  const allowed = canDownloadLayout({
    layoutPackIds: ctx.packIds,
    packKindById: ctx.packKindById,
    userEntitlements,
  });
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const bytes = await fetchAsset(layout.diviJsonBlobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });

  const zip = await buildLayoutZip(bytes.toString('utf8'), layout.slug, readLicense());
  await recordDownload(userId, layout.id, req.headers.get('x-forwarded-for'));

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${layout.slug}.zip"`,
    },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/download-route.test.ts`
Expected: PASS (403 / 200-zip / 404-asset).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add "app/api/download/[layoutId]/route.ts" tests/download-route.test.ts
git commit -m "feat: entitlement-gated download route (zip stream + audit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Stripe billing portal

**Files:**
- Create: `lib/stripe/portal.ts`, `app/api/billing/portal/route.ts`
- Test: `tests/billing-portal.test.ts`

**Interfaces:**
- Consumes: `stripe` client, `requireUser`, `db`/`users`, `getUserIdByEmail`.
- Produces:
  - `createBillingPortalSession(customerId: string, returnUrl: string): Promise<string>` (returns the portal url).
  - `POST /api/billing/portal` → `{ url }` (400 if the user has no Stripe customer).

- [ ] **Step 1: Write the failing test (no-customer path; no Stripe call)**

```ts
// tests/billing-portal.test.ts
import { describe, it, expect, vi } from 'vitest';

const requireUser = vi.fn(async () => ({ user: { email: 'buyer@example.com' } }));
const getStripeCustomerIdByEmail = vi.fn(async () => null as string | null);

vi.mock('@/lib/auth/admin', () => ({ requireUser }));
vi.mock('@/lib/account/queries', () => ({ getStripeCustomerIdByEmail }));

import { POST } from '@/app/api/billing/portal/route';

describe('POST /api/billing/portal', () => {
  it('400 when the user has no Stripe customer', async () => {
    const res = await POST(new Request('http://test/api/billing/portal', { method: 'POST' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/billing-portal.test.ts`
Expected: FAIL — route + `getStripeCustomerIdByEmail` not found.

- [ ] **Step 3: Add the query helper**

Append to `lib/account/queries.ts`:

```ts
export async function getStripeCustomerIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ cid: users.stripeCustomerId }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0]?.cid ?? null;
}
```

- [ ] **Step 4: Implement the portal lib + route**

```ts
// lib/stripe/portal.ts
import { stripe } from './client';

export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}
```

```ts
// app/api/billing/portal/route.ts
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { requireUser } from '@/lib/auth/admin';
import { getStripeCustomerIdByEmail } from '@/lib/account/queries';
import { createBillingPortalSession } from '@/lib/stripe/portal';

export const runtime = 'nodejs';

export async function POST(_req: Request): Promise<Response> {
  const session = await requireUser();
  const email = session.user?.email;
  const customerId = email ? await getStripeCustomerIdByEmail(email) : null;
  if (!customerId) return NextResponse.json({ error: 'no_billing_account' }, { status: 400 });
  const url = await createBillingPortalSession(customerId, `${env.NEXT_PUBLIC_SITE_URL}/account/billing`);
  return NextResponse.json({ url });
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/billing-portal.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/stripe/portal.ts app/api/billing/portal/route.ts lib/account/queries.ts tests/billing-portal.test.ts
git commit -m "feat: Stripe billing portal route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Account pages + client buttons

**Files:**
- Create: `components/DownloadButton.tsx`, `components/BillingButton.tsx`, `app/(account)/account/page.tsx`, `app/(account)/account/purchases/page.tsx`, `app/(account)/account/downloads/page.tsx`, `app/(account)/account/billing/page.tsx`
- Test: `tests/account-buttons.test.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 1), `getUserIdByEmail`/`getDownloadableLayouts`/`getOrdersForUser`/`getActiveSubscription`/`getEntitlementsForUser` (Task 4), primitives (`Container`/`Card`/`Button`/`SectionTitle`), `LayoutCard`.
- Produces: the four `/account/*` pages (all `requireUser`); `DownloadButton({ layoutId, slug })` (anchor to `/api/download/<id>`); `BillingButton()` (POSTs `/api/billing/portal`, redirects).

- [ ] **Step 1: Write the failing component test**

```tsx
// tests/account-buttons.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { DownloadButton } from '@/components/DownloadButton';
import { BillingButton } from '@/components/BillingButton';

describe('DownloadButton', () => {
  it('links to the gated download endpoint', () => {
    const { container } = render(<DownloadButton layoutId="l1" slug="bold-saas-hero" />);
    expect(container.querySelector('a[href="/api/download/l1"]')).not.toBeNull();
  });
});

describe('BillingButton', () => {
  it('posts to the portal and redirects to the returned url', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://billing.test/p' }) })) as any;
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const { getByRole } = render(<BillingButton />);
    fireEvent.click(getByRole('button', { name: /manage billing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/billing/portal', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.test/p'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/account-buttons.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement the client buttons**

```tsx
// components/DownloadButton.tsx
import Link from 'next/link';
export function DownloadButton({ layoutId, slug }: { layoutId: string; slug: string }) {
  return (
    <Link
      href={`/api/download/${layoutId}`}
      className="inline-flex h-10 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
      download={`${slug}.zip`}
    >
      Download
    </Link>
  );
}
```

```tsx
// components/BillingButton.tsx
'use client';
import { useState } from 'react';
export function BillingButton() {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.assign(data.url);
      else setLoading(false);
    } catch { setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading}
      className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-base font-semibold text-paper hover:brightness-110 disabled:opacity-40">
      {loading ? 'Opening…' : 'Manage billing'}
    </button>
  );
}
```

- [ ] **Step 4: Implement the account pages**

```tsx
// app/(account)/account/page.tsx
import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getActiveSubscription } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const sub = userId ? await getActiveSubscription(userId) : null;

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Your account</h1>
        <p className="mt-2 text-body text-muted">{email}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: '/account/downloads', label: 'Downloads' },
            { href: '/account/purchases', label: 'Purchases' },
            { href: '/account/billing', label: 'Billing' },
          ].map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="p-6"><div className="text-section text-navy">{c.label}</div></Card>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-small text-muted">
          Membership: {sub && sub.status === 'active' ? 'Active (all-access)' : 'None'}
        </p>
      </Container>
    </main>
  );
}
```

```tsx
// app/(account)/account/downloads/page.tsx
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getDownloadableLayouts } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { DownloadButton } from '@/components/DownloadButton';

export const dynamic = 'force-dynamic';

export default async function DownloadsPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const layouts = userId ? await getDownloadableLayouts(userId) : [];

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Downloads</h1>
        {layouts.length === 0 ? (
          <p className="mt-4 text-body text-muted">No downloads yet. Browse the catalog to get started.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {layouts.map((l) => (
              <li key={l.id}>
                <Card className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-body font-semibold text-navy">{l.title}</div>
                    <div className="text-small capitalize text-muted">{l.type} · {l.niche} · {l.style}</div>
                  </div>
                  <DownloadButton layoutId={l.id} slug={l.slug} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
```

```tsx
// app/(account)/account/purchases/page.tsx
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getOrdersForUser, getEntitlementsForUser } from '@/lib/account/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const orders = userId ? await getOrdersForUser(userId) : [];
  const ents = userId ? await getEntitlementsForUser(userId) : [];

  return (
    <main className="py-12">
      <Container>
        <h1 className="text-h2 text-navy">Purchases</h1>
        <h2 className="mt-8 text-section text-navy">Orders</h2>
        {orders.length === 0 ? <p className="mt-2 text-body text-muted">No orders yet.</p> : (
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li key={o.id}><Card className="flex justify-between p-4">
                <span className="text-body text-navy">${(o.amountCents / 100).toFixed(2)}</span>
                <span className="text-small capitalize text-muted">{o.status}</span>
              </Card></li>
            ))}
          </ul>
        )}
        <h2 className="mt-8 text-section text-navy">Access</h2>
        <ul className="mt-3 space-y-2">
          {ents.map((e, i) => (
            <li key={i} className="text-body text-muted capitalize">{e.scope.replace(':', ': ')} <span className="text-small">({e.source})</span></li>
          ))}
          {ents.length === 0 && <li className="text-body text-muted">No access grants yet.</li>}
        </ul>
      </Container>
    </main>
  );
}
```

```tsx
// app/(account)/account/billing/page.tsx
import { requireUser } from '@/lib/auth/admin';
import { Container } from '@/components/ui/Container';
import { BillingButton } from '@/components/BillingButton';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  await requireUser();
  return (
    <main className="py-12">
      <Container className="max-w-xl">
        <h1 className="text-h2 text-navy">Billing</h1>
        <p className="mt-4 text-body text-muted">Manage your membership, payment method, and invoices in the Stripe customer portal.</p>
        <div className="mt-6"><BillingButton /></div>
      </Container>
    </main>
  );
}
```

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `npm run test -- tests/account-buttons.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/DownloadButton.tsx components/BillingButton.tsx "app/(account)/account" tests/account-buttons.test.tsx
git commit -m "feat: account dashboard (downloads, purchases, billing) + buttons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Acceptance — full verification + walkthrough

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: PASS — user-gate, zip, fetch-asset, account-queries (summarizer), download-route, billing-portal, account-buttons green; DB-gated suites skip without `POSTGRES_URL`; all prior suites still green.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `NEXT_PUBLIC_SITE_URL=https://divi5lab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@divi5lab.com npm run build`
Expected: PASS — `/api/download/[layoutId]`, `/api/billing/portal`, `/account`, `/account/downloads`, `/account/purchases`, `/account/billing` all compile.

- [ ] **Step 4: Manual acceptance (user-run — local DB + a real entitlement)**

```bash
# Pre: complete a 4a test purchase so an entitlement exists, OR generate one layout
# with a real local JSON via the pipeline (npm run pipeline -- drip --count=1) so
# diviJsonBlobKey points at a real pipeline/out file.
# Then:
npm run dev
# 1. Sign in at /login with the email used at checkout.
# 2. /account/downloads lists the entitled layout → click Download → get a .zip
#    containing <slug>.json + LICENSE.txt.
# 3. Try GET /api/download/<a-layout-id-you-don't-own> → 403.
# 4. /account/billing → Manage billing → opens the Stripe customer portal.
```

- [ ] **Step 5: Commit (empty if nothing changed) + tag**

```bash
git commit --allow-empty -m "chore: Phase 4b acceptance verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag phase-4b-complete
```

---

## Notes / external prerequisites (user-provided)

- A **real entitlement** (from a 4a test purchase) and a layout whose
  `diviJsonBlobKey` points at a **real file** (a pipeline-generated layout, since
  seed previews are placeholders) are needed for the manual download walkthrough.
- The **Stripe billing portal** requires the user to have a `stripeCustomerId`
  (set by the 4a webhook on first purchase) and the Customer Portal enabled in the
  Stripe dashboard (test mode).
- Downloads/account need a **signed-in user** — dev login locally; Phase 5 real auth for production.

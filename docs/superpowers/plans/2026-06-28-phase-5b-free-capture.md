# Phase 5b — Free-Pack Email Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make free packs working lead magnets — capture an email → sync to Loops → grant a free entitlement → email a magic sign-in link → the user downloads from their account (reusing 5a auth + the 4b download flow).

**Architecture:** A dependency-injected `captureFreePack` orchestration (validate free pack → record capture → Loops sync → find/create user → grant `pack:<id>` `source:'free'` entitlement). The on-site form is a server action that runs it then `signIn('email', …)`. A thin `POST /api/capture` exposes the same capture for programmatic use. Nothing in the download SSOT changes — `canDownloadLayout` already honors any `pack:<id>` entitlement.

**Tech Stack:** Next.js 15 (route handlers + server actions), Drizzle, Loops REST API, next-auth `signIn`, Vitest.

## Global Constraints

- **Free download requires inbox control:** capture grants a `pack:<id>` entitlement (`source:'free'`) and sends a magic link; the user must click it to sign in and download. Do NOT add an unauthenticated download path; do NOT touch `canDownloadLayout` or `freeCapturedPackIds`.
- **Loops gated:** with `LOOPS_API_KEY` sync the contact; without it (dev) log + `{ synced: false }` and never throw. A Loops failure NEVER blocks the capture/entitlement.
- **Only `kind='free'` + `status='published'` packs are capturable** — anything else is rejected (422 / action redirect-with-error), no capture row, no entitlement.
- **Idempotent grant:** the entitlement insert is `onConflictDoNothing` on `entitlements_user_scope_uq` (unique `user_id`+`scope`).
- **Normalize email** to `email.trim().toLowerCase()` at the capture entry point.
- **Secrets server-only** (`LOOPS_API_KEY`); zod-validate route input; rate-limit `/api/capture`.
- Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Loops client (`lib/email/loops.ts`)

**Files:**
- Create: `lib/email/loops.ts`
- Test: `tests/loops.test.ts`

**Interfaces:**
- Produces: `syncContact(input: { email: string; source?: string; packId?: string }): Promise<{ synced: boolean }>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/loops.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIG = { ...process.env };
beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { process.env = { ...ORIG }; vi.unstubAllGlobals(); vi.resetModules(); });

describe('syncContact', () => {
  it('no LOOPS_API_KEY: logs, no fetch, returns { synced: false }', async () => {
    delete process.env.LOOPS_API_KEY;
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { syncContact } = await import('@/lib/email/loops');
    const res = await syncContact({ email: 'a@b.c', packId: 'p1' });
    expect(res).toEqual({ synced: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('with key: POSTs to Loops with bearer + email, returns { synced: true }', async () => {
    process.env.LOOPS_API_KEY = 'loops_test';
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { syncContact } = await import('@/lib/email/loops');
    const res = await syncContact({ email: 'a@b.c', source: 'free_pack', packId: 'p1' });
    expect(res).toEqual({ synced: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('app.loops.so/api/v1/contacts/update');
    expect(init.headers.Authorization).toBe('Bearer loops_test');
    expect(JSON.parse(init.body).email).toBe('a@b.c');
  });

  it('with key but API error: returns { synced: false } (does not throw)', async () => {
    process.env.LOOPS_API_KEY = 'loops_test';
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { syncContact } = await import('@/lib/email/loops');
    expect(await syncContact({ email: 'a@b.c' })).toEqual({ synced: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/loops.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/email/loops.ts
const LOOPS_URL = 'https://app.loops.so/api/v1/contacts/update';

export async function syncContact(input: { email: string; source?: string; packId?: string }): Promise<{ synced: boolean }> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.log(`[loops:dev] no LOOPS_API_KEY — would sync contact ${input.email}` + (input.packId ? ` (pack ${input.packId})` : ''));
    return { synced: false };
  }
  try {
    const res = await fetch(LOOPS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.email, source: input.source ?? 'website', ...(input.packId ? { freePackId: input.packId } : {}) }),
    });
    if (!res.ok) { console.error(`[loops] sync failed: ${res.status}`); return { synced: false }; }
    return { synced: true };
  } catch (err) {
    console.error('[loops] sync error:', err);
    return { synced: false };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/loops.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/email/loops.ts tests/loops.test.ts
git commit -m "feat: Loops contact sync (gated; keyless-dev log, never blocks capture)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: In-memory rate limiter (`lib/rate-limit`)

**Files:**
- Create: `lib/rate-limit/index.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Produces: `rateLimit(key: string, opts: { limit: number; windowMs: number; now?: number }): { ok: boolean; remaining: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, __resetRateLimit } from '@/lib/rate-limit';

beforeEach(() => __resetRateLimit());

describe('rateLimit', () => {
  it('allows up to `limit` in a window, then blocks', () => {
    const opts = { limit: 3, windowMs: 1000, now: 1000 };
    expect(rateLimit('k', opts)).toEqual({ ok: true, remaining: 2 });
    expect(rateLimit('k', opts)).toEqual({ ok: true, remaining: 1 });
    expect(rateLimit('k', opts)).toEqual({ ok: true, remaining: 0 });
    expect(rateLimit('k', opts)).toEqual({ ok: false, remaining: 0 });
  });

  it('resets after the window elapses', () => {
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 1000 }).ok).toBe(true);
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 1500 }).ok).toBe(false);
    expect(rateLimit('k', { limit: 1, windowMs: 1000, now: 2100 }).ok).toBe(true);
  });

  it('tracks keys independently', () => {
    const o = { limit: 1, windowMs: 1000, now: 1000 };
    expect(rateLimit('a', o).ok).toBe(true);
    expect(rateLimit('b', o).ok).toBe(true);
    expect(rateLimit('a', o).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/rate-limit/index.ts
// Best-effort in-memory fixed-window limiter. Per-instance only (resets on cold
// start; not shared across serverless instances) — a stopgap to be replaced by a
// shared store (Vercel KV/Upstash). See CLAUDE.md §16.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { limit: number; windowMs: number; now?: number }): { ok: boolean; remaining: number } {
  const now = opts.now ?? Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1 };
  }
  if (b.count >= opts.limit) return { ok: false, remaining: 0 };
  b.count += 1;
  return { ok: true, remaining: opts.limit - b.count };
}

/** Test-only: clear all buckets. */
export function __resetRateLimit(): void { buckets.clear(); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/rate-limit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/rate-limit/index.ts tests/rate-limit.test.ts
git commit -m "feat: in-memory fixed-window rate limiter (stopgap; per-instance)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Capture orchestration (`lib/capture/capture.ts`)

**Files:**
- Create: `lib/capture/capture.ts`
- Test: `tests/capture.test.ts`

**Interfaces:**
- Consumes: `syncContact` shape (Task 1) — passed via deps.
- Produces:
  - `normalizeEmail(email: string): string`
  - `class CaptureError extends Error` (with `code: 'not_free'`)
  - `interface CaptureDeps { getFreePack(packId): Promise<{ id: string } | null>; recordCapture(email, packId): Promise<string>; setCaptureSynced(captureId, synced): Promise<void>; syncContact(input: { email: string; packId?: string; source?: string }): Promise<{ synced: boolean }>; findOrCreateUserByEmail(email): Promise<string>; grantFreeEntitlement(userId, packId): Promise<void>; }`
  - `captureFreePack(input: { email: string; packId: string }, deps: CaptureDeps): Promise<{ ok: true; email: string }>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/capture.test.ts
import { describe, it, expect, vi } from 'vitest';
import { captureFreePack, normalizeEmail, CaptureError } from '@/lib/capture/capture';

function deps(over: Partial<any> = {}) {
  return {
    getFreePack: vi.fn(async () => ({ id: 'p1' })),
    recordCapture: vi.fn(async () => 'cap1'),
    setCaptureSynced: vi.fn(async () => {}),
    syncContact: vi.fn(async () => ({ synced: true })),
    findOrCreateUserByEmail: vi.fn(async () => 'u1'),
    grantFreeEntitlement: vi.fn(async () => {}),
    ...over,
  };
}

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
});

describe('captureFreePack', () => {
  it('rejects a non-free/unpublished pack (getFreePack null) — no capture, no grant', async () => {
    const d = deps({ getFreePack: vi.fn(async () => null) });
    await expect(captureFreePack({ email: 'a@b.c', packId: 'p1' }, d)).rejects.toBeInstanceOf(CaptureError);
    expect(d.recordCapture).not.toHaveBeenCalled();
    expect(d.grantFreeEntitlement).not.toHaveBeenCalled();
  });

  it('happy path: record → sync → setSynced(true) → user → grant, normalized email', async () => {
    const d = deps();
    const res = await captureFreePack({ email: '  A@B.com ', packId: 'p1' }, d);
    expect(res).toEqual({ ok: true, email: 'a@b.com' });
    expect(d.recordCapture).toHaveBeenCalledWith('a@b.com', 'p1');
    expect(d.syncContact).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', packId: 'p1' }));
    expect(d.setCaptureSynced).toHaveBeenCalledWith('cap1', true);
    expect(d.findOrCreateUserByEmail).toHaveBeenCalledWith('a@b.com');
    expect(d.grantFreeEntitlement).toHaveBeenCalledWith('u1', 'p1');
  });

  it('Loops down (synced:false): still grants, marks setSynced(false)', async () => {
    const d = deps({ syncContact: vi.fn(async () => ({ synced: false })) });
    const res = await captureFreePack({ email: 'a@b.c', packId: 'p1' }, d);
    expect(res.ok).toBe(true);
    expect(d.setCaptureSynced).toHaveBeenCalledWith('cap1', false);
    expect(d.grantFreeEntitlement).toHaveBeenCalledWith('u1', 'p1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/capture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/capture/capture.ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class CaptureError extends Error {
  code: 'not_free';
  constructor(code: 'not_free' = 'not_free') {
    super(code);
    this.name = 'CaptureError';
    this.code = code;
  }
}

export interface CaptureDeps {
  getFreePack(packId: string): Promise<{ id: string } | null>;
  recordCapture(email: string, packId: string): Promise<string>;
  setCaptureSynced(captureId: string, synced: boolean): Promise<void>;
  syncContact(input: { email: string; packId?: string; source?: string }): Promise<{ synced: boolean }>;
  findOrCreateUserByEmail(email: string): Promise<string>;
  grantFreeEntitlement(userId: string, packId: string): Promise<void>;
}

export async function captureFreePack(
  input: { email: string; packId: string },
  deps: CaptureDeps,
): Promise<{ ok: true; email: string }> {
  const email = normalizeEmail(input.email);
  const pack = await deps.getFreePack(input.packId);
  if (!pack) throw new CaptureError('not_free');

  const captureId = await deps.recordCapture(email, input.packId);
  const { synced } = await deps.syncContact({ email, packId: input.packId, source: 'free_pack' });
  await deps.setCaptureSynced(captureId, synced);

  const userId = await deps.findOrCreateUserByEmail(email);
  await deps.grantFreeEntitlement(userId, input.packId);

  return { ok: true, email };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/capture.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/capture/capture.ts tests/capture.test.ts
git commit -m "feat: captureFreePack orchestration (DI; reject non-free, idempotent grant)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Real capture deps over Drizzle (`lib/capture/store.ts`)

**Files:**
- Create: `lib/capture/store.ts`
- Test: `tests/capture-store.test.ts`

**Interfaces:**
- Consumes: `db`, `packs`/`emailCaptures`/`entitlements`/`users` (`@/db/schema`), `syncContact` (Task 1), `CaptureDeps` (Task 3).
- Produces: `captureDeps: CaptureDeps` (the concrete dependency bundle wired to the DB + Loops).

- [ ] **Step 1: Write the failing test (pure-shape + gated integration)**

```ts
// tests/capture-store.test.ts
import { describe, it, expect } from 'vitest';
import { captureDeps } from '@/lib/capture/store';

describe('captureDeps', () => {
  it('exposes the full CaptureDeps surface', () => {
    expect(typeof captureDeps.getFreePack).toBe('function');
    expect(typeof captureDeps.recordCapture).toBe('function');
    expect(typeof captureDeps.setCaptureSynced).toBe('function');
    expect(typeof captureDeps.syncContact).toBe('function');
    expect(typeof captureDeps.findOrCreateUserByEmail).toBe('function');
    expect(typeof captureDeps.grantFreeEntitlement).toBe('function');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('captureDeps integration (needs a seeded POSTGRES_URL)', () => {
  it('getFreePack returns null for an unknown id', async () => {
    expect(await captureDeps.getFreePack('does-not-exist')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails / skips**

Run: `npm run test -- tests/capture-store.test.ts`
Expected: FAIL — module not found. (Integration block skips without a DB.)

- [ ] **Step 3: Implement**

```ts
// lib/capture/store.ts
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, emailCaptures, entitlements, users } from '@/db/schema';
import { syncContact } from '@/lib/email/loops';
import type { CaptureDeps } from './capture';

export const captureDeps: CaptureDeps = {
  async getFreePack(packId) {
    const rows = await db
      .select({ id: packs.id })
      .from(packs)
      .where(and(eq(packs.id, packId), eq(packs.kind, 'free'), eq(packs.status, 'published')))
      .limit(1);
    return rows[0] ?? null;
  },

  async recordCapture(email, packId) {
    const id = randomUUID();
    await db.insert(emailCaptures).values({ id, email, packId });
    return id;
  },

  async setCaptureSynced(captureId, synced) {
    await db.update(emailCaptures).set({ loopsSynced: synced }).where(eq(emailCaptures.id, captureId));
  },

  syncContact,

  async findOrCreateUserByEmail(email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return existing[0].id;
    const id = randomUUID();
    await db.insert(users).values({ id, email, role: 'user' }).onConflictDoNothing();
    const after = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return after[0]!.id;
  },

  async grantFreeEntitlement(userId, packId) {
    await db
      .insert(entitlements)
      .values({ id: randomUUID(), userId, scope: `pack:${packId}`, source: 'free' })
      .onConflictDoNothing();
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/capture-store.test.ts`
Expected: PASS — shape test passes; integration skips without a DB.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/capture/store.ts tests/capture-store.test.ts
git commit -m "feat: concrete capture deps over Drizzle (free pack, capture, idempotent free grant)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Server action + `POST /api/capture`

**Files:**
- Create: `lib/capture/actions.ts`, `app/api/capture/route.ts`
- Test: `tests/capture-route.test.ts`

**Interfaces:**
- Consumes: `captureFreePack` + `CaptureError` (Task 3), `captureDeps` (Task 4), `rateLimit` (Task 2), `signIn` (`@/lib/auth`).
- Produces:
  - `captureFreePackAction(packId: string, formData: FormData): Promise<void>` (`'use server'`).
  - `POST /api/capture` → `{ ok: true }` | 400 | 422 | 429.

- [ ] **Step 1: Write the failing test (route, deps mocked)**

```ts
// tests/capture-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureFreePack, rateLimit } = vi.hoisted(() => ({
  captureFreePack: vi.fn(),
  rateLimit: vi.fn(() => ({ ok: true, remaining: 4 })),
}));

class CaptureError extends Error { code = 'not_free' as const; constructor() { super('not_free'); } }

vi.mock('@/lib/capture/capture', () => ({ captureFreePack, CaptureError }));
vi.mock('@/lib/capture/store', () => ({ captureDeps: {} }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit }));

import { POST } from '@/app/api/capture/route';

const req = (body: unknown) =>
  new Request('http://test/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  captureFreePack.mockReset();
  rateLimit.mockReturnValue({ ok: true, remaining: 4 });
});

describe('POST /api/capture', () => {
  it('400 on a bad body', async () => {
    const res = await POST(req({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(captureFreePack).not.toHaveBeenCalled();
  });

  it('429 when rate-limited', async () => {
    rateLimit.mockReturnValue({ ok: false, remaining: 0 });
    const res = await POST(req({ email: 'a@b.c', packId: 'p1' }));
    expect(res.status).toBe(429);
    expect(captureFreePack).not.toHaveBeenCalled();
  });

  it('422 for a non-free pack', async () => {
    captureFreePack.mockRejectedValue(new CaptureError());
    const res = await POST(req({ email: 'a@b.c', packId: 'p1' }));
    expect(res.status).toBe(422);
  });

  it('200 ok on success', async () => {
    captureFreePack.mockResolvedValue({ ok: true, email: 'a@b.c' });
    const res = await POST(req({ email: 'a@b.c', packId: 'p1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/capture-route.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement the server action**

```ts
// lib/capture/actions.ts
'use server';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { captureFreePack, CaptureError } from './capture';
import { captureDeps } from './store';

export async function captureFreePackAction(packId: string, formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  try {
    await captureFreePack({ email, packId }, captureDeps);
  } catch (err) {
    if (err instanceof CaptureError) redirect(`/packs?capture=error`);
    throw err;
  }
  // Sends the magic link and redirects to /verify-request; after the user clicks
  // it they land on their downloads with the free entitlement already granted.
  await signIn('email', { email, redirectTo: '/account/downloads' });
}
```

- [ ] **Step 4: Implement the route**

```ts
// app/api/capture/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureFreePack, CaptureError } from '@/lib/capture/capture';
import { captureDeps } from '@/lib/capture/store';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const Body = z.object({ email: z.string().email(), packId: z.string().min(1) });

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`capture:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  try {
    await captureFreePack(parsed.data, captureDeps);
  } catch (err) {
    if (err instanceof CaptureError) return NextResponse.json({ error: 'not_free' }, { status: 422 });
    throw err;
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/capture-route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/capture/actions.ts app/api/capture/route.ts tests/capture-route.test.ts
git commit -m "feat: free-pack capture server action + POST /api/capture (zod, rate-limited)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Free-pack form + pack page wiring

**Files:**
- Create: `components/FreePackForm.tsx`
- Modify: `app/(catalog)/packs/[slug]/page.tsx`
- Test: `tests/free-pack-form.test.tsx`

**Interfaces:**
- Consumes: `captureFreePackAction` (Task 5).
- Produces: `FreePackForm({ packId }: { packId: string })` — branded email form bound to the action.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/free-pack-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/capture/actions', () => ({ captureFreePackAction: vi.fn() }));

import { FreePackForm } from '@/components/FreePackForm';

describe('FreePackForm', () => {
  it('renders an email input and a submit button', () => {
    const { container, getByRole } = render(<FreePackForm packId="p1" />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(getByRole('button')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/free-pack-form.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the form**

```tsx
// components/FreePackForm.tsx
import { captureFreePackAction } from '@/lib/capture/actions';

export function FreePackForm({ packId }: { packId: string }) {
  return (
    <form action={captureFreePackAction.bind(null, packId)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="h-11 w-full rounded-card border border-fog bg-paper px-3 text-body text-navy outline-none focus:border-action sm:w-64"
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
      >
        Email me this free pack
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Wire it into the pack page's free branch**

In `app/(catalog)/packs/[slug]/page.tsx`: add `import { FreePackForm } from '@/components/FreePackForm';` and replace the free branch
```tsx
                : <Button href="/pricing">Get this pack</Button>}
```
with
```tsx
                : <FreePackForm packId={pack.id} />}
```
(Leave the `paid` → `<BuyButton …>` branch unchanged.)

- [ ] **Step 5: Run the focused test + typecheck + lint**

Run: `npm run test -- tests/free-pack-form.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/FreePackForm.tsx "app/(catalog)/packs/[slug]/page.tsx" tests/free-pack-form.test.tsx
git commit -m "feat: free-pack email capture form on free pack pages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Acceptance — verification + manual walkthrough

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: PASS — loops, rate-limit, capture, capture-store (shape), capture-route, free-pack-form, plus all prior suites green; DB-gated suites skip without `POSTGRES_URL`.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://layoutlab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@layoutlab.com npm run build
```
Expected: PASS — `/api/capture` and `/packs/[slug]` compile.

- [ ] **Step 4: Manual acceptance (user-run, keyless dev — local DB + a seeded free pack)**

```bash
# Needs a published kind='free' pack in the local DB (db:seed includes free packs).
npm run dev
# 1. Open a FREE pack page (/packs/<free-slug>) → see the email form (not a Buy button).
# 2. Enter an email, submit → redirected to /verify-request.
#    Dev console logs the Loops sync ("[loops:dev] ...") and the magic link ("[auth:dev] magic sign-in link ...").
# 3. Open the magic link → land on /account/downloads → the free pack's layouts are listed.
# 4. A PAID pack page still shows "Buy this pack", not the form.
# 5. POST /api/capture with a paid packId → 422; with a bad email → 400.
```

- [ ] **Step 5: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore: Phase 5b acceptance verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes / external prerequisites (user-provided)

- **Keyless dev works** — Loops sync + the magic link are logged to the dev
  console. For real contact sync set `LOOPS_API_KEY` in `.env.local`; for real
  link delivery set `RESEND_API_KEY` + `RESEND_FROM` (5a).
- The local DB must be up + seeded (a published `kind='free'` pack) for the manual
  walkthrough.

# Phase 2 — Ingest API + Admin Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A token-protected `POST /api/ingest` that lands validated layouts as `pending`, plus a role-gated `/admin/queue` where an admin one-click approves & publishes them into the Phase 1 catalog.

**Architecture:** Next 15 route handler for ingest (bearer-token auth, zod validation, idempotent on `content_hash`). Admin access via an `ADMIN_EMAILS` allowlist that drives `role='admin'` in the Auth.js JWT callback; `requireAdmin()` gates pages and server actions server-side; middleware gives a coarse redirect. Admin DB reads/mutations are isolated in `lib/admin/`; the public catalog modules stay published-only.

**Tech Stack:** Next.js 15 (App Router, route handlers, server actions, middleware), next-auth v5, Drizzle ORM + @vercel/postgres, zod, Vitest.

## Global Constraints

- **Ingest auth:** `Authorization: Bearer <INGEST_API_TOKEN>` — 401 if missing/wrong. (§8, §16)
- **Quality gate at ingest:** reject any payload not marked `validatorPassed === true` → 422. Phase 2 trusts the flag; it does NOT re-run the validator. (§2.2, §16)
- **Idempotent on `content_hash`:** a duplicate POST returns the existing record, never a second row or an error. (§2.7)
- **Admin gated server-side**, not just in the UI or middleware: every admin page and every server action calls `requireAdmin()`. (§16)
- **Visibility split:** public catalog queries return only `published`; admin queries (`lib/admin/`) see all statuses. Never surface `pending`/`rejected` publicly. (§11)
- **Secrets server-only:** `INGEST_API_TOKEN`, `ADMIN_EMAILS` never reach the client bundle; client components import only server actions, never `@/db/*` or `@/lib/env`. (§2.6, §16)
- **Input validation (zod) on the route handler.** (§16)
- **Approve = publish:** approve sets `status='published'` + `publishedAt=now`. Unpublish → `approved` (de-listed, retained). Reject → `rejected`. (brainstorm decision 2)
- **DB-gated tests** skip without `POSTGRES_URL` (Phase 1 convention; `@vercel/postgres` connects via `POSTGRES_URL`).
- **Commit after every task** with a conventional-commit message ending in the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Admin allowlist + JWT role assignment

**Files:**
- Modify: `lib/env.ts` (add `ADMIN_EMAILS`), `.env.example`, `lib/auth/config.ts` (add `isAdminEmail` + use it in the JWT callback), `vitest.config.ts` (add a `test.env` block)
- Test: `tests/admin-email.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isAdminEmail(email?: string | null): boolean` (reads `process.env.ADMIN_EMAILS`, comma-separated, case-insensitive, trims). The JWT callback sets `token.role = isAdminEmail(user.email) ? 'admin' : 'user'` on sign-in, so the existing `isAdmin(session)` reports admins correctly. `vitest.config.ts` now provides placeholder env for every test run (so modules importing the `env` singleton load).

- [ ] **Step 1: Add the `test.env` block to vitest config**

In `vitest.config.ts`, add an `env` object inside `test` (keep the existing `include`, `environment`, `environmentMatchGlobs`, `globals`, and the top-level `resolve.alias`):

```ts
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
    globals: true,
    env: {
      NEXT_PUBLIC_SITE_URL: 'https://layoutlab.com',
      DATABASE_URL: 'postgres://u:p@localhost/db',
      AUTH_SECRET: 'test-secret-test-secret-32chars!!',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_ci',
      INGEST_API_TOKEN: 'test-ingest-token',
      ADMIN_EMAILS: 'admin@layoutlab.com',
    },
  },
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/admin-email.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail } from '@/lib/auth/config';

describe('isAdminEmail', () => {
  const prev = process.env.ADMIN_EMAILS;
  beforeEach(() => { process.env.ADMIN_EMAILS = 'Admin@Layoutlab.com, boss@x.io'; });
  afterEach(() => { process.env.ADMIN_EMAILS = prev; });

  it('matches an allowlisted email case-insensitively', () => {
    expect(isAdminEmail('admin@layoutlab.com')).toBe(true);
    expect(isAdminEmail('BOSS@X.IO')).toBe(true);
  });
  it('rejects non-listed, empty, and nullish emails', () => {
    expect(isAdminEmail('nobody@x.io')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
  it('returns false when the allowlist is unset/empty', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminEmail('admin@layoutlab.com')).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/admin-email.test.ts`
Expected: FAIL — `isAdminEmail` is not exported from `@/lib/auth/config`.

- [ ] **Step 4: Implement `isAdminEmail` + wire the JWT callback**

In `lib/auth/config.ts`, add the helper (reads `process.env` directly so this module stays edge-safe and import-light — middleware reuses `authConfig`):

```ts
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
```

Change the `jwt` callback to assign the role from the allowlist:

```ts
    jwt({ token, user }) {
      if (user) token.role = isAdminEmail(user.email) ? 'admin' : 'user';
      return token;
    },
```

(Leave the `session` callback as-is.)

- [ ] **Step 5: Document the env var**

In `lib/env.ts` schema, add alongside the other optional server keys:

```ts
  ADMIN_EMAILS: z.string().optional(),
```

In `.env.example`, under the Auth section add:

```
# Comma-separated emails granted the admin role (Phase 2 allowlist).
ADMIN_EMAILS=
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- tests/admin-email.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/env.ts .env.example lib/auth/config.ts vitest.config.ts tests/admin-email.test.ts
git commit -m "feat: admin email allowlist drives JWT admin role

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `requireAdmin` gate + middleware

**Files:**
- Create: `lib/auth/admin.ts`, `middleware.ts`
- Test: `tests/admin-gate.test.ts`

**Interfaces:**
- Consumes: `isAdmin` (`@/lib/auth/config`), `auth` (`@/lib/auth`).
- Produces:
  - `type AdminGate = 'ok' | 'unauthenticated' | 'forbidden'`
  - `adminGateDecision(session: Session | null): AdminGate` (pure)
  - `requireAdmin(): Promise<Session>` — `redirect('/login')` if unauthenticated, `notFound()` if forbidden, else returns the session.
  - `middleware.ts` redirects unauthenticated requests to `/admin/:path*` to `/login`.

- [ ] **Step 1: Write the failing test (pure decision)**

```ts
// tests/admin-gate.test.ts
import { describe, it, expect } from 'vitest';
import { adminGateDecision } from '@/lib/auth/admin';

describe('adminGateDecision', () => {
  it('ok for an admin session', () => {
    expect(adminGateDecision({ user: { role: 'admin' } } as any)).toBe('ok');
  });
  it('forbidden for a signed-in non-admin', () => {
    expect(adminGateDecision({ user: { role: 'user' } } as any)).toBe('forbidden');
  });
  it('unauthenticated for no session / no user', () => {
    expect(adminGateDecision(null)).toBe('unauthenticated');
    expect(adminGateDecision({} as any)).toBe('unauthenticated');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/admin-gate.test.ts`
Expected: FAIL — cannot find `@/lib/auth/admin`.

- [ ] **Step 3: Implement the gate**

```ts
// lib/auth/admin.ts
import type { Session } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdmin } from './config';

export type AdminGate = 'ok' | 'unauthenticated' | 'forbidden';

export function adminGateDecision(session: Session | null): AdminGate {
  if (!session?.user) return 'unauthenticated';
  return isAdmin(session) ? 'ok' : 'forbidden';
}

export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  const gate = adminGateDecision(session);
  if (gate === 'unauthenticated') redirect('/login');
  if (gate === 'forbidden') notFound();
  return session as Session;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/admin-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the middleware (coarse redirect)**

```ts
// middleware.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';

// A providers-free NextAuth instance is edge-safe; it only reads the JWT.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL('/login', req.nextUrl.origin));
  }
});

export const config = { matcher: ['/admin/:path*'] };
```

- [ ] **Step 6: Typecheck + build (middleware must compile for the edge)**

Run: `npm run typecheck && npm run build`
Expected: PASS — middleware compiles; `/admin` routes don't exist yet, that's fine.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/admin.ts middleware.ts tests/admin-gate.test.ts
git commit -m "feat: requireAdmin server gate + /admin middleware redirect

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Ingest payload schema + bearer parsing (pure)

**Files:**
- Create: `lib/ingest/schema.ts`
- Test: `tests/ingest-schema.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces:
  - `ingestPayloadSchema` (zod) and `type IngestPayload = z.infer<...>`
  - `parseIngestPayload(raw: unknown): { ok: true; data: IngestPayload } | { ok: false; errors: z.ZodIssue[] }`
  - `parseBearer(header: string | null): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ingest-schema.test.ts
import { describe, it, expect } from 'vitest';
import { parseIngestPayload, parseBearer } from '@/lib/ingest/schema';

const valid = {
  slug: 'hero-saas-minimal-1',
  title: 'Minimal SaaS Hero',
  type: 'hero',
  niche: 'saas',
  style: 'minimal',
  colors: ['blue'],
  diviJsonBlobKey: 'layouts/hero-saas-minimal-1.json',
  previewImageKeys: ['https://picsum.photos/seed/x/1200/900'],
  contentHash: 'hash-abc',
  validatorPassed: true,
};

describe('parseIngestPayload', () => {
  it('accepts a valid payload', () => {
    const r = parseIngestPayload(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.slug).toBe('hero-saas-minimal-1');
  });
  it('accepts validatorPassed:false at the schema level (route enforces true)', () => {
    expect(parseIngestPayload({ ...valid, validatorPassed: false }).ok).toBe(true);
  });
  it('rejects when a required field is missing', () => {
    const { title, ...missing } = valid;
    const r = parseIngestPayload(missing);
    expect(r.ok).toBe(false);
  });
  it('rejects when validatorPassed is absent', () => {
    const { validatorPassed, ...missing } = valid;
    expect(parseIngestPayload(missing).ok).toBe(false);
  });
});

describe('parseBearer', () => {
  it('extracts the token from a Bearer header', () => {
    expect(parseBearer('Bearer abc123')).toBe('abc123');
  });
  it('returns null for missing or malformed headers', () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer('Basic abc')).toBeNull();
    expect(parseBearer('abc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/ingest-schema.test.ts`
Expected: FAIL — cannot find `@/lib/ingest/schema`.

- [ ] **Step 3: Implement the schema + parsers**

```ts
// lib/ingest/schema.ts
import { z } from 'zod';

const seoSchema = z
  .object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImageKey: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .optional();

const tagSchema = z.object({
  axis: z.enum(['type', 'niche', 'style', 'feature']),
  slug: z.string().min(1),
});

export const ingestPayloadSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  niche: z.string().optional(),
  style: z.string().optional(),
  colors: z.array(z.string()).default([]),
  diviJsonBlobKey: z.string().min(1),
  previewImageKeys: z.array(z.string()).default([]),
  contentHash: z.string().min(1),
  perceptualHash: z.string().optional(),
  validatorPassed: z.boolean(),
  seo: seoSchema,
  tags: z.array(tagSchema).optional(),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export function parseIngestPayload(
  raw: unknown,
): { ok: true; data: IngestPayload } | { ok: false; errors: z.ZodIssue[] } {
  const r = ingestPayloadSchema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false, errors: r.error.issues };
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer (.+)$/.exec(header.trim());
  return m ? m[1].trim() : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/ingest-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ingest/schema.ts tests/ingest-schema.test.ts
git commit -m "feat: ingest payload zod schema + bearer parser (pure, tested)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Ingest route handler + sample fixture

**Files:**
- Create: `app/api/ingest/route.ts`, `tests/fixtures/sample-ingest.json`
- Test: `tests/ingest-route.test.ts`

**Interfaces:**
- Consumes: `env` (`@/lib/env`), `db` (`@/db/client`), `layouts`/`tags`/`layoutTags` (`@/db/schema`), `parseIngestPayload`/`parseBearer` (Task 3).
- Produces: `POST(req: Request): Promise<Response>` at `/api/ingest`. Responses: `401` (bad token), `422` (`invalid_json` / `invalid_payload` / `not_validated`), `500` (`ingest_not_configured`), `201 { id, status:'pending', deduped:false }` (new), `200 { id, status, deduped:true }` (existing content hash).

- [ ] **Step 1: Write the failing test (failure paths need no DB; success paths gated on `POSTGRES_URL`)**

```ts
// tests/ingest-route.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/ingest/route';
import sample from './fixtures/sample-ingest.json';

const TOKEN = 'test-ingest-token'; // matches vitest.config.ts test.env

function post(body: unknown, token: string | null = TOKEN) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('http://test/api/ingest', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/ingest — auth + validation (no DB)', () => {
  it('401 without a token', async () => {
    expect((await POST(post(sample, null))).status).toBe(401);
  });
  it('401 with a wrong token', async () => {
    expect((await POST(post(sample, 'nope'))).status).toBe(401);
  });
  it('422 on invalid JSON', async () => {
    expect((await POST(post('not json{'))).status).toBe(422);
  });
  it('422 on a schema violation', async () => {
    const { title, ...bad } = sample as any;
    expect((await POST(post(bad))).status).toBe(422);
  });
  it('422 when validatorPassed is not true', async () => {
    const res = await POST(post({ ...(sample as any), contentHash: 'unvalidated-hash', validatorPassed: false }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('not_validated');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('POST /api/ingest — persistence (needs POSTGRES_URL)', () => {
  it('201 creates a pending layout, 200 dedupes on repeat', async () => {
    const unique = { ...(sample as any), slug: `e2e-${Date.now()}`, contentHash: `e2e-${Date.now()}` };
    const first = await POST(post(unique));
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.status).toBe('pending');
    expect(firstBody.deduped).toBe(false);

    const second = await POST(post(unique));
    expect(second.status).toBe(200);
    expect((await second.json()).deduped).toBe(true);
  });
});
```

- [ ] **Step 2: Create the sample fixture**

```json
// tests/fixtures/sample-ingest.json
{
  "slug": "sample-hero-saas",
  "title": "Sample SaaS Hero",
  "description": "A sample validated Divi 5 hero for ingest testing.",
  "type": "hero",
  "niche": "saas",
  "style": "minimal",
  "colors": ["blue", "monochrome"],
  "diviJsonBlobKey": "layouts/sample-hero-saas.json",
  "previewImageKeys": ["https://picsum.photos/seed/sample-hero/1200/900"],
  "contentHash": "sample-content-hash-0001",
  "validatorPassed": true,
  "seo": {
    "metaTitle": "Sample SaaS Hero — Divi 5 Layout",
    "metaDescription": "A sample validated Divi 5 hero section.",
    "keywords": ["hero", "saas", "divi 5"]
  },
  "tags": [
    { "axis": "type", "slug": "hero" },
    { "axis": "niche", "slug": "saas" }
  ]
}
```

Ensure `tsconfig.json` allows JSON imports (Next/TS default `resolveJsonModule` is on; if the import errors, confirm `"resolveJsonModule": true` in `tsconfig.json`).

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/ingest-route.test.ts`
Expected: FAIL — cannot find `@/app/api/ingest/route`. (Persistence block skips without `POSTGRES_URL`.)

- [ ] **Step 4: Implement the route handler**

```ts
// app/api/ingest/route.ts
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { layouts, tags, layoutTags } from '@/db/schema';
import { parseIngestPayload, parseBearer } from '@/lib/ingest/schema';

export async function POST(req: Request): Promise<Response> {
  const expected = env.INGEST_API_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'ingest_not_configured' }, { status: 500 });
  }

  const token = parseBearer(req.headers.get('authorization'));
  if (!token || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 422 });
  }

  const parsed = parseIngestPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.errors }, { status: 422 });
  }
  const p = parsed.data;

  // Quality gate: never accept an un-validated layout. (CLAUDE.md §2.2)
  if (p.validatorPassed !== true) {
    return NextResponse.json({ error: 'not_validated' }, { status: 422 });
  }

  // Idempotent on content_hash. (CLAUDE.md §2.7)
  const existing = await db
    .select({ id: layouts.id, status: layouts.status })
    .from(layouts)
    .where(eq(layouts.contentHash, p.contentHash))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ id: existing[0].id, status: existing[0].status, deduped: true }, { status: 200 });
  }

  const id = randomUUID();
  await db
    .insert(layouts)
    .values({
      id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      type: p.type,
      niche: p.niche,
      style: p.style,
      colors: p.colors,
      diviJsonBlobKey: p.diviJsonBlobKey,
      previewImageKeys: p.previewImageKeys,
      contentHash: p.contentHash,
      perceptualHash: p.perceptualHash,
      validatorPassed: true,
      seo: p.seo,
      status: 'pending',
    })
    .onConflictDoNothing();

  if (p.tags?.length) {
    for (const t of p.tags) {
      const tagId = `tag_${t.axis}_${t.slug}`;
      await db.insert(tags).values({ id: tagId, axis: t.axis, slug: t.slug, title: t.slug }).onConflictDoNothing();
      await db.insert(layoutTags).values({ layoutId: id, tagId }).onConflictDoNothing();
    }
  }

  return NextResponse.json({ id, status: 'pending', deduped: false }, { status: 201 });
}
```

> Note: `onConflictDoNothing()` also covers a `slug` collision (different content, same slug). For Phase 2 the producer controls slugs, so this is acceptable; the dedupe contract is on `content_hash` (checked explicitly above).

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/ingest-route.test.ts`
Expected: PASS — the five no-DB cases pass; the persistence block skips without `POSTGRES_URL`.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/ingest/route.ts tests/ingest-route.test.ts tests/fixtures/sample-ingest.json
git commit -m "feat: POST /api/ingest (token, validation, idempotent pending)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Admin DB layer (reads + status mutations)

**Files:**
- Create: `lib/admin/queries.ts`, `lib/admin/mutations.ts`
- Test: `tests/admin-db.test.ts`

**Interfaces:**
- Consumes: `db` (`@/db/client`), `layouts` (`@/db/schema`), `LayoutRow` (`@/lib/catalog/queries`).
- Produces:
  - `type LayoutStatus = 'pending' | 'approved' | 'published' | 'rejected'`
  - `listLayoutsByStatus(status: LayoutStatus): Promise<LayoutRow[]>` (newest first, all statuses visible)
  - `statusCounts(): Promise<Record<LayoutStatus, number>>`
  - `setLayoutStatus(id, status, opts?: { publishedAt?: Date }): Promise<{ slug: string } | null>`
  - `setLayoutsStatus(ids: string[], status, opts?: { publishedAt?: Date }): Promise<void>`

- [ ] **Step 1: Write the integration test (gated on `POSTGRES_URL`)**

```ts
// tests/admin-db.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

const hasDb = !!process.env.POSTGRES_URL;

describe.skipIf(!hasDb)('admin DB layer (needs a seeded POSTGRES_URL)', () => {
  let m: typeof import('@/lib/admin/queries') & typeof import('@/lib/admin/mutations');

  beforeAll(async () => {
    m = { ...(await import('@/lib/admin/queries')), ...(await import('@/lib/admin/mutations')) } as any;
  });

  it('statusCounts returns a count per status', async () => {
    const c = await m.statusCounts();
    expect(c).toHaveProperty('published');
    expect(typeof c.published).toBe('number');
  });

  it('listLayoutsByStatus only returns rows of that status', async () => {
    const rows = await m.listLayoutsByStatus('published');
    for (const r of rows) expect(r.status).toBe('published');
  });
});
```

- [ ] **Step 2: Run to verify it is wired (skips without a DB)**

Run: `npm run test -- tests/admin-db.test.ts`
Expected: PASS-as-skipped (0 failures) without `POSTGRES_URL`.

- [ ] **Step 3: Implement the reads**

```ts
// lib/admin/queries.ts
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import type { LayoutRow } from '@/lib/catalog/queries';

export type LayoutStatus = 'pending' | 'approved' | 'published' | 'rejected';

export async function listLayoutsByStatus(status: LayoutStatus): Promise<LayoutRow[]> {
  return db.select().from(layouts).where(eq(layouts.status, status)).orderBy(desc(layouts.createdAt));
}

export async function statusCounts(): Promise<Record<LayoutStatus, number>> {
  const rows = await db
    .select({ status: layouts.status, count: sql<number>`count(*)::int` })
    .from(layouts)
    .groupBy(layouts.status);
  const out: Record<LayoutStatus, number> = { pending: 0, approved: 0, published: 0, rejected: 0 };
  for (const r of rows) out[r.status as LayoutStatus] = r.count;
  return out;
}
```

- [ ] **Step 4: Implement the mutations**

```ts
// lib/admin/mutations.ts
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import type { LayoutStatus } from './queries';

export async function setLayoutStatus(
  id: string,
  status: LayoutStatus,
  opts: { publishedAt?: Date } = {},
): Promise<{ slug: string } | null> {
  const set: Record<string, unknown> = { status };
  if (opts.publishedAt) set.publishedAt = opts.publishedAt;
  const rows = await db.update(layouts).set(set).where(eq(layouts.id, id)).returning({ slug: layouts.slug });
  return rows[0] ?? null;
}

export async function setLayoutsStatus(
  ids: string[],
  status: LayoutStatus,
  opts: { publishedAt?: Date } = {},
): Promise<void> {
  if (!ids.length) return;
  const set: Record<string, unknown> = { status };
  if (opts.publishedAt) set.publishedAt = opts.publishedAt;
  await db.update(layouts).set(set).where(inArray(layouts.id, ids));
}
```

- [ ] **Step 5: Run + typecheck**

Run: `npm run test -- tests/admin-db.test.ts && npm run typecheck`
Expected: test skips (no DB), typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/queries.ts lib/admin/mutations.ts tests/admin-db.test.ts
git commit -m "feat: admin DB layer — status reads + mutations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Admin server actions

**Files:**
- Create: `lib/admin/actions.ts`
- Test: `tests/admin-actions.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/auth/admin`), `setLayoutStatus`/`setLayoutsStatus` (Task 5), `revalidatePath` (`next/cache`).
- Produces (server actions): `approveLayout(id)`, `rejectLayout(id)`, `unpublishLayout(id)`, `bulkApprove(ids: string[])`. Each calls `requireAdmin()` first, mutates, then revalidates the affected catalog routes.

- [ ] **Step 1: Write the failing test (mock the gate, DB layer, and cache)**

```ts
// tests/admin-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn(async () => ({ user: { role: 'admin' } }));
const setLayoutStatus = vi.fn(async () => ({ slug: 's' }));
const setLayoutsStatus = vi.fn(async () => {});
const revalidatePath = vi.fn();

vi.mock('@/lib/auth/admin', () => ({ requireAdmin }));
vi.mock('@/lib/admin/mutations', () => ({ setLayoutStatus, setLayoutsStatus }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { approveLayout, rejectLayout, unpublishLayout, bulkApprove } from '@/lib/admin/actions';

beforeEach(() => {
  requireAdmin.mockClear();
  setLayoutStatus.mockClear();
  setLayoutsStatus.mockClear();
  revalidatePath.mockClear();
});

describe('admin actions', () => {
  it('approveLayout requires admin then publishes with a publishedAt', async () => {
    await approveLayout('l1');
    expect(requireAdmin).toHaveBeenCalledOnce();
    const [id, status, opts] = setLayoutStatus.mock.calls[0];
    expect(id).toBe('l1');
    expect(status).toBe('published');
    expect(opts.publishedAt).toBeInstanceOf(Date);
    expect(revalidatePath).toHaveBeenCalledWith('/browse');
  });

  it('rejectLayout sets rejected', async () => {
    await rejectLayout('l2');
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(setLayoutStatus.mock.calls[0][1]).toBe('rejected');
  });

  it('unpublishLayout sets approved (de-listed)', async () => {
    await unpublishLayout('l3');
    expect(setLayoutStatus.mock.calls[0][1]).toBe('approved');
    expect(revalidatePath).toHaveBeenCalledWith('/browse');
  });

  it('bulkApprove requires admin then publishes many', async () => {
    await bulkApprove(['a', 'b']);
    expect(requireAdmin).toHaveBeenCalledOnce();
    const [ids, status] = setLayoutsStatus.mock.calls[0];
    expect(ids).toEqual(['a', 'b']);
    expect(status).toBe('published');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/admin-actions.test.ts`
Expected: FAIL — cannot find `@/lib/admin/actions`.

- [ ] **Step 3: Implement the actions**

```ts
// lib/admin/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { setLayoutStatus, setLayoutsStatus } from '@/lib/admin/mutations';

function revalidateCatalog(slug?: string | null) {
  revalidatePath('/browse');
  revalidatePath('/');
  if (slug) revalidatePath(`/layouts/${slug}`);
}

export async function approveLayout(id: string): Promise<void> {
  await requireAdmin();
  const row = await setLayoutStatus(id, 'published', { publishedAt: new Date() });
  revalidateCatalog(row?.slug);
}

export async function rejectLayout(id: string): Promise<void> {
  await requireAdmin();
  await setLayoutStatus(id, 'rejected');
  revalidatePath('/admin/queue');
}

export async function unpublishLayout(id: string): Promise<void> {
  await requireAdmin();
  const row = await setLayoutStatus(id, 'approved');
  revalidateCatalog(row?.slug);
}

export async function bulkApprove(ids: string[]): Promise<void> {
  await requireAdmin();
  await setLayoutsStatus(ids, 'published', { publishedAt: new Date() });
  revalidateCatalog();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/admin-actions.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/actions.ts tests/admin-actions.test.ts
git commit -m "feat: admin server actions (approve/reject/unpublish/bulk), admin-gated

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Admin queue table component

**Files:**
- Create: `components/admin/QueueTable.tsx`
- Test: `tests/admin-queue-table.test.tsx`

**Interfaces:**
- Consumes: `approveLayout`/`rejectLayout`/`bulkApprove` (Task 6), `assetUrl` (`@/lib/blob/url`).
- Produces: `QueueRow` type and `QueueTable({ rows }: { rows: QueueRow[] })` — a `'use client'` component with per-row Approve/Reject (server-action forms), a bulk-select + Approve-selected bar, and an empty state. Imports only server actions + the pure `assetUrl`, never `@/db/*`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/admin-queue-table.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/admin/actions', () => ({
  approveLayout: vi.fn(),
  rejectLayout: vi.fn(),
  bulkApprove: vi.fn(),
}));

import { QueueTable } from '@/components/admin/QueueTable';

const rows = [
  { id: 'l1', slug: 'a', title: 'Alpha Hero', type: 'hero', niche: 'saas', style: 'minimal', preview: 'https://picsum.photos/seed/a/200/150' },
  { id: 'l2', slug: 'b', title: 'Beta Pricing', type: 'pricing', niche: 'agency', style: 'bold', preview: null },
];

describe('QueueTable', () => {
  it('renders a row per pending layout with Approve and Reject controls', () => {
    const { getByText, getAllByText } = render(<QueueTable rows={rows} />);
    expect(getByText('Alpha Hero')).toBeTruthy();
    expect(getByText('Beta Pricing')).toBeTruthy();
    expect(getAllByText('Approve').length).toBe(2);
    expect(getAllByText('Reject').length).toBe(2);
  });

  it('shows an empty state when there are no rows', () => {
    const { getByText } = render(<QueueTable rows={[]} />);
    expect(getByText(/no pending layouts/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/admin-queue-table.test.tsx`
Expected: FAIL — cannot find `@/components/admin/QueueTable`.

- [ ] **Step 3: Implement the component**

```tsx
// components/admin/QueueTable.tsx
'use client';
import { useState } from 'react';
import Image from 'next/image';
import { assetUrl } from '@/lib/blob/url';
import { approveLayout, rejectLayout, bulkApprove } from '@/lib/admin/actions';

export type QueueRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  niche: string | null;
  style: string | null;
  preview: string | null;
};

export function QueueTable({ rows }: { rows: QueueRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  if (!rows.length) {
    return <p className="py-12 text-center text-gray-500">No pending layouts to review. 🎉</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <form action={() => bulkApprove([...selected])}>
          <button
            type="submit"
            disabled={!selected.size}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Approve {selected.size || ''} selected
          </button>
        </form>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-4 rounded border border-gray-200 p-3">
            <input
              type="checkbox"
              aria-label={`Select ${r.title}`}
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-gray-100">
              {r.preview && (
                <Image src={assetUrl(r.preview)} alt={r.title} fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500">{r.type} · {r.niche} · {r.style}</p>
            </div>
            <form action={approveLayout.bind(null, r.id)}>
              <button type="submit" className="rounded bg-green-600 px-3 py-1.5 text-sm text-white">Approve</button>
            </form>
            <form action={rejectLayout.bind(null, r.id)}>
              <button type="submit" className="rounded border border-gray-300 px-3 py-1.5 text-sm">Reject</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/admin-queue-table.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/QueueTable.tsx tests/admin-queue-table.test.tsx
git commit -m "feat: admin QueueTable (per-row + bulk approve, server-action forms)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Admin pages (gated layout, dashboard, queue)

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/queue/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin` (Task 2), `statusCounts`/`listLayoutsByStatus` (Task 5), `QueueTable`/`QueueRow` (Task 7).
- Produces: the `/admin` dashboard and `/admin/queue` review page, both behind `requireAdmin()` and rendered dynamically.

- [ ] **Step 1: Write the gated layout**

```tsx
// app/admin/layout.tsx
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex gap-4 text-sm">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/queue" className="text-gray-600 hover:underline">Queue</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write the dashboard**

```tsx
// app/admin/page.tsx
import Link from 'next/link';
import { statusCounts } from '@/lib/admin/queries';

export default async function AdminDashboard() {
  const counts = await statusCounts();
  const cards: { label: string; key: keyof typeof counts; href?: string }[] = [
    { label: 'Pending', key: 'pending', href: '/admin/queue' },
    { label: 'Published', key: 'published' },
    { label: 'Approved (de-listed)', key: 'approved' },
    { label: 'Rejected', key: 'rejected' },
  ];
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <div className="rounded border border-gray-200 p-4">
              <div className="text-3xl font-bold">{counts[c.key]}</div>
              <div className="mt-1 text-sm text-gray-500">{c.label}</div>
            </div>
          );
          return c.href ? <Link key={c.key} href={c.href}>{body}</Link> : <div key={c.key}>{body}</div>;
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write the queue page**

```tsx
// app/admin/queue/page.tsx
import { listLayoutsByStatus } from '@/lib/admin/queries';
import { QueueTable, type QueueRow } from '@/components/admin/QueueTable';

export default async function AdminQueuePage() {
  const layouts = await listLayoutsByStatus('pending');
  const rows: QueueRow[] = layouts.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    type: l.type,
    niche: l.niche,
    style: l.style,
    preview: l.previewImageKeys[0] ?? null,
  }));
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Review queue ({rows.length} pending)</h1>
      <QueueTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS — `/admin`, `/admin/queue` compile as dynamic routes; `/api/ingest` compiles.

- [ ] **Step 5: Commit**

```bash
git add app/admin
git commit -m "feat: admin dashboard + review queue pages (requireAdmin gated)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: e2e smoke + Phase 2 acceptance

**Files:**
- Create: `e2e/ingest-admin.spec.ts`
- Modify: `.github/workflows/ci.yml` (add `INGEST_API_TOKEN` + `ADMIN_EMAILS` to the test env, mirroring vitest's `test.env`)

**Interfaces:**
- Consumes: everything above.
- Produces: a green Phase 2 verification pass + a gated e2e smoke documenting the manual walkthrough.

- [ ] **Step 1: Add CI env for the two new vars**

In `.github/workflows/ci.yml`, in the `npm run test` step's `env:` block, add:

```yaml
          INGEST_API_TOKEN: test-ingest-token
          ADMIN_EMAILS: admin@layoutlab.com
```

(Vitest's `test.env` already injects these for local runs; this keeps CI explicit and consistent.)

- [ ] **Step 2: Write the gated e2e smoke**

```ts
// e2e/ingest-admin.spec.ts
import { test, expect } from '@playwright/test';

// Requires a seeded DB + the ingest token. Skips otherwise.
test.skip(!process.env.POSTGRES_URL || !process.env.INGEST_API_TOKEN, 'needs POSTGRES_URL + INGEST_API_TOKEN');

const TOKEN = process.env.INGEST_API_TOKEN!;

test('ingest is idempotent and a pending layout is not publicly visible', async ({ request }) => {
  const stamp = Date.now();
  const slug = `e2e-ingest-${stamp}`;
  const payload = {
    slug, title: `E2E Ingest ${stamp}`, type: 'hero', niche: 'saas', style: 'minimal',
    colors: ['blue'], diviJsonBlobKey: `layouts/${slug}.json`,
    previewImageKeys: ['https://picsum.photos/seed/e2e/1200/900'],
    contentHash: `e2e-${stamp}`, validatorPassed: true,
  };

  // First POST creates a pending layout; a repeat dedupes.
  const first = await request.post('/api/ingest', { headers: { authorization: `Bearer ${TOKEN}` }, data: payload });
  expect(first.status()).toBe(201);
  expect((await first.json()).status).toBe('pending');

  const second = await request.post('/api/ingest', { headers: { authorization: `Bearer ${TOKEN}` }, data: payload });
  expect(second.status()).toBe(200);
  expect((await second.json()).deduped).toBe(true);

  // A wrong token is rejected.
  const noAuth = await request.post('/api/ingest', { data: payload });
  expect(noAuth.status()).toBe(401);

  // While pending, the public detail route 404s (published-only catalog).
  const detail = await request.get(`/layouts/${slug}`);
  expect(detail.status()).toBe(404);
});
```

> The full sign-in → click-Approve → see-it-live interaction is the **manual** acceptance walkthrough in Step 5 (it depends on the Phase-0 credentials login UX). This automated spec covers the deterministic, API-level guarantees — idempotency, auth, and pending-invisibility — and runs only with a seeded DB. Keep it gated; do not block CI on it.

- [ ] **Step 3: Full unit suite**

Run: `npm run test`
Expected: PASS — admin-email, admin-gate, ingest-schema, ingest-route (no-DB cases), admin-actions, admin-queue-table green; admin-db + ingest-route persistence + catalog-queries skip without a DB. (Plus all Phase 1 suites still green.)

- [ ] **Step 4: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS — all routes compile (`/api/ingest`, `/admin`, `/admin/queue`, middleware).

- [ ] **Step 5: Manual acceptance walkthrough (requires a provisioned + seeded DB)**

Documented `curl` (run with `INGEST_API_TOKEN` and the dev server up):

```bash
curl -i -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $INGEST_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @tests/fixtures/sample-ingest.json
# → 201 { "id": "...", "status": "pending", "deduped": false }
# Repeat the same command → 200 { ..., "deduped": true }
```

Then: set `ADMIN_EMAILS` to your login email, sign in at `/login`, open `/admin/queue`,
click **Approve** on the sample, and confirm it appears at `/browse` and `/layouts/sample-hero-saas`.

- [ ] **Step 6: Commit + tag**

```bash
git add e2e/ingest-admin.spec.ts .github/workflows/ci.yml
git commit -m "test: ingest+admin e2e smoke + CI env for Phase 2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag phase-2-complete
```

---

## Notes / external prerequisites (user-provided)

- **`INGEST_API_TOKEN`** and **`ADMIN_EMAILS`** must be set in the deployed/runtime
  env for the ingest route and admin access to work. Vitest injects placeholders
  for tests; CI sets them explicitly (Task 9).
- **`POSTGRES_URL`** (a real, migrated, seeded DB) gates the persistence tests,
  admin DB tests, and the e2e smoke. Pure unit tests + build run without it.
- No new third-party services are introduced in Phase 2.

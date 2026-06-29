# Paid Pack-Bundle Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** An entitled user downloads a whole pack as one zip (all its layout JSONs + the license), gated by entitlement (owns the pack OR all-access).

**Architecture:** A `canDownloadPack` SSOT helper + a `buildPackZip`; a `requireUser`-gated route `GET /api/download/pack/[packId]` that checks entitlement then streams the bundle; the pack page shows a "Download pack" CTA when entitled (else Buy / capture).

**Tech Stack:** Next.js 15 route handler + RSC, Drizzle, jszip, Vitest.

## Global Constraints

- **Paid content → entitlement required.** The pack route MUST `requireUser` then verify `canDownloadPack` (owns `pack:<id>` OR active all-access); 403 otherwise. The asset is served only through this gated route. (§2 honored.)
- **One zip per pack:** `<pack-slug>.zip` with each `<layout-slug>.json` + one `LICENSE.txt`.
- `recordDownload` only on the streamed success path (one row per included layout). Secrets server-only.
- DB-touching tests mock the DB / gate on `POSTGRES_URL`. Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `canDownloadPack` + `buildPackZip`

**Files:**
- Modify: `lib/stripe/entitlements.ts`, `lib/download/zip.ts`
- Test: `tests/can-download-pack.test.ts`, `tests/pack-zip.test.ts`

**Interfaces:**
- Produces: `canDownloadPack(input: { packId: string; userEntitlements: UserEntitlement[]; now?: Date }): boolean`; `buildPackZip(layouts: { slug: string; json: string }[], license: string): Promise<Buffer>`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/can-download-pack.test.ts
import { describe, it, expect } from 'vitest';
import { canDownloadPack } from '@/lib/stripe/entitlements';
const NOW = new Date('2026-06-29T00:00:00Z');

describe('canDownloadPack', () => {
  it('true when the user owns the pack', () => {
    expect(canDownloadPack({ packId: 'p1', userEntitlements: [{ scope: 'pack:p1', source: 'order', expiresAt: null }], now: NOW })).toBe(true);
  });
  it('true with active all-access (any pack)', () => {
    expect(canDownloadPack({ packId: 'p9', userEntitlements: [{ scope: 'all_access', source: 'subscription', expiresAt: null }], now: NOW })).toBe(true);
  });
  it('false when neither owned nor all-access; ignores a different pack + expired all-access', () => {
    expect(canDownloadPack({ packId: 'p1', userEntitlements: [{ scope: 'pack:p2', source: 'order', expiresAt: null }, { scope: 'all_access', source: 'subscription', expiresAt: new Date('2026-06-01') }], now: NOW })).toBe(false);
    expect(canDownloadPack({ packId: 'p1', userEntitlements: [], now: NOW })).toBe(false);
  });
});
```

```ts
// tests/pack-zip.test.ts
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildPackZip } from '@/lib/download/zip';

describe('buildPackZip', () => {
  it('zips each layout JSON + one LICENSE.txt', async () => {
    const buf = await buildPackZip([{ slug: 'a-hero', json: '{"a":1}' }, { slug: 'b-pricing', json: '{"b":2}' }], 'LICENSE BODY');
    const zip = await JSZip.loadAsync(buf);
    expect(await zip.file('a-hero.json')!.async('string')).toBe('{"a":1}');
    expect(await zip.file('b-pricing.json')!.async('string')).toBe('{"b":2}');
    expect(await zip.file('LICENSE.txt')!.async('string')).toBe('LICENSE BODY');
  });
});
```

- [ ] **Step 2: Run → fail.** `npm run test -- tests/can-download-pack.test.ts tests/pack-zip.test.ts`.

- [ ] **Step 3: Implement**

Append to `lib/stripe/entitlements.ts`:
```ts
/** A pack bundle is downloadable with active all-access OR ownership of pack:<id>. */
export function canDownloadPack(input: { packId: string; userEntitlements: UserEntitlement[]; now?: Date }): boolean {
  const now = input.now ?? new Date();
  if (input.userEntitlements.some((e) => isActiveAllAccess(e, now))) return true;
  return input.userEntitlements.some((e) => e.scope === `pack:${input.packId}`);
}
```

Append to `lib/download/zip.ts`:
```ts
export async function buildPackZip(layouts: { slug: string; json: string }[], license: string): Promise<Buffer> {
  const zip = new JSZip();
  for (const l of layouts) zip.file(`${l.slug}.json`, l.json);
  zip.file('LICENSE.txt', license);
  return zip.generateAsync({ type: 'nodebuffer' });
}
```

- [ ] **Step 4: Run → pass. Step 5: typecheck + commit** `feat: canDownloadPack entitlement helper + buildPackZip`.

---

### Task 2: Pack download queries

**Files:**
- Modify: `lib/account/queries.ts`
- Test: `tests/pack-download-queries.test.ts`

**Interfaces:**
- Produces: `getPackForDownload(packId: string): Promise<{ id: string; slug: string } | null>`; `getPackLayoutsForDownload(packId: string): Promise<{ id: string; slug: string; diviJsonBlobKey: string }[]>` (id is needed for the `downloads` audit FK).

- [ ] **Step 1: Write the failing test (exports + gated integration)**

```ts
// tests/pack-download-queries.test.ts
import { describe, it, expect } from 'vitest';
import * as q from '@/lib/account/queries';

describe('pack download queries', () => {
  it('exposes getPackForDownload + getPackLayoutsForDownload', () => {
    expect(typeof q.getPackForDownload).toBe('function');
    expect(typeof q.getPackLayoutsForDownload).toBe('function');
  });
});

const hasDb = !!process.env.POSTGRES_URL;
describe.skipIf(!hasDb)('pack download queries (integration)', () => {
  it('getPackForDownload returns null for an unknown pack', async () => {
    expect(await q.getPackForDownload('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail / integration skips.**

- [ ] **Step 3: Implement** (append to `lib/account/queries.ts`; reuse the existing `db`, `and`, `eq`, `packs`, `packLayouts`, `layouts` imports — add any missing):

```ts
export async function getPackForDownload(packId: string): Promise<{ id: string; slug: string } | null> {
  const rows = await db.select({ id: packs.id, slug: packs.slug }).from(packs)
    .where(and(eq(packs.id, packId), eq(packs.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function getPackLayoutsForDownload(packId: string): Promise<{ id: string; slug: string; diviJsonBlobKey: string }[]> {
  return db.select({ id: layouts.id, slug: layouts.slug, diviJsonBlobKey: layouts.diviJsonBlobKey })
    .from(packLayouts).innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
    .where(and(eq(packLayouts.packId, packId), eq(layouts.status, 'published')));
}
```

- [ ] **Step 4: Run → pass (shape; integration skips). Step 5: typecheck + commit** `feat: pack download queries (published pack + its layouts)`.

---

### Task 3: Pack download route

**Files:**
- Create: `app/api/download/pack/[packId]/route.ts`
- Test: `tests/pack-download-route.test.ts`

**Interfaces:**
- Consumes: `requireUser` (`@/lib/auth/admin`), `getUserIdByEmail`/`getEntitlementsForUser`/`getPackForDownload`/`getPackLayoutsForDownload`/`recordDownload` (`@/lib/account/queries`), `canDownloadPack` (`@/lib/stripe/entitlements`), `fetchAsset` (`@/lib/blob`), `buildPackZip` (`@/lib/download/zip`), `readLicense` (`@/lib/license`).

- [ ] **Step 1: Write the failing test (mocked deps, `vi.hoisted`)**

```ts
// tests/pack-download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const h = vi.hoisted(() => ({
  requireUser: vi.fn(async () => ({ user: { email: 'buyer@x.com' } })),
  getUserIdByEmail: vi.fn(async () => 'u1'),
  getEntitlementsForUser: vi.fn(async () => [] as any[]),
  getPackForDownload: vi.fn(async () => ({ id: 'p1', slug: 'agency-essentials' })),
  getPackLayoutsForDownload: vi.fn(async () => [{ id: 'l1', slug: 'a-hero', diviJsonBlobKey: 'k1' }, { id: 'l2', slug: 'b-cta', diviJsonBlobKey: 'k2' }]),
  recordDownload: vi.fn(async () => {}),
  fetchAsset: vi.fn(async () => Buffer.from('{"x":1}')),
}));
vi.mock('@/lib/auth/admin', () => ({ requireUser: h.requireUser }));
vi.mock('@/lib/account/queries', () => ({ getUserIdByEmail: h.getUserIdByEmail, getEntitlementsForUser: h.getEntitlementsForUser, getPackForDownload: h.getPackForDownload, getPackLayoutsForDownload: h.getPackLayoutsForDownload, recordDownload: h.recordDownload }));
vi.mock('@/lib/blob', () => ({ fetchAsset: h.fetchAsset }));

import { GET } from '@/app/api/download/pack/[packId]/route';
const ctx = (id: string) => ({ params: Promise.resolve({ packId: id }) });
const req = () => new Request('http://test/api/download/pack/p1');

beforeEach(() => {
  h.getEntitlementsForUser.mockResolvedValue([]);
  h.getPackForDownload.mockResolvedValue({ id: 'p1', slug: 'agency-essentials' });
  h.fetchAsset.mockResolvedValue(Buffer.from('{"x":1}'));
  h.recordDownload.mockClear();
});

describe('GET /api/download/pack/[packId]', () => {
  it('403 when signed in but not entitled', async () => {
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(403);
    expect(h.recordDownload).not.toHaveBeenCalled();
  });
  it('404 for an unknown pack', async () => {
    h.getPackForDownload.mockResolvedValue(null);
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(404);
  });
  it('200 zip when the user owns the pack', async () => {
    h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:p1', source: 'order', expiresAt: null }]);
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('agency-essentials.zip');
    expect(h.recordDownload).toHaveBeenCalled();
  });
  it('200 with all-access', async () => {
    h.getEntitlementsForUser.mockResolvedValue([{ scope: 'all_access', source: 'subscription', expiresAt: null }]);
    expect((await GET(req(), ctx('p1'))).status).toBe(200);
  });
  it('404 when no asset resolves (entitled)', async () => {
    h.getEntitlementsForUser.mockResolvedValue([{ scope: 'pack:p1', source: 'order', expiresAt: null }]);
    h.fetchAsset.mockResolvedValue(null);
    const res = await GET(req(), ctx('p1'));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement the route**

```ts
// app/api/download/pack/[packId]/route.ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail, getEntitlementsForUser, getPackForDownload, getPackLayoutsForDownload, recordDownload } from '@/lib/account/queries';
import { canDownloadPack } from '@/lib/stripe/entitlements';
import { fetchAsset } from '@/lib/blob';
import { buildPackZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ packId: string }> }): Promise<Response> {
  const session = await requireUser();
  const { packId } = await params;

  const pack = await getPackForDownload(packId);
  if (!pack) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const email = session.user?.email ?? null;
  const userId = email ? await getUserIdByEmail(email) : null;
  const userEntitlements = userId ? await getEntitlementsForUser(userId) : [];
  if (!canDownloadPack({ packId, userEntitlements })) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await getPackLayoutsForDownload(packId);
  const items: { id: string; slug: string; json: string }[] = [];
  for (const r of rows) {
    const bytes = await fetchAsset(r.diviJsonBlobKey);
    if (bytes) items.push({ id: r.id, slug: r.slug, json: bytes.toString('utf8') });
  }
  if (items.length === 0) return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });

  const zip = await buildPackZip(items, readLicense());
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  for (const it of items) await recordDownload(userId, it.id, ip);

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${pack.slug}.zip"`,
    },
  });
}
```
> Note: `recordDownload` writes a `downloads` row whose `layoutId` is a FK to `layouts.id`, so we record the real layout **id** (carried on each item). `buildPackZip` only reads `{slug, json}` (the extra `id` field is ignored).

- [ ] **Step 4: Run → pass (5 cases). Step 5: full `npm run test` + typecheck + lint + commit** `feat: paid pack-bundle download route (entitlement-gated zip)`.

---

### Task 4: Pack-detail entitled CTA

**Files:**
- Modify: `app/(catalog)/packs/[slug]/page.tsx`
- Test: `tests/pack-cta.test.tsx` (component-level via a small extracted `PackCta`, OR assert the page output)

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`), `getUserIdByEmail`/`getEntitlementsForUser` (`@/lib/account/queries`), `canDownloadPack` (`@/lib/stripe/entitlements`).

- [ ] **Step 1: Extract a testable CTA component**

Create `components/PackCta.tsx`:
```tsx
import { BuyButton } from '@/components/BuyButton';
import { FreePackForm } from '@/components/FreePackForm';

export function PackCta({ pack, entitled }: { pack: { id: string; slug: string; kind: 'free' | 'paid' }; entitled: boolean }) {
  if (entitled) {
    return (
      <a href={`/api/download/pack/${pack.id}`} download={`${pack.slug}.zip`} className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
        Download pack
      </a>
    );
  }
  return pack.kind === 'paid'
    ? <BuyButton kind="pack" packId={pack.id} label="Buy this pack" />
    : <FreePackForm packId={pack.id} />;
}
```

- [ ] **Step 2: Write the failing test**

```tsx
// tests/pack-cta.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@/components/BuyButton', () => ({ BuyButton: () => <button>Buy this pack</button> }));
vi.mock('@/components/FreePackForm', () => ({ FreePackForm: () => <form data-testid="capture" /> }));
import { PackCta } from '@/components/PackCta';

describe('PackCta', () => {
  it('entitled → a download link', () => {
    const { container } = render(<PackCta pack={{ id: 'p1', slug: 'agency-essentials', kind: 'paid' }} entitled />);
    expect(container.querySelector('a[href="/api/download/pack/p1"]')).not.toBeNull();
  });
  it('not entitled + paid → Buy', () => {
    const { getByText } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'paid' }} entitled={false} />);
    expect(getByText('Buy this pack')).toBeTruthy();
  });
  it('not entitled + free → capture form', () => {
    const { getByTestId } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'free' }} entitled={false} />);
    expect(getByTestId('capture')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run → fail.**

- [ ] **Step 4: Implement PackCta (above) + wire the page**

In `app/(catalog)/packs/[slug]/page.tsx`: import `auth`, `getUserIdByEmail`, `getEntitlementsForUser`, `canDownloadPack`, `PackCta`. In the component after loading `pack`, compute:
```ts
  const session = await auth();
  const userId = session?.user?.email ? await getUserIdByEmail(session.user.email) : null;
  const entitlements = userId ? await getEntitlementsForUser(userId) : [];
  const entitled = canDownloadPack({ packId: pack.id, userEntitlements: entitlements });
```
Replace the inline `pack.kind === 'paid' ? <BuyButton…/> : <FreePackForm…/>` block with:
```tsx
              <PackCta pack={{ id: pack.id, slug: pack.slug, kind: pack.kind }} entitled={entitled} />
```

- [ ] **Step 5: Run** `npm run test -- tests/pack-cta.test.tsx` → pass; full `npm run test` + typecheck + lint.

- [ ] **Step 6: Commit** `feat: pack detail shows Download when entitled (else Buy / capture)`.

---

### Task 5: Acceptance

- [ ] **Step 1:** `npm run test` → all green (can-download-pack, pack-zip, pack-download-queries, pack-download-route, pack-cta + prior; DB-gated skip).
- [ ] **Step 2:** `npm run typecheck && npm run lint` → clean.
- [ ] **Step 3:** Build (env-prefixed; same prefix as other phases) → `/api/download/pack/[packId]` + `/packs/[slug]` compile.
- [ ] **Step 4: Manual:** own a pack (a 4a test purchase, or capture a free pack so a `pack:<id>` entitlement exists) → the pack page shows "Download pack" → a zip of the pack's layout JSONs + LICENSE; a non-owned paid pack shows Buy; `GET /api/download/pack/<id>` while signed-in-not-entitled → 403; signed-out → redirect to /login.
- [ ] **Step 5:** Commit (allow-empty) `chore: paid pack-bundle download acceptance verified`.

## Notes
- Seed layouts carry placeholder blob keys → a pack of only-seed layouts → 404 `asset_unavailable`; a pack with pipeline-generated layouts downloads real bytes.

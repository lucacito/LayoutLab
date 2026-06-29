# Free Individual Downloads (email-gated) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make any single published layout free to download, gated by a quick inline email capture (signed cookie). Drop the login + entitlement requirement for individual layouts; packs/all-access stay paid.

**Architecture:** A signed, httpOnly capture cookie marks a visitor as email-captured. The layout page renders an email form (if not captured) or a direct download link (if captured/signed-in). The download route's gate becomes "captured cookie OR session", not entitlement.

**Tech Stack:** Next.js 15 (route handlers, server actions, `next/headers` cookies), node crypto HMAC, Drizzle, Vitest.

## Global Constraints

- **Individual layouts are FREE**, gated by a **captured email** (signed cookie) — NOT login or a paid entitlement. The download route must NOT call `canDownloadLayout`/entitlement checks for single layouts. (`canDownloadLayout` stays in the repo, unused by this route, for the future paid pack-bundle download.)
- **The asset is only served through the gated proxy route** (never a public URL). Secrets (`AUTH_SECRET`) stay server-only.
- **Capture is best-effort for Loops** — a Loops failure never blocks the download.
- **Signed-in users skip the email form.** The cookie is signed with `AUTH_SECRET` (HMAC-SHA256) so it can't be trivially forged.
- **The existing 5b free-pack flow is untouched.**
- DB-touching tests mock the DB module or gate on `POSTGRES_URL`. Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Capture cookie (sign/verify + I/O)

**Files:**
- Create: `lib/capture/cookie.ts`
- Test: `tests/capture-cookie.test.ts`

**Interfaces:**
- Produces: `signCapture(email: string, secret: string): string`; `verifyCapture(value: string | null | undefined, secret: string): string | null`; `setCaptureCookie(email: string): Promise<void>`; `readCaptureEmail(): Promise<string | null>`; `CAPTURE_COOKIE` constant.

- [ ] **Step 1: Write the failing test (pure crypto)**

```ts
// tests/capture-cookie.test.ts
import { describe, it, expect } from 'vitest';
import { signCapture, verifyCapture } from '@/lib/capture/cookie';

const SECRET = 'test-secret-test-secret-32chars!!';

describe('capture cookie signing', () => {
  it('round-trips the email', () => {
    const signed = signCapture('Buyer@Example.com', SECRET);
    expect(verifyCapture(signed, SECRET)).toBe('Buyer@Example.com');
  });
  it('rejects a tampered payload', () => {
    const signed = signCapture('a@b.com', SECRET);
    const tampered = 'ZXZpbEBiLmNvbQ.' + signed.split('.')[1];
    expect(verifyCapture(tampered, SECRET)).toBeNull();
  });
  it('rejects a foreign-secret signature and empty/garbage', () => {
    const signed = signCapture('a@b.com', SECRET);
    expect(verifyCapture(signed, 'other-secret')).toBeNull();
    expect(verifyCapture(null, SECRET)).toBeNull();
    expect(verifyCapture('nodot', SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail.** `npm run test -- tests/capture-cookie.test.ts` (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/capture/cookie.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const CAPTURE_COOKIE = 'll_capture';

export function signCapture(email: string, secret: string): string {
  const payload = Buffer.from(email, 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

export function verifyCapture(value: string | null | undefined, secret: string): string | null {
  if (!value || !value.includes('.')) return null;
  const [payload, mac] = value.split('.');
  if (!payload || !mac) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export async function setCaptureCookie(email: string): Promise<void> {
  const store = await cookies();
  store.set(CAPTURE_COOKIE, signCapture(email, process.env.AUTH_SECRET ?? ''), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readCaptureEmail(): Promise<string | null> {
  const store = await cookies();
  return verifyCapture(store.get(CAPTURE_COOKIE)?.value, process.env.AUTH_SECRET ?? '');
}
```

- [ ] **Step 4: Run → pass** (3 tests). **Step 5: typecheck + commit** `feat: signed capture cookie for free downloads`.

---

### Task 2: Lead capture (`lib/capture/lead.ts`)

**Files:**
- Create: `lib/capture/lead.ts`
- Test: `tests/lead-capture.test.ts`

**Interfaces:**
- Consumes: `db`, `emailCaptures`, `normalizeEmail` (`./capture`), `syncContact` (`@/lib/email/loops`).
- Produces: `recordLeadCapture(email: string): Promise<void>`.

- [ ] **Step 1: Write the failing test (mock db + loops)**

```ts
// tests/lead-capture.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const values = vi.fn(async () => {});
const where = vi.fn(async () => {});
const set = vi.fn(() => ({ where }));
const insert = vi.fn(() => ({ values }));
const update = vi.fn(() => ({ set }));
vi.mock('@/db/client', () => ({ db: { insert, update } }));
const syncContact = vi.fn(async () => ({ synced: true }));
vi.mock('@/lib/email/loops', () => ({ syncContact }));

beforeEach(() => { values.mockClear(); set.mockClear(); insert.mockClear(); update.mockClear(); syncContact.mockReset(); syncContact.mockResolvedValue({ synced: true }); });

describe('recordLeadCapture', () => {
  it('records a normalized capture, syncs to Loops, and marks synced', async () => {
    const { recordLeadCapture } = await import('@/lib/capture/lead');
    await recordLeadCapture('  Buyer@Example.COM ');
    expect(insert).toHaveBeenCalled();
    const row = values.mock.calls[0][0];
    expect(row.email).toBe('buyer@example.com');
    expect(row.packId ?? null).toBeNull();
    expect(syncContact).toHaveBeenCalledWith(expect.objectContaining({ email: 'buyer@example.com', source: 'free_download' }));
    expect(update).toHaveBeenCalled();
  });
  it('still resolves when Loops fails (best-effort)', async () => {
    syncContact.mockResolvedValue({ synced: false });
    const { recordLeadCapture } = await import('@/lib/capture/lead');
    await expect(recordLeadCapture('a@b.com')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```ts
// lib/capture/lead.ts
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailCaptures } from '@/db/schema';
import { normalizeEmail } from './capture';
import { syncContact } from '@/lib/email/loops';

// Records an email lead for a free individual download: an email_captures row
// (no pack) + a best-effort Loops sync. Never throws on a Loops failure.
export async function recordLeadCapture(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const id = randomUUID();
  await db.insert(emailCaptures).values({ id, email: normalized, packId: null });
  const { synced } = await syncContact({ email: normalized, source: 'free_download' });
  await db.update(emailCaptures).set({ loopsSynced: synced }).where(eq(emailCaptures.id, id));
}
```

- [ ] **Step 4: Run → pass (2 tests). Step 5: typecheck + commit** `feat: recordLeadCapture for free-download email leads`.

---

### Task 3: Download route — capture/session gate

**Files:**
- Modify: `app/api/download/[layoutId]/route.ts`
- Modify: `tests/download-route.test.ts` (rewrite for the new gate)

**Interfaces:**
- Consumes: `readCaptureEmail` (Task 1), `auth` (`@/lib/auth`), `getLayoutForDownload`/`getUserIdByEmail`/`recordDownload` (`@/lib/account/queries`), `fetchAsset` (`@/lib/blob`), `buildLayoutZip` (`@/lib/download/zip`), `readLicense` (`@/lib/license`), `rateLimit` (`@/lib/rate-limit`).

- [ ] **Step 1: Rewrite the test (RED)**

Replace `tests/download-route.test.ts` with (mocks the new deps; uses `vi.hoisted` per the project pattern):

```ts
// tests/download-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  readCaptureEmail: vi.fn(async () => null as string | null),
  auth: vi.fn(async () => null as { user?: { email?: string } } | null),
  getLayoutForDownload: vi.fn(async () => ({ id: 'l1', slug: 'bold-saas-hero', diviJsonBlobKey: 'pipeline/out/x.json' })),
  getUserIdByEmail: vi.fn(async () => 'u1'),
  recordDownload: vi.fn(async () => {}),
  fetchAsset: vi.fn(async () => Buffer.from('{"content":[]}')),
  rateLimit: vi.fn(() => ({ ok: true, remaining: 39 })),
}));

vi.mock('@/lib/capture/cookie', () => ({ readCaptureEmail: h.readCaptureEmail }));
vi.mock('@/lib/auth', () => ({ auth: h.auth }));
vi.mock('@/lib/account/queries', () => ({ getLayoutForDownload: h.getLayoutForDownload, getUserIdByEmail: h.getUserIdByEmail, recordDownload: h.recordDownload }));
vi.mock('@/lib/blob', () => ({ fetchAsset: h.fetchAsset }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));

import { GET } from '@/app/api/download/[layoutId]/route';
const ctx = (id: string) => ({ params: Promise.resolve({ layoutId: id }) });
const req = () => new Request('http://test/api/download/l1');

beforeEach(() => {
  h.readCaptureEmail.mockResolvedValue(null);
  h.auth.mockResolvedValue(null);
  h.fetchAsset.mockResolvedValue(Buffer.from('{"content":[]}'));
  h.rateLimit.mockReturnValue({ ok: true, remaining: 39 });
  h.recordDownload.mockClear();
});

describe('GET /api/download/[layoutId]', () => {
  it('403 email_required when neither a capture cookie nor a session', async () => {
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(403);
    expect(h.recordDownload).not.toHaveBeenCalled();
  });

  it('200 zip when a valid capture cookie is present (anonymous)', async () => {
    h.readCaptureEmail.mockResolvedValue('a@b.com');
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('bold-saas-hero.zip');
    expect(h.recordDownload).toHaveBeenCalled();
  });

  it('200 zip when signed in without a cookie', async () => {
    h.auth.mockResolvedValue({ user: { email: 'u@x.com' } });
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(200);
  });

  it('429 when rate-limited (no download)', async () => {
    h.rateLimit.mockReturnValue({ ok: false, remaining: 0 });
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(429);
    expect(h.recordDownload).not.toHaveBeenCalled();
  });

  it('404 when the asset is unavailable (entitled by cookie)', async () => {
    h.readCaptureEmail.mockResolvedValue('a@b.com');
    h.fetchAsset.mockResolvedValue(null);
    const res = await GET(req(), ctx('l1'));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run → fail.** `npm run test -- tests/download-route.test.ts`.

- [ ] **Step 3: Rewrite the route**

```ts
// app/api/download/[layoutId]/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readCaptureEmail } from '@/lib/capture/cookie';
import { getLayoutForDownload, getUserIdByEmail, recordDownload } from '@/lib/account/queries';
import { fetchAsset } from '@/lib/blob';
import { buildLayoutZip } from '@/lib/download/zip';
import { readLicense } from '@/lib/license';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ layoutId: string }> }): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`dl:${ip}`, { limit: 40, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { layoutId } = await params;
  const layout = await getLayoutForDownload(layoutId);
  if (!layout) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Individual layouts are free, gated by a captured email (cookie) or a session.
  const capturedEmail = await readCaptureEmail();
  const session = await auth();
  const sessionEmail = session?.user?.email ?? null;
  if (!capturedEmail && !sessionEmail) {
    return NextResponse.json({ error: 'email_required' }, { status: 403 });
  }

  const bytes = await fetchAsset(layout.diviJsonBlobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_unavailable' }, { status: 404 });

  const userId = sessionEmail ? await getUserIdByEmail(sessionEmail) : null;
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

- [ ] **Step 4: Run → pass (5 tests). Step 5: full `npm run test` (the 4b cases are replaced; everything else green) + typecheck + commit** `feat: free individual downloads — capture/session gate (drop entitlement requirement)`.

---

### Task 4: Layout-detail free-download gate (action + UI)

**Files:**
- Create: `lib/capture/download-actions.ts`, `components/FreeDownloadGate.tsx`
- Modify: `app/(catalog)/layouts/[slug]/page.tsx`
- Test: `tests/free-download-gate.test.tsx`

**Interfaces:**
- Consumes: `recordLeadCapture` (Task 2), `setCaptureCookie`/`readCaptureEmail` (Task 1), `normalizeEmail` (`@/lib/capture/capture`), `auth` (`@/lib/auth`), `Icon`.
- Produces: `captureAndDownloadAction(layoutId: string, slug: string, formData: FormData): Promise<void>`; `FreeDownloadGate({ layoutId, slug, captured }: { layoutId: string; slug: string; captured: boolean })`.

- [ ] **Step 1: Write the failing component test**

```tsx
// tests/free-download-gate.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@/lib/capture/download-actions', () => ({ captureAndDownloadAction: vi.fn() }));
import { FreeDownloadGate } from '@/components/FreeDownloadGate';

describe('FreeDownloadGate', () => {
  it('shows a direct download link when captured', () => {
    const { container } = render(<FreeDownloadGate layoutId="l1" slug="bold-saas-hero" captured />);
    expect(container.querySelector('a[href="/api/download/l1"]')).not.toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });
  it('shows an email form when not captured', () => {
    const { container, getByRole } = render(<FreeDownloadGate layoutId="l1" slug="bold-saas-hero" captured={false} />);
    expect(container.querySelector('input[type="email"][name="email"]')).not.toBeNull();
    expect(getByRole('button')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement the server action**

```ts
// lib/capture/download-actions.ts
'use server';
import { redirect } from 'next/navigation';
import { normalizeEmail } from './capture';
import { recordLeadCapture } from './lead';
import { setCaptureCookie } from './cookie';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function captureAndDownloadAction(layoutId: string, slug: string, formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (!EMAIL_RE.test(email)) redirect(`/layouts/${slug}?capture=error`);
  await recordLeadCapture(email);
  await setCaptureCookie(email);
  redirect(`/api/download/${layoutId}`);
}
```

- [ ] **Step 4: Implement `FreeDownloadGate`**

```tsx
// components/FreeDownloadGate.tsx
import { captureAndDownloadAction } from '@/lib/capture/download-actions';
import { Icon } from '@/components/ui/Icon';

export function FreeDownloadGate({ layoutId, slug, captured }: { layoutId: string; slug: string; captured: boolean }) {
  if (captured) {
    return (
      <a
        href={`/api/download/${layoutId}`}
        download={`${slug}.zip`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
      >
        <Icon name="download" size={20} /> Download free
      </a>
    );
  }
  return (
    <form action={captureAndDownloadAction.bind(null, layoutId, slug)} className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email"
        className="h-11 w-full rounded-full border border-fog bg-paper px-4 text-body text-navy outline-none focus:border-action sm:w-64"
      />
      <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
        <Icon name="download" size={20} /> Get it free
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Wire it into the layout page**

In `app/(catalog)/layouts/[slug]/page.tsx`: add imports
```ts
import { readCaptureEmail } from '@/lib/capture/cookie';
import { auth } from '@/lib/auth';
import { FreeDownloadGate } from '@/components/FreeDownloadGate';
```
In the component, after loading `layout`, compute:
```ts
  const [captureEmail, session] = await Promise.all([readCaptureEmail(), auth()]);
  const captured = Boolean(captureEmail || session?.user);
```
Render the gate under the title block (after the description `<p>`, before the gallery `<div className="mt-6">`):
```tsx
        <div className="mt-5">
          <FreeDownloadGate layoutId={layout.id} slug={layout.slug} captured={captured} />
          <p className="mt-2 text-small text-muted">Free · no account needed · imports into Divi 5.</p>
        </div>
```

- [ ] **Step 6: Run** `npm run test -- tests/free-download-gate.test.tsx` → pass; then full `npm run test` + `npm run typecheck` + `npm run lint`.

- [ ] **Step 7: Commit** `feat: free-download gate on layout pages (inline email capture → download)`.

---

### Task 5: Acceptance

- [ ] **Step 1:** `npm run test` → all green (capture-cookie, lead-capture, download-route, free-download-gate, plus prior suites; DB-gated skip).
- [ ] **Step 2:** `npm run typecheck && npm run lint` → clean.
- [ ] **Step 3:** Production build (env-prefixed):
```bash
NEXT_PUBLIC_SITE_URL=https://layoutlab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@layoutlab.com npm run build
```
Expect `/api/download/[layoutId]` + `/layouts/[slug]` compile.
- [ ] **Step 4: Manual (local DB):** open a layout with a real pipeline JSON (seed layouts have placeholder keys → 404 by design; use a pipeline-generated one or accept the 404) → enter email → file downloads + an `email_captures` row appears; reload → a direct "Download free" button (cookie set); `GET /api/download/<id>` from a fresh incognito (no cookie/session) → 403 `email_required`.
- [ ] **Step 5:** Commit (allow-empty) `chore: free individual downloads acceptance verified`.

---

## Notes
- Seed layouts carry placeholder `diviJsonBlobKey`s → 404 `asset_unavailable` by design; only pipeline-generated layouts (or a real Blob asset) download actual bytes.
- Paid **pack-bundle** download (the paid SKU's delivery) is the next follow-up; it will use `canDownloadLayout`/entitlements.

# Plugin Licensing Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make divi5lab.com the license server + store for the converter Pro plugins: Stripe annual-subscription checkout mints license keys, a license REST API serves plugin activation/validation/updates, and buyers manage licenses in their account.

**Architecture:** New `licenses` / `license_activations` / `plugin_releases` Drizzle tables. Pure license logic in `lib/license-server/` behind a `LicenseStore` interface (same pattern as `lib/stripe/fulfillment.ts` + `fulfillment-store.ts`), thin route handlers on top. Stripe fulfillment extends the existing webhook: `metadata.kind === 'plugin'` mints a license; plugin subscriptions are distinguished from membership by `subscription_data.metadata` and tracked on the license row (NOT in the `subscriptions` table, which stays membership-only).

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM (Postgres), Stripe SDK, zod, Vitest, JSZip, Vercel Blob (`lib/blob`), Resend (`lib/email`).

**Spec:** `docs/superpowers/specs/2026-07-11-plugin-store-pivot-design.md` (§4). Phase 2 (the PHP plugin split + license client in `../jhmg-elementor-to-divi5`) is a SEPARATE plan — do not touch the plugin repos in this plan.

## Global Constraints

- Product slugs are exactly `elementor-to-divi5-pro` and `divi-to-elementor-pro` — everywhere (metadata, entitlement scopes, API params, blob keys).
- Entitlement scope format: `plugin:<product-slug>` (e.g. `plugin:elementor-to-divi5-pro`).
- License key format: `JHMG-XXXX-XXXX-XXXX-XXXX`, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L lookalikes).
- `past_due` licenses stay usable for exactly 7 days after `current_period_end` (`PAST_DUE_GRACE_MS`), then read as `expired`.
- Update-check for a non-usable license returns update metadata but NEVER a `package` URL.
- All new API routes: zod-validate input, rate-limit via `rateLimit()` from `@/lib/rate-limit`, never leak whether a key exists beyond the documented error codes.
- Secrets stay server-only. Run `npm run test` (vitest) + `npm run typecheck` per task; commit after each green task.
- House rules: TDD (test first, watch it fail), no reimplementing existing helpers (reuse `lib/blob`, `lib/email`, `lib/rate-limit`, `find-or-create-user`).

---

### Task 1: Schema — licenses, license_activations, plugin_releases

**Files:**
- Modify: `db/schema.ts` (append after `taxonomyPages`, plus one enum near the other enums)
- Test: `tests/license-schema.test.ts`
- Generated: `db/migrations/00XX_*.sql` (via `npm run db:generate`)

**Interfaces:**
- Consumes: existing `users` table, drizzle helpers already imported in `db/schema.ts`.
- Produces: exported tables `licenses`, `licenseActivations`, `pluginReleases`, enum `licenseStatus` with columns exactly as coded below — later tasks import these from `@/db/schema`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/license-schema.test.ts
import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { licenses, licenseActivations, pluginReleases } from '@/db/schema';

describe('licensing schema', () => {
  it('defines the licenses table with key/status/subscription columns', () => {
    expect(getTableName(licenses)).toBe('licenses');
    expect(licenses.licenseKey.name).toBe('license_key');
    expect(licenses.productSlug.name).toBe('product_slug');
    expect(licenses.stripeSubscriptionId.name).toBe('stripe_subscription_id');
    expect(licenses.currentPeriodEnd.name).toBe('current_period_end');
    expect(licenses.status.name).toBe('status');
  });

  it('defines license_activations keyed by license + site', () => {
    expect(getTableName(licenseActivations)).toBe('license_activations');
    expect(licenseActivations.siteUrl.name).toBe('site_url');
    expect(licenseActivations.lastSeenAt.name).toBe('last_seen_at');
    expect(licenseActivations.deactivatedAt.name).toBe('deactivated_at');
  });

  it('defines plugin_releases with product/version/blob', () => {
    expect(getTableName(pluginReleases)).toBe('plugin_releases');
    expect(pluginReleases.productSlug.name).toBe('product_slug');
    expect(pluginReleases.version.name).toBe('version');
    expect(pluginReleases.blobKey.name).toBe('blob_key');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/license-schema.test.ts`
Expected: FAIL — `licenses` has no exported member.

- [ ] **Step 3: Add schema**

In `db/schema.ts`, add next to the other enums (top of file):

```ts
export const licenseStatus = pgEnum('license_status', ['active', 'past_due', 'expired', 'canceled']);
```

Append at the end of the file:

```ts
// ---- Plugin licensing (plugin-store pivot, spec 2026-07-11) ---------------
export const licenses = pgTable('licenses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productSlug: text('product_slug').notNull(), // 'elementor-to-divi5-pro' | 'divi-to-elementor-pro'
  licenseKey: text('license_key').notNull().unique(),
  status: licenseStatus('status').notNull().default('active'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  stripeSubUq: uniqueIndex('licenses_stripe_sub_uq').on(t.stripeSubscriptionId),
  userIdx: index('licenses_user_idx').on(t.userId),
}));

export const licenseActivations = pgTable('license_activations', {
  id: text('id').primaryKey(),
  licenseId: text('license_id').notNull().references(() => licenses.id, { onDelete: 'cascade' }),
  siteUrl: text('site_url').notNull(), // normalized (host+path, no scheme/www/trailing slash)
  pluginVersion: text('plugin_version'),
  wpVersion: text('wp_version'),
  activatedAt: timestamp('activated_at').notNull().defaultNow(),
  deactivatedAt: timestamp('deactivated_at'),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
}, (t) => ({
  licenseSiteUq: uniqueIndex('license_activations_license_site_uq').on(t.licenseId, t.siteUrl),
}));

export const pluginReleases = pgTable('plugin_releases', {
  id: text('id').primaryKey(),
  productSlug: text('product_slug').notNull(),
  version: text('version').notNull(),
  blobKey: text('blob_key').notNull(),
  changelog: text('changelog'),
  releasedAt: timestamp('released_at').notNull().defaultNow(),
}, (t) => ({
  productVersionUq: uniqueIndex('plugin_releases_product_version_uq').on(t.productSlug, t.version),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/license-schema.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Generate + apply migration, typecheck**

Run: `npm run db:generate` then `npm run db:migrate`
Expected: a new SQL file in `db/migrations/` creating the 3 tables + enum; migrate applies cleanly against the local DB.
Run: `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations tests/license-schema.test.ts
git commit -m "feat(licensing): licenses, license_activations, plugin_releases tables"
```

---

### Task 2: Pure license logic — keys, URL normalization, status, versions

**Files:**
- Create: `lib/license-server/core.ts`
- Test: `tests/license-core.test.ts`

**Interfaces:**
- Consumes: nothing project-specific (node:crypto only).
- Produces (exact exports later tasks import from `@/lib/license-server/core`):
  - `PLUGIN_PRODUCTS: readonly ['elementor-to-divi5-pro', 'divi-to-elementor-pro']`, `type PluginProduct`
  - `PRODUCT_TITLES: Record<PluginProduct, string>`
  - `generateLicenseKey(rng?: (n: number) => Buffer): string`
  - `normalizeSiteUrl(raw: string): string | null`
  - `PAST_DUE_GRACE_MS: number`
  - `type StoredLicenseStatus = 'active' | 'past_due' | 'expired' | 'canceled'`
  - `interface LicenseRecord { id: string; userId: string; productSlug: string; licenseKey: string; status: StoredLicenseStatus; currentPeriodEnd: Date | null }`
  - `effectiveStatus(l: Pick<LicenseRecord, 'status' | 'currentPeriodEnd'>, now: Date): StoredLicenseStatus`
  - `isLicenseUsable(l: Pick<LicenseRecord, 'status' | 'currentPeriodEnd'>, now: Date): boolean`
  - `isNewerVersion(candidate: string, installed: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/license-core.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateLicenseKey, normalizeSiteUrl, effectiveStatus, isLicenseUsable,
  isNewerVersion, PAST_DUE_GRACE_MS, PLUGIN_PRODUCTS,
} from '@/lib/license-server/core';

describe('generateLicenseKey', () => {
  it('produces JHMG-XXXX-XXXX-XXXX-XXXX from the safe alphabet', () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^JHMG(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){4}$/);
  });
  it('is deterministic given an injected rng', () => {
    const rng = (n: number) => Buffer.alloc(n, 0); // all zeros -> first alphabet char
    expect(generateLicenseKey(rng)).toBe('JHMG-AAAA-AAAA-AAAA-AAAA');
  });
});

describe('normalizeSiteUrl', () => {
  it('strips scheme, www and trailing slash, lowercases', () => {
    expect(normalizeSiteUrl('HTTPS://WWW.Example.com/')).toBe('example.com');
    expect(normalizeSiteUrl('http://example.com/blog/')).toBe('example.com/blog');
    expect(normalizeSiteUrl('example.com')).toBe('example.com');
  });
  it('rejects garbage', () => {
    expect(normalizeSiteUrl('')).toBeNull();
    expect(normalizeSiteUrl('not a url at all !!')).toBeNull();
  });
  it('accepts localhost for dev sites', () => {
    expect(normalizeSiteUrl('http://localhost:8080/')).toBe('localhost:8080');
  });
});

describe('effectiveStatus / isLicenseUsable', () => {
  const periodEnd = new Date('2026-07-01T00:00:00Z');
  it('past_due within 7-day grace is usable', () => {
    const now = new Date(periodEnd.getTime() + PAST_DUE_GRACE_MS - 1000);
    const l = { status: 'past_due' as const, currentPeriodEnd: periodEnd };
    expect(effectiveStatus(l, now)).toBe('past_due');
    expect(isLicenseUsable(l, now)).toBe(true);
  });
  it('past_due beyond grace reads as expired and unusable', () => {
    const now = new Date(periodEnd.getTime() + PAST_DUE_GRACE_MS + 1000);
    const l = { status: 'past_due' as const, currentPeriodEnd: periodEnd };
    expect(effectiveStatus(l, now)).toBe('expired');
    expect(isLicenseUsable(l, now)).toBe(false);
  });
  it('active is usable; canceled/expired are not', () => {
    const now = new Date('2026-07-11T00:00:00Z');
    expect(isLicenseUsable({ status: 'active', currentPeriodEnd: null }, now)).toBe(true);
    expect(isLicenseUsable({ status: 'canceled', currentPeriodEnd: null }, now)).toBe(false);
    expect(isLicenseUsable({ status: 'expired', currentPeriodEnd: null }, now)).toBe(false);
  });
});

describe('isNewerVersion', () => {
  it('compares dotted versions numerically', () => {
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
    expect(isNewerVersion('2.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true); // not lexicographic
  });
});

describe('PLUGIN_PRODUCTS', () => {
  it('lists exactly the two converter Pro slugs', () => {
    expect([...PLUGIN_PRODUCTS]).toEqual(['elementor-to-divi5-pro', 'divi-to-elementor-pro']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/license-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/license-server/core.ts
// Pure license-domain logic. No DB, no HTTP — everything here is unit-testable
// and shared by the fulfillment webhook, the license API, and account queries.
import { randomBytes } from 'node:crypto';

export const PLUGIN_PRODUCTS = ['elementor-to-divi5-pro', 'divi-to-elementor-pro'] as const;
export type PluginProduct = (typeof PLUGIN_PRODUCTS)[number];

export const PRODUCT_TITLES: Record<PluginProduct, string> = {
  'elementor-to-divi5-pro': 'JHMG Converter For Elementor to Divi 5 — Pro',
  'divi-to-elementor-pro': 'JHMG Converter For Divi to Elementor — Pro',
};

// No 0/O/1/I/L so keys survive being read aloud or retyped from a receipt.
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateLicenseKey(rng: (n: number) => Buffer = randomBytes): string {
  const bytes = rng(16);
  const chars: string[] = [];
  for (let i = 0; i < 16; i++) chars.push(KEY_ALPHABET[bytes[i]! % KEY_ALPHABET.length]!);
  const g = (s: number) => chars.slice(s, s + 4).join('');
  return `JHMG-${g(0)}-${g(4)}-${g(8)}-${g(12)}`;
}

// Canonical site identity: host(+port)+path, lowercase, no scheme/www/trailing
// slash — so http://www.Foo.com/ and https://foo.com activate the same slot.
export function normalizeSiteUrl(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.host.replace(/^www\./, '');
  const bareHost = u.hostname.replace(/^www\./, '');
  if (!bareHost.includes('.') && bareHost !== 'localhost') return null;
  const path = u.pathname.replace(/\/+$/, '');
  return host + path;
}

export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredLicenseStatus = 'active' | 'past_due' | 'expired' | 'canceled';

export interface LicenseRecord {
  id: string;
  userId: string;
  productSlug: string;
  licenseKey: string;
  status: StoredLicenseStatus;
  currentPeriodEnd: Date | null;
}

// past_due keeps Pro working for 7 days after the period lapses (covers Stripe
// payment retries); after that it reads as expired without waiting on a webhook.
export function effectiveStatus(
  l: Pick<LicenseRecord, 'status' | 'currentPeriodEnd'>,
  now: Date,
): StoredLicenseStatus {
  if (l.status === 'past_due' && l.currentPeriodEnd
      && now.getTime() > l.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS) {
    return 'expired';
  }
  return l.status;
}

export function isLicenseUsable(
  l: Pick<LicenseRecord, 'status' | 'currentPeriodEnd'>,
  now: Date,
): boolean {
  const s = effectiveStatus(l, now);
  return s === 'active' || s === 'past_due';
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(candidate); const b = parse(installed);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0; const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/license-core.test.ts`
Expected: PASS. (If the localhost case fails: note `normalizeSiteUrl` must use `u.host` — which keeps `:8080` — for the returned string, and `u.hostname` only for the dot/localhost check, exactly as coded above.)

- [ ] **Step 5: Commit**

```bash
git add lib/license-server/core.ts tests/license-core.test.ts
git commit -m "feat(licensing): pure license core — key gen, site-url normalization, status grace, version compare"
```

---

### Task 3: License API handlers (activate / validate / deactivate / update-check) against a store interface

**Files:**
- Create: `lib/license-server/handlers.ts`
- Test: `tests/license-handlers.test.ts`

**Interfaces:**
- Consumes: everything from Task 2 (`@/lib/license-server/core`).
- Produces (imported by Tasks 4, 5, 8):
  - `interface LicenseStore { findByKey(key: string): Promise<LicenseRecord | null>; upsertActivation(a: { licenseId: string; siteUrl: string; pluginVersion?: string; wpVersion?: string }): Promise<void>; markDeactivated(licenseId: string, siteUrl: string): Promise<void>; latestRelease(productSlug: string): Promise<{ version: string; blobKey: string; changelog: string | null } | null> }`
  - `type LicenseApiResult = { status: number; body: Record<string, unknown> }`
  - `handleActivate(input: { key: string; siteUrl: string; product: string; pluginVersion?: string; wpVersion?: string }, store: LicenseStore, now?: Date): Promise<LicenseApiResult>`
  - `handleValidate(input: { key: string; siteUrl: string; product: string }, store: LicenseStore, now?: Date): Promise<LicenseApiResult>`
  - `handleDeactivate(input: { key: string; siteUrl: string }, store: LicenseStore): Promise<LicenseApiResult>`
  - `handleUpdateCheck(input: { product: string; version: string; key?: string }, store: LicenseStore, siteUrl: string, now?: Date): Promise<LicenseApiResult>` — `siteUrl` here is the STORE's public origin (for building the package URL), not a WP site.

Error body contract (all handlers): `400 {error:'invalid_request'}`, `404 {error:'invalid_key'}`, `403 {error:'product_mismatch'}` or `403 {error:'license_not_usable', status}`. Success bodies are in the tests below.

- [ ] **Step 1: Write the failing test**

```ts
// tests/license-handlers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { LicenseRecord } from '@/lib/license-server/core';
import { PAST_DUE_GRACE_MS } from '@/lib/license-server/core';
import {
  handleActivate, handleValidate, handleDeactivate, handleUpdateCheck,
  type LicenseStore,
} from '@/lib/license-server/handlers';

const NOW = new Date('2026-07-11T12:00:00Z');
const KEY = 'JHMG-AAAA-BBBB-CCCC-DDDD';

function makeStore(license: LicenseRecord | null, release?: { version: string; blobKey: string; changelog: string | null }) {
  const activations: Array<{ licenseId: string; siteUrl: string }> = [];
  const deactivated: Array<{ licenseId: string; siteUrl: string }> = [];
  const store: LicenseStore = {
    async findByKey(k) { return license && k === license.licenseKey ? license : null; },
    async upsertActivation(a) { activations.push({ licenseId: a.licenseId, siteUrl: a.siteUrl }); },
    async markDeactivated(licenseId, siteUrl) { deactivated.push({ licenseId, siteUrl }); },
    async latestRelease() { return release ?? null; },
  };
  return { store, activations, deactivated };
}

const LICENSE: LicenseRecord = {
  id: 'lic_1', userId: 'u1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: KEY, status: 'active', currentPeriodEnd: new Date('2027-07-11T00:00:00Z'),
};

describe('handleActivate', () => {
  it('activates a usable license and records the normalized site', async () => {
    const { store, activations } = makeStore(LICENSE);
    const res = await handleActivate(
      { key: KEY, siteUrl: 'https://www.Client-Site.com/', product: 'elementor-to-divi5-pro', pluginVersion: '1.0.0' },
      store, NOW,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'active', product: 'elementor-to-divi5-pro' });
    expect(res.body.expires).toBe('2027-07-11T00:00:00.000Z');
    expect(activations).toEqual([{ licenseId: 'lic_1', siteUrl: 'client-site.com' }]);
  });
  it('404s an unknown key', async () => {
    const { store } = makeStore(null);
    const res = await handleActivate({ key: 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ', siteUrl: 'a.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'invalid_key' });
  });
  it('403s a key for the other product', async () => {
    const { store } = makeStore(LICENSE);
    const res = await handleActivate({ key: KEY, siteUrl: 'a.com', product: 'divi-to-elementor-pro' }, store, NOW);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'product_mismatch' });
  });
  it('403s an expired license with its effective status', async () => {
    const old = { ...LICENSE, status: 'past_due' as const, currentPeriodEnd: new Date(NOW.getTime() - PAST_DUE_GRACE_MS - 1000) };
    const { store } = makeStore(old);
    const res = await handleActivate({ key: KEY, siteUrl: 'a.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'license_not_usable', status: 'expired' });
  });
  it('400s a garbage site url', async () => {
    const { store } = makeStore(LICENSE);
    const res = await handleActivate({ key: KEY, siteUrl: '!!!', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_request' });
  });
});

describe('handleValidate', () => {
  it('returns status and refreshes last-seen via upsertActivation', async () => {
    const { store, activations } = makeStore(LICENSE);
    const res = await handleValidate({ key: KEY, siteUrl: 'client-site.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'active' });
    expect(activations.length).toBe(1);
  });
  it('past_due within grace validates as past_due (still usable)', async () => {
    const pd = { ...LICENSE, status: 'past_due' as const, currentPeriodEnd: new Date(NOW.getTime() - 1000) };
    const { store } = makeStore(pd);
    const res = await handleValidate({ key: KEY, siteUrl: 'client-site.com', product: 'elementor-to-divi5-pro' }, store, NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'past_due' });
  });
});

describe('handleDeactivate', () => {
  it('marks the site deactivated and is idempotent-shaped (200 even if unknown site)', async () => {
    const { store, deactivated } = makeStore(LICENSE);
    const res = await handleDeactivate({ key: KEY, siteUrl: 'https://client-site.com' }, store);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(deactivated).toEqual([{ licenseId: 'lic_1', siteUrl: 'client-site.com' }]);
  });
});

describe('handleUpdateCheck', () => {
  const RELEASE = { version: '1.2.0', blobKey: 'plugins/elementor-to-divi5-pro/elementor-to-divi5-pro-1.2.0.zip', changelog: 'Fixes' };
  it('licensed + newer release => update with package URL carrying the key', async () => {
    const { store } = makeStore(LICENSE, RELEASE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.0.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ update: true, version: '1.2.0', changelog: 'Fixes' });
    expect(res.body.package).toBe(`https://divi5lab.com/api/plugin/download?product=elementor-to-divi5-pro&key=${encodeURIComponent(KEY)}`);
  });
  it('unusable license => update metadata visible but NO package (renewal nudge)', async () => {
    const dead = { ...LICENSE, status: 'canceled' as const };
    const { store } = makeStore(dead, RELEASE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.0.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ update: true, version: '1.2.0' });
    expect(res.body.package).toBeUndefined();
  });
  it('already newest => update: false', async () => {
    const { store } = makeStore(LICENSE, RELEASE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.2.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ update: false });
  });
  it('no release row => update: false', async () => {
    const { store } = makeStore(LICENSE);
    const res = await handleUpdateCheck({ product: 'elementor-to-divi5-pro', version: '1.0.0', key: KEY }, store, 'https://divi5lab.com', NOW);
    expect(res.body).toEqual({ update: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/license-handlers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/license-server/handlers.ts
// Transport-agnostic license API logic over a LicenseStore (same pattern as
// lib/stripe/fulfillment.ts): routes stay thin, tests use an in-memory store.
import {
  effectiveStatus, isLicenseUsable, isNewerVersion, normalizeSiteUrl,
  type LicenseRecord,
} from './core';

export interface LicenseStore {
  findByKey(key: string): Promise<LicenseRecord | null>;
  upsertActivation(a: { licenseId: string; siteUrl: string; pluginVersion?: string; wpVersion?: string }): Promise<void>;
  markDeactivated(licenseId: string, siteUrl: string): Promise<void>;
  latestRelease(productSlug: string): Promise<{ version: string; blobKey: string; changelog: string | null } | null>;
}

export type LicenseApiResult = { status: number; body: Record<string, unknown> };

const invalidRequest: LicenseApiResult = { status: 400, body: { error: 'invalid_request' } };
const invalidKey: LicenseApiResult = { status: 404, body: { error: 'invalid_key' } };

function licenseBody(l: LicenseRecord, now: Date): Record<string, unknown> {
  return {
    status: effectiveStatus(l, now),
    product: l.productSlug,
    expires: l.currentPeriodEnd ? l.currentPeriodEnd.toISOString() : null,
  };
}

async function findUsable(
  key: string, product: string | null, store: LicenseStore, now: Date,
): Promise<{ license: LicenseRecord } | { fail: LicenseApiResult }> {
  const license = await store.findByKey(key);
  if (!license) return { fail: invalidKey };
  if (product !== null && license.productSlug !== product) {
    return { fail: { status: 403, body: { error: 'product_mismatch' } } };
  }
  if (!isLicenseUsable(license, now)) {
    return { fail: { status: 403, body: { error: 'license_not_usable', status: effectiveStatus(license, now) } } };
  }
  return { license };
}

export async function handleActivate(
  input: { key: string; siteUrl: string; product: string; pluginVersion?: string; wpVersion?: string },
  store: LicenseStore,
  now: Date = new Date(),
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const r = await findUsable(input.key, input.product, store, now);
  if ('fail' in r) return r.fail;
  await store.upsertActivation({
    licenseId: r.license.id, siteUrl: site,
    pluginVersion: input.pluginVersion, wpVersion: input.wpVersion,
  });
  return { status: 200, body: licenseBody(r.license, now) };
}

export async function handleValidate(
  input: { key: string; siteUrl: string; product: string },
  store: LicenseStore,
  now: Date = new Date(),
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const r = await findUsable(input.key, input.product, store, now);
  if ('fail' in r) return r.fail;
  await store.upsertActivation({ licenseId: r.license.id, siteUrl: site }); // refresh last_seen
  return { status: 200, body: licenseBody(r.license, now) };
}

export async function handleDeactivate(
  input: { key: string; siteUrl: string },
  store: LicenseStore,
): Promise<LicenseApiResult> {
  const site = normalizeSiteUrl(input.siteUrl);
  if (!site) return invalidRequest;
  const license = await store.findByKey(input.key);
  if (!license) return invalidKey;
  await store.markDeactivated(license.id, site);
  return { status: 200, body: { ok: true } };
}

export async function handleUpdateCheck(
  input: { product: string; version: string; key?: string },
  store: LicenseStore,
  siteUrl: string, // the store's public origin, e.g. env.NEXT_PUBLIC_SITE_URL
  now: Date = new Date(),
): Promise<LicenseApiResult> {
  const release = await store.latestRelease(input.product);
  if (!release || !isNewerVersion(release.version, input.version)) {
    return { status: 200, body: { update: false } };
  }
  const body: Record<string, unknown> = {
    update: true, version: release.version, changelog: release.changelog ?? '',
  };
  if (input.key) {
    const license = await store.findByKey(input.key);
    if (license && license.productSlug === input.product && isLicenseUsable(license, now)) {
      body.package = `${siteUrl}/api/plugin/download?product=${encodeURIComponent(input.product)}&key=${encodeURIComponent(input.key)}`;
    }
  }
  return { status: 200, body };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/license-handlers.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/license-server/handlers.ts tests/license-handlers.test.ts
git commit -m "feat(licensing): activate/validate/deactivate/update-check handlers over LicenseStore"
```

---

### Task 4: Drizzle LicenseStore implementation

**Files:**
- Create: `lib/license-server/store.ts`
- Test: `tests/license-store.test.ts`

**Interfaces:**
- Consumes: `LicenseStore` from Task 3, tables from Task 1, `@/db/client`.
- Produces: `dbLicenseStore: LicenseStore` (used by routes in Tasks 5 & 8) and `getLicensesForUser(userId: string)` (used by Task 10) returning `Array<{ id: string; productSlug: string; licenseKey: string; status: StoredLicenseStatus; currentPeriodEnd: Date | null; activeSites: string[] }>`.

- [ ] **Step 1: Write the failing test** (mock `@/db/client` the same way `tests/account-queries.test.ts` does — check that file first and mirror its mocking approach; the test below assumes a `vi.mock('@/db/client')` with a chainable fake; adapt the fake to match, keeping the assertions)

```ts
// tests/license-store.test.ts
import { describe, it, expect } from 'vitest';
import { dbLicenseStore } from '@/lib/license-server/store';

describe('dbLicenseStore shape', () => {
  it('implements the LicenseStore interface', () => {
    expect(typeof dbLicenseStore.findByKey).toBe('function');
    expect(typeof dbLicenseStore.upsertActivation).toBe('function');
    expect(typeof dbLicenseStore.markDeactivated).toBe('function');
    expect(typeof dbLicenseStore.latestRelease).toBe('function');
  });
});
```

(The behavioral coverage for this module comes from Task 3's handler tests + the
e2e later; this store is deliberately thin SQL, mirroring how `fulfillment-store.ts`
is covered. If `tests/account-queries.test.ts` shows a workable db-mocking pattern,
add one behavioral test for `findByKey` field mapping using that pattern.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/license-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/license-server/store.ts
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { licenses, licenseActivations, pluginReleases } from '@/db/schema';
import type { LicenseRecord, StoredLicenseStatus } from './core';
import type { LicenseStore } from './handlers';

export const dbLicenseStore: LicenseStore = {
  async findByKey(key) {
    const rows = await db.select().from(licenses).where(eq(licenses.licenseKey, key)).limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id, userId: r.userId, productSlug: r.productSlug, licenseKey: r.licenseKey,
      status: r.status as LicenseRecord['status'], currentPeriodEnd: r.currentPeriodEnd,
    };
  },
  async upsertActivation(a) {
    await db.insert(licenseActivations).values({
      id: randomUUID(), licenseId: a.licenseId, siteUrl: a.siteUrl,
      pluginVersion: a.pluginVersion, wpVersion: a.wpVersion,
    }).onConflictDoUpdate({
      target: [licenseActivations.licenseId, licenseActivations.siteUrl],
      set: {
        lastSeenAt: new Date(), deactivatedAt: null,
        ...(a.pluginVersion ? { pluginVersion: a.pluginVersion } : {}),
        ...(a.wpVersion ? { wpVersion: a.wpVersion } : {}),
      },
    });
  },
  async markDeactivated(licenseId, siteUrl) {
    await db.update(licenseActivations)
      .set({ deactivatedAt: new Date() })
      .where(and(eq(licenseActivations.licenseId, licenseId), eq(licenseActivations.siteUrl, siteUrl)));
  },
  async latestRelease(productSlug) {
    const rows = await db.select().from(pluginReleases)
      .where(eq(pluginReleases.productSlug, productSlug))
      .orderBy(desc(pluginReleases.releasedAt)).limit(1);
    const r = rows[0];
    return r ? { version: r.version, blobKey: r.blobKey, changelog: r.changelog } : null;
  },
};

// Account page query: a user's licenses with their currently-active sites.
export async function getLicensesForUser(userId: string): Promise<Array<{
  id: string; productSlug: string; licenseKey: string;
  status: StoredLicenseStatus; currentPeriodEnd: Date | null; activeSites: string[];
}>> {
  const rows = await db.select().from(licenses).where(eq(licenses.userId, userId));
  const out = [];
  for (const r of rows) {
    const sites = await db.select({ siteUrl: licenseActivations.siteUrl })
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, r.id), isNull(licenseActivations.deactivatedAt)));
    out.push({
      id: r.id, productSlug: r.productSlug, licenseKey: r.licenseKey,
      status: r.status as StoredLicenseStatus, currentPeriodEnd: r.currentPeriodEnd,
      activeSites: sites.map((s) => s.siteUrl),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/license-store.test.ts && npm run typecheck`
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add lib/license-server/store.ts tests/license-store.test.ts
git commit -m "feat(licensing): drizzle LicenseStore + getLicensesForUser"
```

---

### Task 5: License API routes

**Files:**
- Create: `app/api/license/activate/route.ts`, `app/api/license/validate/route.ts`, `app/api/license/deactivate/route.ts`
- Test: `tests/license-routes.test.ts`

**Interfaces:**
- Consumes: handlers (Task 3), `dbLicenseStore` (Task 4), `rateLimit` from `@/lib/rate-limit`.
- Produces: HTTP surface the WP license client (Phase 2 plan) will call. Body params are snake_case on the wire: `{ key, site_url, product, plugin_version?, wp_version? }`.

- [ ] **Step 1: Write the failing test** (mirror the mocking style of `tests/capture-route.test.ts` — routes are tested by importing `POST` and passing a `Request`; mock `@/lib/license-server/store` so no DB is touched)

```ts
// tests/license-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRateLimit } from '@/lib/rate-limit';

const findByKey = vi.fn();
const upsertActivation = vi.fn();
const markDeactivated = vi.fn();
vi.mock('@/lib/license-server/store', () => ({
  dbLicenseStore: {
    findByKey: (...a: unknown[]) => findByKey(...a),
    upsertActivation: (...a: unknown[]) => upsertActivation(...a),
    markDeactivated: (...a: unknown[]) => markDeactivated(...a),
    latestRelease: vi.fn(),
  },
}));

import { POST as activate } from '@/app/api/license/activate/route';
import { POST as validate } from '@/app/api/license/validate/route';
import { POST as deactivate } from '@/app/api/license/deactivate/route';

const LICENSE = {
  id: 'lic_1', userId: 'u1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', status: 'active', currentPeriodEnd: null,
};

function req(body: unknown): Request {
  return new Request('http://test.local/api/license/x', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => { vi.clearAllMocks(); __resetRateLimit(); });

describe('POST /api/license/activate', () => {
  it('200s a valid activation', async () => {
    findByKey.mockResolvedValue(LICENSE);
    const res = await activate(req({
      key: LICENSE.licenseKey, site_url: 'https://client.com', product: 'elementor-to-divi5-pro', plugin_version: '1.0.0',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ status: 'active', product: 'elementor-to-divi5-pro' });
    expect(upsertActivation).toHaveBeenCalledOnce();
  });
  it('400s missing fields', async () => {
    const res = await activate(req({ key: 'x' }));
    expect(res.status).toBe(400);
  });
  it('404s unknown key', async () => {
    findByKey.mockResolvedValue(null);
    const res = await activate(req({ key: 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ', site_url: 'a.com', product: 'elementor-to-divi5-pro' }));
    expect(res.status).toBe(404);
  });
  it('429s past the rate limit', async () => {
    findByKey.mockResolvedValue(null);
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await activate(req({ key: 'JHMG-ZZZZ-ZZZZ-ZZZZ-ZZZZ', site_url: 'a.com', product: 'elementor-to-divi5-pro' }));
    }
    expect(last!.status).toBe(429);
  });
});

describe('POST /api/license/validate', () => {
  it('200s and refreshes last seen', async () => {
    findByKey.mockResolvedValue(LICENSE);
    const res = await validate(req({ key: LICENSE.licenseKey, site_url: 'client.com', product: 'elementor-to-divi5-pro' }));
    expect(res.status).toBe(200);
    expect(upsertActivation).toHaveBeenCalledOnce();
  });
});

describe('POST /api/license/deactivate', () => {
  it('200s and marks deactivated', async () => {
    findByKey.mockResolvedValue(LICENSE);
    const res = await deactivate(req({ key: LICENSE.licenseKey, site_url: 'client.com' }));
    expect(res.status).toBe(200);
    expect(markDeactivated).toHaveBeenCalledWith('lic_1', 'client.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/license-routes.test.ts`
Expected: FAIL — routes don't exist.

- [ ] **Step 3: Implement the three routes**

```ts
// app/api/license/activate/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { handleActivate } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  site_url: z.string().min(1).max(500),
  product: z.string().min(1).max(100),
  plugin_version: z.string().max(20).optional(),
  wp_version: z.string().max(20).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`license-activate:${ip}`, { limit: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { key, site_url, product, plugin_version, wp_version } = parsed.data;
  const result = await handleActivate(
    { key, siteUrl: site_url, product, pluginVersion: plugin_version, wpVersion: wp_version },
    dbLicenseStore,
  );
  return NextResponse.json(result.body, { status: result.status });
}
```

```ts
// app/api/license/validate/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { handleValidate } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  site_url: z.string().min(1).max(500),
  product: z.string().min(1).max(100),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`license-validate:${ip}`, { limit: 60, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { key, site_url, product } = parsed.data;
  const result = await handleValidate({ key, siteUrl: site_url, product }, dbLicenseStore);
  return NextResponse.json(result.body, { status: result.status });
}
```

```ts
// app/api/license/deactivate/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { handleDeactivate } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const bodySchema = z.object({
  key: z.string().min(10).max(64),
  site_url: z.string().min(1).max(500),
});

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`license-deactivate:${ip}`, { limit: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { key, site_url } = parsed.data;
  const result = await handleDeactivate({ key, siteUrl: site_url }, dbLicenseStore);
  return NextResponse.json(result.body, { status: result.status });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/license-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/license tests/license-routes.test.ts
git commit -m "feat(licensing): activate/validate/deactivate API routes"
```

---

### Task 6: Checkout — plugin license product

**Files:**
- Modify: `lib/stripe/checkout.ts`
- Modify: `lib/env.ts` (add `STRIPE_PRICE_ELEM2DIVI_PRO`, `STRIPE_PRICE_DIVI2ELEM_PRO`)
- Modify: `.env.example` (document both, under the Stripe block)
- Modify: `app/api/checkout/route.ts`
- Test: `tests/checkout.test.ts` (add cases), `tests/env.test.ts` (only if it enumerates keys — check first)

**Interfaces:**
- Consumes: `PLUGIN_PRODUCTS`, `PluginProduct` from Task 2.
- Produces: `CheckoutInput` gains `{ kind: 'plugin'; product: PluginProduct }`; `CheckoutContext` gains `pluginPriceId?: string`. Session params for plugins carry `metadata: { kind: 'plugin', product }` AND `subscription_data: { metadata: { kind: 'plugin', product } }` — the subscription metadata is what lets the webhook (Task 7) tell plugin subs apart from membership subs.

- [ ] **Step 1: Add failing tests to `tests/checkout.test.ts`**

```ts
// append inside tests/checkout.test.ts (reuse the file's existing ctx fixture style)
import { buildCheckoutSessionParams } from '@/lib/stripe/checkout';

describe('plugin license checkout', () => {
  const ctx = {
    siteUrl: 'https://divi5lab.com',
    pluginPriceId: 'price_pro_yearly',
    automaticTax: true,
  };
  it('builds a subscription session with plugin metadata on session AND subscription', () => {
    const params = buildCheckoutSessionParams(
      { kind: 'plugin', product: 'elementor-to-divi5-pro' }, ctx,
    );
    expect(params.mode).toBe('subscription');
    expect(params.line_items).toEqual([{ price: 'price_pro_yearly', quantity: 1 }]);
    expect(params.metadata).toEqual({ kind: 'plugin', product: 'elementor-to-divi5-pro' });
    expect(params.subscription_data).toEqual({ metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' } });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/checkout.test.ts`
Expected: FAIL — type error / missing branch.

- [ ] **Step 3: Implement in `lib/stripe/checkout.ts`**

Change the input/context types and add the branch (rest of the file unchanged):

```ts
import type { PluginProduct } from '@/lib/license-server/core';

export type CheckoutInput =
  | { kind: 'pack'; packId: string }
  | { kind: 'membership'; plan: 'monthly' | 'yearly' }
  | { kind: 'plugin'; product: PluginProduct };
```

Add to `CheckoutContext`:

```ts
  pluginPriceId?: string;
```

In `buildCheckoutSessionParams`, before the final membership `return`, insert:

```ts
  if (input.kind === 'plugin') {
    return {
      ...common,
      mode: 'subscription',
      line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
      metadata: { kind: 'plugin', product: input.product },
      subscription_data: { metadata: { kind: 'plugin', product: input.product } },
    };
  }
```

- [ ] **Step 4: env + .env.example**

In `lib/env.ts` schema, after `STRIPE_PRICE_MEMBERSHIP_YEARLY`:

```ts
  STRIPE_PRICE_ELEM2DIVI_PRO: z.string().optional(),
  STRIPE_PRICE_DIVI2ELEM_PRO: z.string().optional(),
```

In `.env.example` under the Stripe block:

```
STRIPE_PRICE_ELEM2DIVI_PRO=        # yearly Price id — Elementor→Divi 5 Pro license
STRIPE_PRICE_DIVI2ELEM_PRO=        # yearly Price id — Divi→Elementor Pro license
```

- [ ] **Step 5: Extend `app/api/checkout/route.ts`**

Add to the zod union:

```ts
  z.object({ kind: z.literal('plugin'), product: z.enum(['elementor-to-divi5-pro', 'divi-to-elementor-pro']) }),
```

Add price resolution after the membership branch (make the existing `if/else` an `if / else if (input.kind === 'membership') / else`):

```ts
  let pluginPriceId: string | undefined;
  // ... inside the new else branch (input.kind === 'plugin'):
  pluginPriceId = input.product === 'elementor-to-divi5-pro'
    ? env.STRIPE_PRICE_ELEM2DIVI_PRO
    : env.STRIPE_PRICE_DIVI2ELEM_PRO;
  if (!pluginPriceId) return NextResponse.json({ error: 'plugin_unavailable' }, { status: 400 });
```

And thread it through `makeCtx`:

```ts
  const makeCtx = (automaticTax: boolean): CheckoutContext => ({
    siteUrl: env.NEXT_PUBLIC_SITE_URL, packPriceId, membershipPriceId, pluginPriceId, automaticTax, requireTermsConsent,
  });
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run tests/checkout.test.ts tests/env.test.ts && npm run typecheck`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add lib/stripe/checkout.ts lib/env.ts .env.example app/api/checkout/route.ts tests/checkout.test.ts
git commit -m "feat(licensing): plugin-license checkout (subscription mode, plugin metadata)"
```

---

### Task 7: Fulfillment — mint licenses, follow subscription status, license email

**Files:**
- Modify: `lib/stripe/fulfillment.ts` (interface + event handling)
- Modify: `lib/stripe/fulfillment-store.ts` (db implementations)
- Create: `lib/email/license-email.ts`
- Test: `tests/fulfillment.test.ts` (add cases), `tests/license-email.test.ts`

**Interfaces:**
- Consumes: `generateLicenseKey`, `PRODUCT_TITLES`, `PluginProduct` (Task 2), `licenses` table (Task 1).
- Produces — `FulfillmentStore` gains exactly:
  - `mintLicense(l: { userId: string; productSlug: string; stripeSubscriptionId: string | null; currentPeriodEnd: Date | null }): Promise<{ licenseKey: string }>`
  - `setLicenseStatusBySubscription(s: { stripeSubscriptionId: string; status: 'active' | 'past_due' | 'canceled'; currentPeriodEnd: Date | null }): Promise<void>`
  - `grantPluginEntitlement(userId: string, productSlug: string): Promise<void>` (scope `plugin:<slug>`, source `order`)
  - `notifyLicensePurchase(input: { email: string; productSlug: string; licenseKey: string }): Promise<void>`
- `licenseKeyEmail(input: { productTitle: string; licenseKey: string; signInUrl: string }): { subject: string; html: string; text: string }` from `@/lib/email/license-email`.
- **Critical behavior:** plugin subscriptions are NOT written to the `subscriptions` table and NEVER touch all-access. Branching rule: in `customer.subscription.*` events, `sub.metadata?.kind === 'plugin'` → license path; otherwise the existing membership path, unchanged.

- [ ] **Step 1: Add failing tests to `tests/fulfillment.test.ts`** (extend the file's existing fake-store fixture with the four new methods; add these cases)

```ts
describe('plugin license fulfillment', () => {
  it('checkout.session.completed with kind=plugin mints a license + entitlement, no all-access', async () => {
    const store = makeFakeStore(); // extend the existing helper with the new methods as vi.fn()
    await handleStripeEvent({
      id: 'evt_p1', type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_1', customer: 'cus_1', subscription: 'sub_plugin_1',
        customer_details: { email: 'buyer@x.com' }, amount_total: 4900,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.mintLicense).toHaveBeenCalledWith({
      userId: 'user-1', productSlug: 'elementor-to-divi5-pro',
      stripeSubscriptionId: 'sub_plugin_1', currentPeriodEnd: null,
    });
    expect(store.grantPluginEntitlement).toHaveBeenCalledWith('user-1', 'elementor-to-divi5-pro');
    expect(store.notifyLicensePurchase).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@x.com', productSlug: 'elementor-to-divi5-pro' }),
    );
    expect(store.grantAllAccess).not.toHaveBeenCalled();
    expect(store.upsertSubscription).not.toHaveBeenCalled();
  });

  it('subscription.updated with plugin metadata updates the license, not membership', async () => {
    const store = makeFakeStore();
    await handleStripeEvent({
      id: 'evt_p2', type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'past_due',
        current_period_end: 1780000000,
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_plugin_1', status: 'past_due',
      currentPeriodEnd: new Date(1780000000 * 1000),
    });
    expect(store.grantAllAccess).not.toHaveBeenCalled();
    expect(store.revokeAllAccess).not.toHaveBeenCalled();
    expect(store.upsertSubscription).not.toHaveBeenCalled();
  });

  it('subscription.deleted with plugin metadata cancels the license', async () => {
    const store = makeFakeStore();
    await handleStripeEvent({
      id: 'evt_p3', type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_plugin_1', customer: 'cus_1', status: 'canceled',
        metadata: { kind: 'plugin', product: 'elementor-to-divi5-pro' },
      } },
    } as never, store);
    expect(store.setLicenseStatusBySubscription).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_plugin_1', status: 'canceled', currentPeriodEnd: null,
    });
    expect(store.revokeAllAccess).not.toHaveBeenCalled();
  });

  it('membership subscription events still work exactly as before (no metadata)', async () => {
    const store = makeFakeStore();
    store.findUserBySubscriptionId.mockResolvedValue('user-1');
    await handleStripeEvent({
      id: 'evt_m1', type: 'customer.subscription.updated',
      data: { object: { id: 'sub_m', customer: 'cus_1', status: 'active', current_period_end: 1780000000 } },
    } as never, store);
    expect(store.upsertSubscription).toHaveBeenCalled();
    expect(store.grantAllAccess).toHaveBeenCalled();
    expect(store.setLicenseStatusBySubscription).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/fulfillment.test.ts`
Expected: FAIL — new store methods missing / branches absent.

- [ ] **Step 3: Modify `lib/stripe/fulfillment.ts`**

Add to the `FulfillmentStore` interface (after `notifyPurchase`):

```ts
  mintLicense(l: { userId: string; productSlug: string; stripeSubscriptionId: string | null; currentPeriodEnd: Date | null }): Promise<{ licenseKey: string }>;
  setLicenseStatusBySubscription(s: { stripeSubscriptionId: string; status: 'active' | 'past_due' | 'canceled'; currentPeriodEnd: Date | null }): Promise<void>;
  grantPluginEntitlement(userId: string, productSlug: string): Promise<void>;
  notifyLicensePurchase(input: { email: string; productSlug: string; licenseKey: string }): Promise<void>;
```

In the `checkout.session.completed` case, after the membership branch, add:

```ts
      } else if (meta.kind === 'plugin' && meta.product) {
        const { licenseKey } = await store.mintLicense({
          userId,
          productSlug: meta.product,
          stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : null,
          currentPeriodEnd: null, // set by the first customer.subscription.updated event
        });
        await store.grantPluginEntitlement(userId, meta.product);
        try {
          await store.notifyLicensePurchase({ email, productSlug: meta.product, licenseKey });
        } catch (err) {
          console.error('[webhook] license email failed:', err);
        }
      }
```

(Keep the existing `notifyPurchase` try/catch scoped to pack/membership as it is today.)

At the TOP of both `customer.subscription.created/updated` and `customer.subscription.deleted` cases, before any user resolution, add the plugin branch:

```ts
      const sub = event.data.object as Stripe.Subscription;
      if ((sub.metadata as Record<string, string> | null)?.kind === 'plugin') {
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
        await store.setLicenseStatusBySubscription({
          stripeSubscriptionId: sub.id,
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : mapStatus(sub.status),
          currentPeriodEnd: event.type === 'customer.subscription.deleted' ? null : periodEnd,
        });
        break;
      }
      // ...existing membership logic unchanged below
```

- [ ] **Step 4: License email + db store implementations**

```ts
// lib/email/license-email.ts
// Purchase email for a plugin Pro license: the key, how to use it, account link.
export function licenseKeyEmail(input: { productTitle: string; licenseKey: string; signInUrl: string }): { subject: string; html: string; text: string } {
  const subject = `Your ${input.productTitle} license key`;
  const text = [
    `Thanks for your purchase of ${input.productTitle}!`,
    '',
    `Your license key: ${input.licenseKey}`,
    '',
    'To get started:',
    '1. Sign in to your account and download the Pro plugin zip:',
    `   ${input.signInUrl}`,
    '2. In WordPress: Plugins → Add New → Upload Plugin → install and activate it (keep the free plugin active too).',
    '3. Open the plugin settings, paste your license key, and click Activate.',
    '',
    'Your license covers unlimited sites and renews yearly. Manage it anytime from your account.',
  ].join('\n');
  const html = text
    .split('\n')
    .map((l) => (l ? `<p style="margin:0 0 8px">${l.replace(input.licenseKey, `<strong>${input.licenseKey}</strong>`)}</p>` : '<br/>'))
    .join('');
  return { subject, html, text };
}
```

```ts
// tests/license-email.test.ts
import { describe, it, expect } from 'vitest';
import { licenseKeyEmail } from '@/lib/email/license-email';

describe('licenseKeyEmail', () => {
  it('includes product title, key and sign-in url in text and html', () => {
    const { subject, html, text } = licenseKeyEmail({
      productTitle: 'JHMG Converter For Elementor to Divi 5 — Pro',
      licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD',
      signInUrl: 'https://divi5lab.com/login?x=1',
    });
    expect(subject).toContain('license key');
    for (const out of [html, text]) {
      expect(out).toContain('JHMG-AAAA-BBBB-CCCC-DDDD');
      expect(out).toContain('https://divi5lab.com/login?x=1');
    }
  });
});
```

In `lib/stripe/fulfillment-store.ts`, add imports and the four implementations inside `dbStore`:

```ts
import { licenses } from '@/db/schema'; // add to the existing schema import list
import { generateLicenseKey, PRODUCT_TITLES, type PluginProduct } from '@/lib/license-server/core';
import { licenseKeyEmail } from '@/lib/email/license-email';
```

```ts
  async mintLicense(l) {
    const licenseKey = generateLicenseKey();
    await db.insert(licenses).values({
      id: randomUUID(), userId: l.userId, productSlug: l.productSlug,
      licenseKey, status: 'active',
      stripeSubscriptionId: l.stripeSubscriptionId, currentPeriodEnd: l.currentPeriodEnd,
    }).onConflictDoNothing({ target: licenses.stripeSubscriptionId });
    // Idempotency: if this subscription already minted a key (webhook retry),
    // return the existing one instead of a dangling fresh key.
    if (l.stripeSubscriptionId) {
      const rows = await db.select({ licenseKey: licenses.licenseKey }).from(licenses)
        .where(eq(licenses.stripeSubscriptionId, l.stripeSubscriptionId)).limit(1);
      if (rows[0]) return { licenseKey: rows[0].licenseKey };
    }
    return { licenseKey };
  },
  async setLicenseStatusBySubscription(s) {
    await db.update(licenses)
      .set({ status: s.status === 'canceled' ? 'canceled' : s.status, ...(s.currentPeriodEnd ? { currentPeriodEnd: s.currentPeriodEnd } : {}) })
      .where(eq(licenses.stripeSubscriptionId, s.stripeSubscriptionId));
  },
  async grantPluginEntitlement(userId, productSlug) {
    await db.insert(entitlements).values({
      id: randomUUID(), userId, scope: `plugin:${productSlug}`, source: 'order',
    }).onConflictDoNothing();
  },
  async notifyLicensePurchase(input) {
    const signInUrl = await createMagicSignInUrl(input.email, '/account/licenses', signInUrlDeps);
    const title = PRODUCT_TITLES[input.productSlug as PluginProduct] ?? input.productSlug;
    const { subject, html, text } = licenseKeyEmail({ productTitle: title, licenseKey: input.licenseKey, signInUrl });
    const { sent } = await sendEmail({ to: input.email, subject, html, text });
    if (!sent) console.log(`[license:dev] key for ${input.email}: ${input.licenseKey}\n${signInUrl}`);
  },
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/fulfillment.test.ts tests/license-email.test.ts tests/webhook-route.test.ts && npm run typecheck`
Expected: PASS (webhook-route tests may need their fake store extended with the 4 new methods — do that, don't weaken assertions).

- [ ] **Step 6: Commit**

```bash
git add lib/stripe/fulfillment.ts lib/stripe/fulfillment-store.ts lib/email/license-email.ts tests/fulfillment.test.ts tests/license-email.test.ts tests/webhook-route.test.ts
git commit -m "feat(licensing): webhook mints licenses, plugin subs tracked on license rows, key email"
```

---

### Task 8: Update-check + Pro download routes

**Files:**
- Create: `app/api/plugin/update-check/route.ts`, `app/api/plugin/download/route.ts`
- Test: `tests/plugin-update-routes.test.ts`

**Interfaces:**
- Consumes: `handleUpdateCheck` (Task 3), `dbLicenseStore` (Task 4), `fetchAsset` from `@/lib/blob`, `isLicenseUsable` (Task 2), `env.NEXT_PUBLIC_SITE_URL`.
- Produces: the two GET endpoints the WP client + WP update system will hit. Query params: update-check `?product=&version=&key=` (key optional); download `?product=&key=` (key required).

- [ ] **Step 1: Write the failing test**

```ts
// tests/plugin-update-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRateLimit } from '@/lib/rate-limit';

const findByKey = vi.fn();
const latestRelease = vi.fn();
vi.mock('@/lib/license-server/store', () => ({
  dbLicenseStore: {
    findByKey: (...a: unknown[]) => findByKey(...a),
    latestRelease: (...a: unknown[]) => latestRelease(...a),
    upsertActivation: vi.fn(),
    markDeactivated: vi.fn(),
  },
}));
const fetchAsset = vi.fn();
vi.mock('@/lib/blob', () => ({ fetchAsset: (...a: unknown[]) => fetchAsset(...a) }));

import { GET as updateCheck } from '@/app/api/plugin/update-check/route';
import { GET as download } from '@/app/api/plugin/download/route';

const KEY = 'JHMG-AAAA-BBBB-CCCC-DDDD';
const LICENSE = {
  id: 'lic_1', userId: 'u1', productSlug: 'elementor-to-divi5-pro',
  licenseKey: KEY, status: 'active', currentPeriodEnd: null,
};
const RELEASE = { version: '1.2.0', blobKey: 'plugins/elementor-to-divi5-pro/elementor-to-divi5-pro-1.2.0.zip', changelog: 'Fixes' };

beforeEach(() => { vi.clearAllMocks(); __resetRateLimit(); });

describe('GET /api/plugin/update-check', () => {
  it('returns update+package for a licensed older install', async () => {
    findByKey.mockResolvedValue(LICENSE);
    latestRelease.mockResolvedValue(RELEASE);
    const res = await updateCheck(new Request(
      `http://t.local/api/plugin/update-check?product=elementor-to-divi5-pro&version=1.0.0&key=${KEY}`,
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.update).toBe(true);
    expect(json.version).toBe('1.2.0');
    expect(String(json.package)).toContain('/api/plugin/download?product=elementor-to-divi5-pro&key=');
  });
  it('400s missing params', async () => {
    const res = await updateCheck(new Request('http://t.local/api/plugin/update-check?product=x'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/plugin/download', () => {
  it('streams the zip for a usable license', async () => {
    findByKey.mockResolvedValue(LICENSE);
    latestRelease.mockResolvedValue(RELEASE);
    fetchAsset.mockResolvedValue(Buffer.from('PKzipbytes'));
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('elementor-to-divi5-pro-1.2.0.zip');
    expect(fetchAsset).toHaveBeenCalledWith(RELEASE.blobKey);
  });
  it('403s an unusable license', async () => {
    findByKey.mockResolvedValue({ ...LICENSE, status: 'canceled' });
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(403);
  });
  it('404s an unknown key or missing release/asset', async () => {
    findByKey.mockResolvedValue(null);
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(404);
  });
  it('403s a product mismatch (key for the other plugin)', async () => {
    findByKey.mockResolvedValue({ ...LICENSE, productSlug: 'divi-to-elementor-pro' });
    const res = await download(new Request(
      `http://t.local/api/plugin/download?product=elementor-to-divi5-pro&key=${KEY}`,
    ));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/plugin-update-routes.test.ts`
Expected: FAIL — routes don't exist.

- [ ] **Step 3: Implement**

```ts
// app/api/plugin/update-check/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { handleUpdateCheck } from '@/lib/license-server/handlers';
import { dbLicenseStore } from '@/lib/license-server/store';

const querySchema = z.object({
  product: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  key: z.string().max(64).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`plugin-update-check:${ip}`, { limit: 60, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    product: url.searchParams.get('product') ?? undefined,
    version: url.searchParams.get('version') ?? undefined,
    key: url.searchParams.get('key') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const result = await handleUpdateCheck(parsed.data, dbLicenseStore, env.NEXT_PUBLIC_SITE_URL);
  return NextResponse.json(result.body, { status: result.status });
}
```

```ts
// app/api/plugin/download/route.ts
// Key-authenticated Pro zip download: used by the WP updater's `package` URL
// and by the "Download Pro" button on /account/licenses.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { fetchAsset } from '@/lib/blob';
import { isLicenseUsable } from '@/lib/license-server/core';
import { dbLicenseStore } from '@/lib/license-server/store';

const querySchema = z.object({
  product: z.string().min(1).max(100),
  key: z.string().min(10).max(64),
});

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`plugin-download:${ip}`, { limit: 20, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    product: url.searchParams.get('product') ?? undefined,
    key: url.searchParams.get('key') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { product, key } = parsed.data;

  const license = await dbLicenseStore.findByKey(key);
  if (!license) return NextResponse.json({ error: 'invalid_key' }, { status: 404 });
  if (license.productSlug !== product) return NextResponse.json({ error: 'product_mismatch' }, { status: 403 });
  if (!isLicenseUsable(license, new Date())) {
    return NextResponse.json({ error: 'license_not_usable' }, { status: 403 });
  }

  const release = await dbLicenseStore.latestRelease(product);
  if (!release) return NextResponse.json({ error: 'no_release' }, { status: 404 });
  const bytes = await fetchAsset(release.blobKey);
  if (!bytes) return NextResponse.json({ error: 'asset_missing' }, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${product}-${release.version}.zip"`,
      'cache-control': 'private, no-store',
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/plugin-update-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/plugin tests/plugin-update-routes.test.ts
git commit -m "feat(licensing): update-check + key-authenticated Pro zip download routes"
```

---

### Task 9: Release publish script + Stripe product setup script

**Files:**
- Create: `scripts/release-plugin.ts`
- Create: `scripts/stripe-plugin-products.ts`
- Test: `tests/release-plugin.test.ts`

**Interfaces:**
- Consumes: `uploadAsset` from `@/lib/blob`, `pluginReleases` table, JSZip (already a dependency), `stripe` client from `@/lib/stripe/client`, `PLUGIN_PRODUCTS`/`PRODUCT_TITLES`.
- Produces (exported for tests): `blobKeyFor(product: string, version: string): string`; `buildZipFromDir(dir: string): Promise<Buffer>` (recursive, stable paths relative to the dir's parent so the zip root is the plugin folder); CLI `npx tsx scripts/release-plugin.ts --product <slug> --version <x.y.z> --dir <path-to-plugin-folder> --changelog "<text>"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/release-plugin.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import JSZip from 'jszip';
import { blobKeyFor, buildZipFromDir } from '../scripts/release-plugin';

describe('blobKeyFor', () => {
  it('namespaces zips by product and version', () => {
    expect(blobKeyFor('elementor-to-divi5-pro', '1.2.0'))
      .toBe('plugins/elementor-to-divi5-pro/elementor-to-divi5-pro-1.2.0.zip');
  });
});

describe('buildZipFromDir', () => {
  it('zips the plugin folder recursively with the folder as zip root', async () => {
    const base = mkdtempSync(join(tmpdir(), 'relplug-'));
    const plugin = join(base, 'my-pro-plugin');
    mkdirSync(join(plugin, 'includes'), { recursive: true });
    writeFileSync(join(plugin, 'my-pro-plugin.php'), '<?php // main');
    writeFileSync(join(plugin, 'includes', 'class-x.php'), '<?php // x');
    const buf = await buildZipFromDir(plugin);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).sort();
    expect(names).toContain(`${basename(plugin)}/my-pro-plugin.php`);
    expect(names).toContain(`${basename(plugin)}/includes/class-x.php`);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/release-plugin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/release-plugin.ts`**

```ts
// scripts/release-plugin.ts
// Publish a Pro plugin release: zip the plugin dir, upload to Blob, insert a
// plugin_releases row. Shipping an update never requires a site deploy.
// Usage: npx tsx scripts/release-plugin.ts --product elementor-to-divi5-pro --version 1.0.0 --dir ../jhmg-elementor-to-divi5/plugin/jhmg-converter-elementor-to-divi5-pro --changelog "Initial Pro release"
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import JSZip from 'jszip';

export function blobKeyFor(product: string, version: string): string {
  return `plugins/${product}/${product}-${version}.zip`;
}

export async function buildZipFromDir(dir: string): Promise<Buffer> {
  const zip = new JSZip();
  const root = basename(dir);
  const walk = (abs: string, rel: string) => {
    for (const entry of readdirSync(abs)) {
      const absPath = join(abs, entry);
      const relPath = `${rel}/${entry}`;
      if (statSync(absPath).isDirectory()) walk(absPath, relPath);
      else zip.file(relPath, readFileSync(absPath));
    }
  };
  walk(dir, root);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const [{ PLUGIN_PRODUCTS }, { uploadAsset }, { db }, { pluginReleases }] = await Promise.all([
    import('@/lib/license-server/core'), import('@/lib/blob'), import('@/db/client'), import('@/db/schema'),
  ]);
  const product = arg('product'); const version = arg('version');
  const dir = arg('dir'); const changelog = arg('changelog') ?? '';
  if (!product || !version || !dir) {
    console.error('Usage: --product <slug> --version <x.y.z> --dir <plugin-folder> [--changelog "..."]');
    process.exit(1);
  }
  if (!(PLUGIN_PRODUCTS as readonly string[]).includes(product)) {
    console.error(`Unknown product ${product}. Expected one of: ${PLUGIN_PRODUCTS.join(', ')}`);
    process.exit(1);
  }
  const buf = await buildZipFromDir(dir);
  const key = blobKeyFor(product, version);
  await uploadAsset(key, buf, 'application/zip');
  await db.insert(pluginReleases).values({
    id: randomUUID(), productSlug: product, version, blobKey: key, changelog,
  });
  console.log(`Released ${product} ${version} -> ${key} (${(buf.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1]?.endsWith('release-plugin.ts')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

(If `tests/sync-to-prod.test.ts` shows this repo's established script-import pattern differs — e.g. relative imports instead of `@/` in scripts — match that pattern instead; check how other `scripts/*.ts` import `@/db/client` and copy it.)

- [ ] **Step 4: Implement `scripts/stripe-plugin-products.ts`** (imperative, no unit test — pattern-match `scripts/stripe-setup.ts` for env loading; verified manually in Task 11)

```ts
// scripts/stripe-plugin-products.ts
// One-time: create the two Pro plugin Products + yearly Prices in Stripe and
// print the env lines to paste into .env / Vercel. Idempotent by lookup on
// product metadata.slug. Run with: npx tsx scripts/stripe-plugin-products.ts
import Stripe from 'stripe';

const PRODUCTS = [
  { slug: 'elementor-to-divi5-pro', name: 'JHMG Converter For Elementor to Divi 5 — Pro', envVar: 'STRIPE_PRICE_ELEM2DIVI_PRO' },
  { slug: 'divi-to-elementor-pro', name: 'JHMG Converter For Divi to Elementor — Pro', envVar: 'STRIPE_PRICE_DIVI2ELEM_PRO' },
] as const;

const YEARLY_USD_CENTS = 4900; // $49/yr — placeholder price per spec; change here before running.

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
  const stripe = new Stripe(secret);
  for (const p of PRODUCTS) {
    const existing = await stripe.products.search({ query: `metadata['slug']:'${p.slug}'` });
    let product = existing.data[0];
    if (!product) {
      product = await stripe.products.create({
        name: p.name,
        metadata: { slug: p.slug },
        description: 'Annual license — unlimited sites, updates and support while active.',
      });
    }
    const prices = await stripe.prices.list({ product: product.id, active: true });
    let price = prices.data.find((x) => x.recurring?.interval === 'year');
    if (!price) {
      price = await stripe.prices.create({
        product: product.id, currency: 'usd', unit_amount: YEARLY_USD_CENTS,
        recurring: { interval: 'year' },
      });
    }
    console.log(`${p.envVar}=${price.id}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/release-plugin.test.ts && npm run typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/release-plugin.ts scripts/stripe-plugin-products.ts tests/release-plugin.test.ts
git commit -m "feat(licensing): plugin release publisher + Stripe product setup scripts"
```

---

### Task 10: Account licenses page + nav

**Files:**
- Create: `app/(account)/account/licenses/page.tsx`
- Modify: `components/account/AccountNav.tsx` (add tab)
- Test: `tests/account-licenses-page.test.tsx`, update `tests/account-nav.test.tsx` expectations if it asserts the tab list

**Interfaces:**
- Consumes: `requireUser` from `@/lib/auth/admin`, `getUserIdByEmail` from `@/lib/account/queries`, `getLicensesForUser` from Task 4, `PRODUCT_TITLES` from Task 2, UI primitives `Container`/`Card`, `AccountNav`.
- Produces: `/account/licenses` page.

- [ ] **Step 1: Write the failing test** (mirror the mocking style used by existing page tests, e.g. `tests/emails-tables.test.tsx` / account page tests — mock auth + queries, render the RSC by awaiting it)

```tsx
// tests/account-licenses-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth/admin', () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { email: 'buyer@x.com' } }),
}));
vi.mock('@/lib/account/queries', () => ({
  getUserIdByEmail: vi.fn().mockResolvedValue('u1'),
}));
vi.mock('@/lib/license-server/store', () => ({
  getLicensesForUser: vi.fn().mockResolvedValue([{
    id: 'lic_1', productSlug: 'elementor-to-divi5-pro',
    licenseKey: 'JHMG-AAAA-BBBB-CCCC-DDDD', status: 'active',
    currentPeriodEnd: new Date('2027-07-11T00:00:00Z'),
    activeSites: ['client-site.com'],
  }]),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/licenses' }));

import LicensesPage from '@/app/(account)/account/licenses/page';

describe('/account/licenses', () => {
  it('lists the license with key, product, status, sites and a download link', async () => {
    render(await LicensesPage());
    expect(screen.getByText('JHMG-AAAA-BBBB-CCCC-DDDD')).toBeTruthy();
    expect(screen.getByText(/Elementor to Divi 5/)).toBeTruthy();
    expect(screen.getByText(/client-site\.com/)).toBeTruthy();
    const dl = screen.getByRole('link', { name: /download pro/i }) as HTMLAnchorElement;
    expect(dl.href).toContain('/api/plugin/download?product=elementor-to-divi5-pro&key=JHMG-AAAA-BBBB-CCCC-DDDD');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/account-licenses-page.test.tsx`
Expected: FAIL — page module missing.

- [ ] **Step 3: Implement the page** (mirrors `app/(account)/account/downloads/page.tsx` structure and styling)

```tsx
// app/(account)/account/licenses/page.tsx
import Link from 'next/link';
import { requireUser } from '@/lib/auth/admin';
import { getUserIdByEmail } from '@/lib/account/queries';
import { getLicensesForUser } from '@/lib/license-server/store';
import { PRODUCT_TITLES, type PluginProduct } from '@/lib/license-server/core';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { AccountNav } from '@/components/account/AccountNav';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', past_due: 'Payment issue — update billing',
  expired: 'Expired', canceled: 'Canceled',
};

export default async function LicensesPage() {
  const session = await requireUser();
  const email = session.user?.email ?? '';
  const userId = email ? await getUserIdByEmail(email) : null;
  const licenses = userId ? await getLicensesForUser(userId) : [];

  return (
    <main className="py-12">
      <Container>
        <AccountNav />
        <h1 className="text-h2 text-navy">Your plugin licenses</h1>
        <p className="mt-2 text-body text-muted">License keys, activated sites, and Pro plugin downloads.</p>
        {licenses.length === 0 ? (
          <div className="mt-8 rounded-card border border-border bg-mist p-10 text-center">
            <p className="text-body text-navy">No licenses yet.</p>
            <p className="mt-1 text-small text-muted">Buy a Pro plugin and your license key will show up here.</p>
            <Link href="/pricing" className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
              See plugin pricing
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {licenses.map((l) => (
              <li key={l.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-body font-semibold text-navy">
                        {PRODUCT_TITLES[l.productSlug as PluginProduct] ?? l.productSlug}
                      </div>
                      <code className="mt-1 block text-small text-muted">{l.licenseKey}</code>
                      <div className="mt-1 text-small text-muted">
                        {STATUS_LABEL[l.status] ?? l.status}
                        {l.currentPeriodEnd ? ` · renews ${l.currentPeriodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
                      </div>
                      {l.activeSites.length > 0 && (
                        <div className="mt-1 text-small text-muted">Sites: {l.activeSites.join(', ')}</div>
                      )}
                    </div>
                    <a
                      href={`/api/plugin/download?product=${encodeURIComponent(l.productSlug)}&key=${encodeURIComponent(l.licenseKey)}`}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110"
                    >
                      Download Pro
                    </a>
                  </div>
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

- [ ] **Step 4: Add the nav tab**

In `components/account/AccountNav.tsx`, change `TABS` to:

```ts
const TABS = [
  { href: '/account', label: 'Overview', icon: 'dashboard' },
  { href: '/account/licenses', label: 'Licenses', icon: 'key' },
  { href: '/account/downloads', label: 'Downloads', icon: 'download' },
  { href: '/account/purchases', label: 'Purchases', icon: 'receipt_long' },
  { href: '/account/billing', label: 'Billing', icon: 'credit_card' },
];
```

Update `tests/account-nav.test.tsx` if it asserts the tab list (add the Licenses entry to its expectations — don't delete existing assertions).

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/account-licenses-page.test.tsx tests/account-nav.test.tsx && npm run typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add "app/(account)/account/licenses" components/account/AccountNav.tsx tests/account-licenses-page.test.tsx tests/account-nav.test.tsx
git commit -m "feat(licensing): /account/licenses page + account nav tab"
```

---

### Task 11: Full-suite verification + manual end-to-end (Stripe test mode)

**Files:**
- No new files (fixes only, if the suite surfaces regressions).

- [ ] **Step 1: Full suite**

Run: `npm run test` and `npm run typecheck` and `npm run lint`
Expected: everything green (was 797+ tests before this plan; all prior tests must still pass).

- [ ] **Step 2: Manual e2e in Stripe TEST mode (local dev server)**

1. Ensure `.env.local` has TEST-mode `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, then run `npx tsx scripts/stripe-plugin-products.ts` against test mode and put the printed `STRIPE_PRICE_ELEM2DIVI_PRO=` line into `.env.local`.
2. Publish a dummy release: create a folder with one PHP file and run `npx tsx scripts/release-plugin.ts --product elementor-to-divi5-pro --version 0.0.1 --dir <folder> --changelog "test"`.
3. `npm run dev` + `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. `curl -s localhost:3000/api/checkout -X POST -H 'content-type: application/json' -d '{"kind":"plugin","product":"elementor-to-divi5-pro"}'` → open the returned URL, pay with `4242 4242 4242 4242`.
5. Verify: license row minted (key in the dev-mode console log or DB), entitlement `plugin:elementor-to-divi5-pro` granted.
6. `curl -s localhost:3000/api/license/activate -X POST -H 'content-type: application/json' -d '{"key":"<KEY>","site_url":"https://demo-site.test","product":"elementor-to-divi5-pro"}'` → `{"status":"active",...}`.
7. `curl -s "localhost:3000/api/plugin/update-check?product=elementor-to-divi5-pro&version=0.0.0&key=<KEY>"` → `update:true` with `package` URL; fetch the package URL → zip bytes.
8. Sign in as the buyer → `/account/licenses` shows the key, site, and Download Pro works.

Expected: every step's actual output shown (verification-before-completion), no step asserted without evidence.

- [ ] **Step 3: Commit any fixes; then merge/hand off**

```bash
git add -A && git commit -m "test(licensing): full-suite fixes after licensing backend"
```

---

## Out of scope for this plan (next plans)

- **Phase 2 plan:** `jhmg-elementor-to-divi5` repo — extract Pro companion plugin, `JHMG_License_Client` PHP class (canonical copy will live in THIS repo at `lib/license-server/php-client/class-jhmg-license-client.php` + sync script), free 2.1.0 wp.org release.
- **Phase 3 plan:** site marketing rework (homepage, /plugins pages, pricing, docs, marketplace demotion, waitlist).
- **Phase 4/5 plans:** Divi→Elementor split + wp.org submission; AI Editor waitlist page.

# AI Editor for Divi 5 Product (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sell the AI Editor for Divi 5 plugin from divi5lab.com — $79/yr Pro license via the existing license server, free tier behind email capture, sticky feature-unlock that only revocation re-locks.

**Architecture:** Two repos. SITE (layoutlab) gains a `revoked` license status, the `ai-editor-divi5-pro` product wiring, promo-code support, a free-download route, a sales page, and setup guides. VAL_REPO (the validator repo's `wp-plugin/`) swaps its offline Ed25519 `Licensing` for an adapter over the canonical synced `LicenseClient`, keeping the existing `Licensing::isPremium()` call sites untouched.

**Tech Stack:** Next.js App Router + Drizzle + Stripe + Vitest (SITE); PHP 8.1 + PHPUnit with WP shims (VAL_REPO).

## Global Constraints

- SITE repo: `/Users/Lucas/Documents/JHMG-Local/layoutlab`. Work in a worktree branch `worktree-phase5-site` (superpowers:using-git-worktrees).
- VAL_REPO: `/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator`. Work on a new branch `feat/divi5lab-licensing` created from its current default branch. Quote the path — it contains spaces.
- Product slug (Stripe metadata.slug, license productSlug, release productSlug, checkout `product`): **`ai-editor-divi5-pro`**.
- Product title everywhere: **`AI Editor for Divi 5 — Pro`**.
- Price: **$79/yr** = `7900` cents, env var **`STRIPE_PRICE_AI_EDITOR_PRO`**.
- Plugin option prefix: **`aied`** (client options `aied_license_key`, `aied_license_state`, `aied_update_blocked`); sticky-unlock option **`ai_editor_divi5_premium_unlocked`**.
- Plugin version bumps to **3.0.0**. Upgrade/product URL: **`https://divi5lab.com/plugins/divi-5-ai-editor`**.
- Frozen license API wire contract: error codes `invalid_key | product_mismatch | license_not_usable | rate_limited | invalid_request` and snake_case params must NOT change. Adding the `revoked` status *value* is additive and allowed.
- Enforcement semantics (approved spec): activation sets a persistent unlock; only an explicit server verdict of `revoked` or `invalid` (invalid_key) re-locks premium; `expired`/`canceled`/`past_due`/429/5xx/offline never re-lock.
- SITE verification: `npm run test` + `npm run typecheck`. VAL_REPO verification: `make test` (runs PHPUnit).
- Commit after every task in the repo the task touched. Ledger: `.superpowers/sdd/progress.md` in each repo.

---

## Part A — SITE (layoutlab)

### Task 1: `revoked` license status

**Files:**
- Modify: `lib/license-server/core.ts:41` (StoredLicenseStatus)
- Modify: `db/schema.ts:14` (licenseStatus pgEnum)
- Create: `db/migrations/` (via `npm run db:generate`)
- Test: `tests/license-core.test.ts`, `tests/license-handlers.test.ts`

**Interfaces:**
- Consumes: existing `effectiveStatus`, `isLicenseUsable`, `handleValidate` (unchanged signatures).
- Produces: `StoredLicenseStatus` union now includes `'revoked'`. `effectiveStatus` returns `'revoked'` unchanged (terminal — never downgraded/upgraded); `isLicenseUsable` returns false for it; `handleValidate`/`handleActivate` answer `403 { error: 'license_not_usable', status: 'revoked' }`.

- [ ] **Step 1: Write the failing tests**

In `tests/license-core.test.ts` (append to the existing describe blocks, matching the file's existing style):

```ts
it('effectiveStatus keeps revoked terminal even with a future period end', () => {
  const now = new Date('2026-07-12T00:00:00Z');
  expect(effectiveStatus({ status: 'revoked', currentPeriodEnd: new Date('2027-01-01') }, now)).toBe('revoked');
  expect(effectiveStatus({ status: 'revoked', currentPeriodEnd: null }, now)).toBe('revoked');
});

it('isLicenseUsable is false for revoked', () => {
  const now = new Date('2026-07-12T00:00:00Z');
  expect(isLicenseUsable({ status: 'revoked', currentPeriodEnd: new Date('2027-01-01') }, now)).toBe(false);
});
```

In `tests/license-handlers.test.ts` (use the file's existing in-memory store helper; follow its established pattern for seeding a license):

```ts
it('validate answers license_not_usable with status revoked', async () => {
  const store = makeStore([license({ licenseKey: 'JHMG-REVO-KEDX-XXXX-XXXX', status: 'revoked' })]);
  const res = await handleValidate(
    { key: 'JHMG-REVO-KEDX-XXXX-XXXX', siteUrl: 'https://example.com', product: license().productSlug },
    store,
  );
  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: 'license_not_usable', status: 'revoked' });
});
```

(`makeStore` / `license` = whatever fixture helpers the file already defines; adapt names to match, keep the assertions exactly.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/license-core.test.ts tests/license-handlers.test.ts`
Expected: FAIL — TS error `'"revoked"' is not assignable to type 'StoredLicenseStatus'`.

- [ ] **Step 3: Implement**

`lib/license-server/core.ts:41`:

```ts
export type StoredLicenseStatus = 'active' | 'past_due' | 'expired' | 'canceled' | 'revoked';
```

No change needed to `effectiveStatus` (its default branch returns the status as-is) or `isLicenseUsable` (only `active`/`past_due` are usable). Add one comment above `effectiveStatus`:

```ts
// 'revoked' is terminal (refund/chargeback/manual): set only by ops, never by
// Stripe status mapping, and never clears on its own.
```

`db/schema.ts:14`:

```ts
export const licenseStatus = pgEnum('license_status', ['active', 'past_due', 'expired', 'canceled', 'revoked']);
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: a new migration in `db/migrations/` containing `ALTER TYPE "public"."license_status" ADD VALUE 'revoked';`. Apply locally with `npm run db:migrate`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/license-core.test.ts tests/license-handlers.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/license-server/core.ts db/schema.ts db/migrations tests/license-core.test.ts tests/license-handlers.test.ts
git commit -m "feat(licensing): add terminal 'revoked' license status"
```

### Task 2: `scripts/revoke-license.ts`

**Files:**
- Create: `scripts/revoke-license.ts`

**Interfaces:**
- Consumes: `db` from `@/db/client`, `licenses` from `@/db/schema`.
- Produces: CLI `npx tsx scripts/revoke-license.ts --key JHMG-... [--restore <status>]`. Ops-only; used at refund/chargeback time (checkout is all-sales-final, so this is rare and manual — deliberately no webhook automation).

- [ ] **Step 1: Write the script** (pattern-match `scripts/mint-dev-license.ts` — same env bootstrapping and DB-host echo; scripts in this repo are not unit-tested):

```ts
// Revoke (or restore) a plugin license. Revocation is the ONLY thing that
// re-locks the AI Editor's premium features on customer sites (see the plugin's
// sticky-unlock semantics); converters are soft-enforced and unaffected.
// Usage: npx tsx scripts/revoke-license.ts --key JHMG-XXXX-XXXX-XXXX-XXXX
//        npx tsx scripts/revoke-license.ts --key JHMG-... --restore canceled
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { licenses } from '@/db/schema';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const key = arg('key');
  const restore = arg('restore'); // e.g. 'canceled' to undo a mistaken revoke
  if (!key) { console.error('Usage: --key JHMG-... [--restore <status>]'); process.exit(1); }
  const status = (restore ?? 'revoked') as typeof licenses.$inferSelect.status;
  const rows = await db.update(licenses).set({ status }).where(eq(licenses.licenseKey, key)).returning();
  if (rows.length === 0) { console.error(`No license found for key ${key}`); process.exit(1); }
  console.log(`License ${rows[0]!.id} (${rows[0]!.productSlug}) -> ${status}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
```

Before writing, open `scripts/mint-dev-license.ts` and copy its exact import/env conventions (it echoes the DB host — replicate that line too if present).

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS. Then a live smoke against the LOCAL db: mint a dev license (`npx tsx scripts/mint-dev-license.ts` per its usage), revoke it, `--restore active`, confirm each prints the transition.

- [ ] **Step 3: Commit**

```bash
git add scripts/revoke-license.ts
git commit -m "feat(licensing): revoke-license ops script"
```

### Task 3: register the `ai-editor-divi5-pro` product

**Files:**
- Modify: `lib/license-server/core.ts:5-11` (PLUGIN_PRODUCTS, PRODUCT_TITLES)
- Modify: `lib/env.ts` (~line 16, after STRIPE_PRICE_DIVI2ELEM_PRO)
- Modify: `app/api/checkout/route.ts:13-31`
- Test: `tests/checkout.test.ts`

**Interfaces:**
- Consumes: `CheckoutInput { kind: 'plugin'; product: PluginProduct }` (type widens automatically via PLUGIN_PRODUCTS).
- Produces: `PluginProduct` includes `'ai-editor-divi5-pro'`; `PRODUCT_TITLES['ai-editor-divi5-pro'] === 'AI Editor for Divi 5 — Pro'`; checkout accepts the new product and reads `env.STRIPE_PRICE_AI_EDITOR_PRO`. `/account/licenses` and the license-purchase email pick the title up via PRODUCT_TITLES with no further change.

- [ ] **Step 1: Write the failing tests** (in `tests/checkout.test.ts`, following its existing mocking pattern for `stripe` and `env`):

```ts
it('accepts kind=plugin product=ai-editor-divi5-pro and uses STRIPE_PRICE_AI_EDITOR_PRO', async () => {
  // arrange env mock: STRIPE_PRICE_AI_EDITOR_PRO = 'price_aied_test'
  // act: POST { kind: 'plugin', product: 'ai-editor-divi5-pro' }
  // assert: stripe.checkout.sessions.create called with line_items[0].price === 'price_aied_test'
});

it('returns plugin_unavailable when STRIPE_PRICE_AI_EDITOR_PRO is unset', async () => {
  // env mock without the var; POST same body; expect 400 { error: 'plugin_unavailable' }
});
```

Write these as real tests using the file's existing helpers (it already has equivalents for the converter products — clone the nearest existing test pair and change product + env var).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/checkout.test.ts`
Expected: FAIL — zod rejects the unknown product (`invalid_request`).

- [ ] **Step 3: Implement**

`lib/license-server/core.ts`:

```ts
export const PLUGIN_PRODUCTS = ['elementor-to-divi5-pro', 'divi-to-elementor-pro', 'ai-editor-divi5-pro'] as const;

export const PRODUCT_TITLES: Record<PluginProduct, string> = {
  'elementor-to-divi5-pro': 'JHMG Converter For Elementor to Divi 5 — Pro',
  'divi-to-elementor-pro': 'JHMG Converter For Divi to Elementor — Pro',
  'ai-editor-divi5-pro': 'AI Editor for Divi 5 — Pro',
};
```

`lib/env.ts` — add alongside the other price vars:

```ts
STRIPE_PRICE_AI_EDITOR_PRO: z.string().optional(),
```

`app/api/checkout/route.ts` — replace the enum + ternary (lines 13-31) with a map so the next product is a one-liner:

```ts
import { PLUGIN_PRODUCTS, type PluginProduct } from '@/lib/license-server/core';

const bodySchema = z.object({
  kind: z.literal('plugin'),
  product: z.enum(PLUGIN_PRODUCTS),
});

const PRICE_ENV: Record<PluginProduct, string | undefined> = {
  'elementor-to-divi5-pro': env.STRIPE_PRICE_ELEM2DIVI_PRO,
  'divi-to-elementor-pro': env.STRIPE_PRICE_DIVI2ELEM_PRO,
  'ai-editor-divi5-pro': env.STRIPE_PRICE_AI_EDITOR_PRO,
};
```

and in the handler: `const pluginPriceId = PRICE_ENV[input.product];` (note: `PRICE_ENV` must be built inside the handler or as a function if `env` is validated lazily — check how the route currently reads `env` at line 29 and keep the same evaluation timing).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/checkout.test.ts tests/license-core.test.ts && npm run typecheck`
Expected: PASS (including untouched converter checkout tests).

- [ ] **Step 5: Commit**

```bash
git add lib/license-server/core.ts lib/env.ts app/api/checkout/route.ts tests/checkout.test.ts
git commit -m "feat(commerce): register ai-editor-divi5-pro product ($79/yr)"
```

### Task 4: promotion codes on plugin checkout

**Files:**
- Modify: `lib/stripe/checkout.ts:67-75` (plugin branch)
- Test: `tests/checkout.test.ts` (or wherever `buildCheckoutSessionParams` unit tests live — grep `buildCheckoutSessionParams` in tests/)

**Interfaces:**
- Produces: plugin checkout sessions carry `allow_promotion_codes: true` (lets buyers enter WAITLIST40 at checkout). Pack/membership branches unchanged.

- [ ] **Step 1: Failing test**

```ts
it('plugin checkout sessions allow promotion codes', () => {
  const params = buildCheckoutSessionParams(
    { kind: 'plugin', product: 'ai-editor-divi5-pro' },
    { siteUrl: 'https://divi5lab.com', pluginPriceId: 'price_x', automaticTax: true },
  );
  expect(params.allow_promotion_codes).toBe(true);
  expect(params.mode).toBe('subscription');
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/checkout.test.ts` → FAIL (`undefined` !== `true`).

- [ ] **Step 3: Implement** — in the `input.kind === 'plugin'` branch of `buildCheckoutSessionParams`:

```ts
if (input.kind === 'plugin') {
  return {
    ...common,
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [{ price: ctx.pluginPriceId, quantity: 1 }],
    metadata: { kind: 'plugin', product: input.product },
    subscription_data: { metadata: { kind: 'plugin', product: input.product } },
  };
}
```

- [ ] **Step 4: Run tests** — PASS. **Step 5: Commit**

```bash
git add lib/stripe/checkout.ts tests/checkout.test.ts
git commit -m "feat(commerce): allow promotion codes on plugin checkout"
```

### Task 5: per-product pricing in `stripe-plugin-products.ts`

**Files:**
- Modify: `scripts/stripe-plugin-products.ts:12-17,51-58`

**Interfaces:**
- Produces: running the script (TEST or LIVE) creates/reuses the AI Editor product and prints `STRIPE_PRICE_AI_EDITOR_PRO=price_...`. Script stays idempotent (list + metadata.slug filter).

- [ ] **Step 1: Implement** (script has no unit tests — keep it that way, typecheck is the gate):

```ts
const PRODUCTS = [
  { slug: 'elementor-to-divi5-pro', name: 'JHMG Converter For Elementor to Divi 5 — Pro', envVar: 'STRIPE_PRICE_ELEM2DIVI_PRO', yearlyUsdCents: 4900 },
  { slug: 'divi-to-elementor-pro', name: 'JHMG Converter For Divi to Elementor — Pro', envVar: 'STRIPE_PRICE_DIVI2ELEM_PRO', yearlyUsdCents: 4900 },
  { slug: 'ai-editor-divi5-pro', name: 'AI Editor for Divi 5 — Pro', envVar: 'STRIPE_PRICE_AI_EDITOR_PRO', yearlyUsdCents: 7900 },
] as const;
```

Delete the shared `YEARLY_USD_CENTS` const. In `main()`, replace `unit_amount: YEARLY_USD_CENTS` with `unit_amount: p.yearlyUsdCents`, and add a mismatch guard after finding an existing yearly price:

```ts
let price = prices.data.find((x) => x.recurring?.interval === 'year');
if (price && price.unit_amount !== p.yearlyUsdCents) {
  console.error(
    `WARNING: existing yearly price ${price.id} for ${p.slug} is ${price.unit_amount}c, expected ${p.yearlyUsdCents}c — archive it in the dashboard and re-run to mint the new price.`,
  );
}
```

- [ ] **Step 2: Verify** — `npm run typecheck` PASS, then run against TEST-mode Stripe (`STRIPE_SECRET_KEY` from `.env`): `npx tsx scripts/stripe-plugin-products.ts`. Expected output: three env lines, converter lines matching existing values, new `STRIPE_PRICE_AI_EDITOR_PRO=price_...`. Paste the new var into `.env` (test mode).

- [ ] **Step 3: Commit**

```bash
git add scripts/stripe-plugin-products.ts
git commit -m "feat(commerce): per-product pricing + AI Editor Pro in stripe products script"
```

### Task 6: free-download route

**Files:**
- Create: `app/api/plugin/free-download/route.ts`
- Create: `lib/license-server/free-download.ts`
- Test: `tests/plugin-free-download.test.ts`

**Interfaces:**
- Consumes: `dbLicenseStore.latestRelease(productSlug)` (`lib/license-server/store.ts:11`), which returns `{ version, blobKey, changelog } | null` where `blobKey` is the absolute public blob URL.
- Produces: `GET /api/plugin/free-download?product=ai-editor-divi5-pro` → 302 redirect to the latest release's blob URL. Only products in `FREE_DOWNLOAD_PRODUCTS` are served — converter Pro zips stay key-gated. Pure logic in `freeDownloadTarget()` for unit tests.

Rationale pinned in code comments: the AI Editor ships as ONE zip whose premium features are license-gated at runtime, so handing out the zip is intentional; the email capture on the page is a soft gate (same policy as free layout downloads).

- [ ] **Step 1: Failing tests** (`tests/plugin-free-download.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { freeDownloadTarget, FREE_DOWNLOAD_PRODUCTS } from '@/lib/license-server/free-download';

const release = { version: '3.0.0', blobKey: 'https://store.public.blob.vercel-storage.com/plugins/x/nonce/x-3.0.0.zip', changelog: null };

describe('freeDownloadTarget', () => {
  it('returns the blob URL for a free-downloadable product with a release', async () => {
    const r = await freeDownloadTarget('ai-editor-divi5-pro', async () => release);
    expect(r).toEqual({ ok: true, url: release.blobKey });
  });
  it('rejects products not on the free list (paid Pro zips stay gated)', async () => {
    const r = await freeDownloadTarget('elementor-to-divi5-pro', async () => release);
    expect(r).toEqual({ ok: false, status: 404 });
  });
  it('rejects unknown products', async () => {
    expect(await freeDownloadTarget('nope', async () => release)).toEqual({ ok: false, status: 404 });
  });
  it('404s when no release exists yet', async () => {
    expect(await freeDownloadTarget('ai-editor-divi5-pro', async () => null)).toEqual({ ok: false, status: 404 });
  });
  it('the free list contains exactly the AI Editor', () => {
    expect(FREE_DOWNLOAD_PRODUCTS).toEqual(['ai-editor-divi5-pro']);
  });
});
```

- [ ] **Step 2: Run to verify failure** — module not found. 

- [ ] **Step 3: Implement**

`lib/license-server/free-download.ts`:

```ts
// The AI Editor is distributed as a single zip whose premium tools are
// license-gated at runtime, so the zip itself is free to download (the email
// capture on the product page is a soft gate, same as free layouts). Converter
// Pro zips are NOT free — they stay behind the key-authenticated download route.
export const FREE_DOWNLOAD_PRODUCTS = ['ai-editor-divi5-pro'] as const;

type LatestRelease = (product: string) => Promise<{ version: string; blobKey: string; changelog: string | null } | null>;

export async function freeDownloadTarget(
  product: string,
  latestRelease: LatestRelease,
): Promise<{ ok: true; url: string } | { ok: false; status: 404 }> {
  if (!(FREE_DOWNLOAD_PRODUCTS as readonly string[]).includes(product)) return { ok: false, status: 404 };
  const release = await latestRelease(product);
  if (!release) return { ok: false, status: 404 };
  return { ok: true, url: release.blobKey };
}
```

`app/api/plugin/free-download/route.ts` (mirror rate-limit style from `app/api/lead/route.ts`):

```ts
import { NextResponse } from 'next/server';
import { dbLicenseStore } from '@/lib/license-server/store';
import { freeDownloadTarget } from '@/lib/license-server/free-download';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`free-dl:${ip}`, { limit: 10, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const product = new URL(req.url).searchParams.get('product') ?? '';
  const target = await freeDownloadTarget(product, (p) => dbLicenseStore.latestRelease(p));
  if (!target.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.redirect(target.url, 302);
}
```

- [ ] **Step 4: Run tests + typecheck** — `npx vitest run tests/plugin-free-download.test.ts && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/license-server/free-download.ts app/api/plugin/free-download tests/plugin-free-download.test.ts
git commit -m "feat(plugins): capture-soft-gated free download route for the AI Editor"
```

### Task 7: canonical client policy note + AIED sync destination

**Files:**
- Modify: `lib/license-server/php-client/class-license-client.php:9-11` (header comment only)
- Modify: `scripts/sync-license-client.sh`

**Interfaces:**
- Produces: running `bash scripts/sync-license-client.sh` writes the transformed client to VAL_REPO at `wp-plugin/src/Licensing/LicenseClient.php` with namespace `AiEditorDivi5\Licensing`, text domain `ai-editor-divi5`, notice copy naming the right product, and admin links pointing at `admin.php?page=ai-editor-divi5&tab=upgrade`. Task 8 (Part B) consumes the synced file — its FQCN is **`\AiEditorDivi5\Licensing\LicenseClient`**.

- [ ] **Step 1: Amend the canonical header** — replace lines 9-11 of `lib/license-server/php-client/class-license-client.php`:

```php
 * Enforcement policy: SOFT for the converter Pros (frozen — license state gates update
 * delivery + admin notices only; conversion features never lock). Documented exception:
 * the AI Editor for Divi 5 gates its premium tools behind a sticky unlock that only an
 * explicit server verdict of `revoked` or `invalid` re-locks (see its Licensing adapter);
 * lapse (expired/canceled) never locks features anywhere.
```

- [ ] **Step 2: Add the destination** — append to `scripts/sync-license-client.sh`:

```bash
# AI Editor destination: single plugin (not a Pro companion). Rewrites namespace,
# text domain, user-facing product name in notices, and the admin link shape
# (top-level admin.php page, license UI lives on the "upgrade" tab).
DEST_AIED="/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/wp-plugin/src/Licensing/LicenseClient.php"
mkdir -p "$(dirname "$DEST_AIED")"
sed \
  -e 's/ElementorDivi5Converter\\Pro\\Licensing/AiEditorDivi5\\Licensing/g' \
  -e 's/jhmg-converter-for-elementor-to-divi-pro/ai-editor-divi5/g' \
  -e 's/JHMG Converter Pro/AI Editor for Divi 5/g' \
  -e 's/tools\.php/admin.php/g' \
  -e 's/tab=license/tab=upgrade/g' \
  "$SRC" > "$DEST_AIED"
echo "synced -> $DEST_AIED (transformed: namespace + text domain + product name + admin links)"
```

- [ ] **Step 3: Run and verify**

Run: `bash scripts/sync-license-client.sh`
Expected: three `synced ->` lines. Verify the AIED copy: `grep -n "namespace AiEditorDivi5" "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/wp-plugin/src/Licensing/LicenseClient.php"` shows `namespace AiEditorDivi5\Licensing;`, and `grep -c "ai-editor-divi5" ...` > 0, and no remaining `JHMG Converter Pro` / `tools.php` strings.
NOTE: the run also rewrites the E2D5/D2E plugin copies (comment-only diff from Step 1). Leave those working-tree changes in the converter repos uncommitted; they ride with each plugin's next release. Record this in the ledger.

- [ ] **Step 4: Commit (SITE)**

```bash
git add lib/license-server/php-client/class-license-client.php scripts/sync-license-client.sh
git commit -m "feat(licensing): AI Editor sync destination + per-product enforcement note"
```

### Task 8: sales page, free-download form, pricing card

**Files:**
- Create: `components/plugins/FreeDownloadForm.tsx`
- Rewrite: `app/(marketing)/plugins/divi-5-ai-editor/page.tsx`
- Modify: `app/(catalog)/pricing/page.tsx:60-62,108-123`
- Test: `tests/ai-editor-page.test.tsx` (render smoke, following `tests/buy-pro-button.test.tsx` / existing page-test style)

**Interfaces:**
- Consumes: `BuyProButton` (`{ product, label }`), `/api/lead` (source `ai_editor_free`), `/api/plugin/free-download?product=ai-editor-divi5-pro`, UI kit `Container`/`Card`/`Icon`.
- Produces: buyable product page + free download flow; pricing page shows $79/yr card. `WaitlistForm` usage on this page is gone (waitlist stays only in Loops history).

- [ ] **Step 1: Failing render test** (`tests/ai-editor-page.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('sells Pro and offers the free download', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/\$79/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get Pro/i })).toBeInTheDocument();
    expect(screen.getByText(/free download/i)).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure** — current page renders "Coming soon" + waitlist → FAIL.

- [ ] **Step 3: `FreeDownloadForm`** — capture-then-reveal (clone `WaitlistForm`'s fetch/state shape):

```tsx
'use client';
import { useState } from 'react';

// Email capture (Loops source ai_editor_free) that reveals the plugin download.
// Soft gate by design — the zip's premium tools are license-gated at runtime.
export function FreeDownloadForm({ product }: { product: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'ai_editor_free' }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div>
        <p className="text-body font-medium text-navy">You&rsquo;re in — download away.</p>
        <a
          href={`/api/plugin/free-download?product=${encodeURIComponent(product)}`}
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
        >
          Download the plugin (.zip)
        </a>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-wrap gap-2">
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-1 rounded-full border border-border bg-paper px-4 text-small text-navy outline-none focus:border-action"
      />
      <button
        type="submit" disabled={state === 'loading'}
        className="inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
      >
        {state === 'loading' ? 'One sec…' : 'Get the free download'}
      </button>
      {state === 'error' && <p className="w-full text-small text-red-600">Something went wrong — please try again.</p>}
    </form>
  );
}
```

- [ ] **Step 4: Rewrite the page.** Structure (mirror `app/(marketing)/plugins/elementor-to-divi-5/page.tsx` section/classname conventions exactly — read it first):

1. **Hero**: h1 "The AI Editor for Divi 5", lead copy "Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database — broken layouts are impossible." + two CTAs side by side: `<BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />` and an anchor link to `#free`.
2. **How it works** (3 Cards): Connect (paste the API key from Settings → AI Editor into your assistant's MCP config) → Instruct ("Change the hero heading on Home to…") → Validated & saved (validator checks every block/attribute/nesting rule; invalid = exact violations returned, AI self-corrects).
3. **What your AI can do** — tool list grouped Free (list pages, read layouts, dry-run validate, update pages, style/landing/image/site guides, section recipes) vs Pro (create pages from scratch, set the front page, build the primary menu, site-wide custom CSS, reviewed PHP proposals).
4. **Free vs Pro** two-Card comparison (clone the e2d5 page's `Free vs. Pro` section): Free $0 — "Edit and validate existing pages, all guides included" + `FreeDownloadForm` with `id="free"` on the section; Pro $79/yr — the five premium tools, WP-native updates, priority support, unlimited sites + BuyProButton.
5. **FAQ** section: "Which AI assistants work?" (Claude Desktop, Cursor, Windsurf, VS Code Copilot via MCP; ChatGPT via OpenAPI actions; any HTTP client); "Do I need an AI subscription?" (yes — bring your own assistant; the plugin adds the tools + safety, your assistant supplies the AI); "What happens if I don't renew?" (premium features keep working on activated sites; renewal covers updates + support); "How many sites?" (unlimited).
6. `metadata` export: title `AI Editor for Divi 5 — edit Divi with AI, validated`, description matching the hero, canonical `/plugins/divi-5-ai-editor`.

Keep `Container`, `Card`, `Icon`, `Feature` list styling per the existing plugin pages.

- [ ] **Step 5: Pricing page** — replace the teaser section (lines 108-123) with a purchasable card:

```tsx
<section className="mt-16">
  <Card className="flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-section text-navy">AI Editor for Divi 5 — Pro</h2>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-h2 text-navy">$79</span>
        <span className="text-small text-muted">/yr</span>
      </div>
      <p className="mt-2 max-w-xl text-body text-muted">
        Let your AI assistant build whole pages, menus and site-wide styling — every change validated before it lands. Free tier edits existing pages.
      </p>
    </div>
    <div className="flex shrink-0 flex-col gap-2">
      <BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />
      <Link href="/plugins/divi-5-ai-editor" className="text-center text-small font-semibold text-action hover:underline">
        Learn more
      </Link>
    </div>
  </Card>
</section>
```

Also update the pricing `SectionTitle` blurb (line 61) since $49 is no longer the only price: `Free plugins to start. Pro unlocks the full toolkit — from $49/yr, unlimited sites.`

- [ ] **Step 6: Run** — `npx vitest run tests/ai-editor-page.test.tsx && npm run test && npm run typecheck` → PASS (full suite catches any page test referencing the old waitlist copy — fix those if they exist: `grep -rn "ai_editor_waitlist" tests/ app/`).

- [ ] **Step 7: Commit**

```bash
git add components/plugins/FreeDownloadForm.tsx "app/(marketing)/plugins/divi-5-ai-editor/page.tsx" "app/(catalog)/pricing/page.tsx" tests/ai-editor-page.test.tsx
git commit -m "feat(site): AI Editor sales page + free download + pricing card"
```

### Task 9: assistant setup guides

**Files:**
- Create: `content/guides/connect-claude-to-divi-5.md`
- Create: `content/guides/connect-cursor-to-divi-5.md`
- Create: `content/guides/connect-chatgpt-to-divi-5.md`

**Interfaces:**
- Consumes: the guides system (`lib/guides/index.ts`) auto-lists any `content/guides/*.md` with frontmatter `title/description/date/keywords` (comma-separated keywords, not YAML lists). Sitemap picks them up via existing generation.
- Produces: three SEO guide pages at `/guides/<slug>` each ending with a CTA link to `/plugins/divi-5-ai-editor`.

- [ ] **Step 1: Write the three guides.** Frontmatter shape (dates = 2026-07-12):

```markdown
---
title: How to Connect Claude to Divi 5 (AI Page Editing via MCP)
description: Step-by-step - connect Claude Desktop to your Divi 5 site with the AI Editor plugin and edit pages in plain English, with every change validated before it saves.
date: 2026-07-12
keywords: claude divi, divi 5 ai editor, claude mcp wordpress, edit divi with ai
---
```

Content per guide (~500-800 words each, written fully — no stubs):
- **Claude guide**: what MCP is in one paragraph; install plugin → Settings → AI Editor → copy the config snippet; where Claude Desktop's `claude_desktop_config.json` lives (macOS/Windows paths); paste snippet, restart Claude; first prompts to try ("List my Divi pages", "Change the hero heading on Home to …"); how validation protects the site; free vs Pro note; CTA.
- **Cursor guide**: same flow via Cursor's MCP settings (`.cursor/mcp.json` / Settings → MCP) and VS Code Copilot MCP config; emphasize agent mode; same prompts + CTA.
- **ChatGPT guide**: Custom GPT with OpenAPI actions — the plugin exposes an OpenAPI spec endpoint (shown on the plugin's Settings screen); create a GPT → Actions → import spec URL → set the Bearer API key; note ChatGPT needs the site reachable over HTTPS; same prompts + CTA.

Each ends with: `Ready to try it? [Get the AI Editor for Divi 5](/plugins/divi-5-ai-editor) — the free tier edits existing pages; Pro builds whole sites.`

- [ ] **Step 2: Verify** — `npm run test && npm run typecheck` (guides tests, if any, and the sitemap test pick the files up automatically). Then `npm run dev` and load `/guides/connect-claude-to-divi-5` → 200.

- [ ] **Step 3: Commit**

```bash
git add content/guides/connect-claude-to-divi-5.md content/guides/connect-cursor-to-divi-5.md content/guides/connect-chatgpt-to-divi-5.md
git commit -m "feat(seo): AI assistant setup guides for the AI Editor"
```

---

## Part B — VAL_REPO (`/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator`)

Branch: `git checkout -b feat/divi5lab-licensing`. Task 7 must already have synced `wp-plugin/src/Licensing/LicenseClient.php` into the working tree (run `bash scripts/sync-license-client.sh` from the SITE worktree if missing).

### Task 10: Licensing adapter over the synced client (TDD)

**Files:**
- Commit (synced, do not edit): `wp-plugin/src/Licensing/LicenseClient.php`
- Rewrite: `wp-plugin/src/Licensing.php`
- Modify: `wp-plugin/ai-editor-divi5.php:25-27` (defines), `wp-plugin/src/autoload.php:16-17`
- Modify: `tests/bootstrap.php` (new shims)
- Rewrite: `tests/LicensingTest.php`
- Delete: `scripts/make-license.php`, `license-signing-key.txt` (Ed25519 minting — no keys were ever sold)

**Interfaces:**
- Consumes: `\AiEditorDivi5\Licensing\LicenseClient` (7-arg ctor: product, plugin_version, api_base, plugin_basename, admin_page_slug, product_page_url, option_prefix; methods `activate(key): array{ok,error,status}`, `deactivate(): void`, `refresh(bool $force=false): void`, `get_key(): ?string`, `get_state(): ?array`, `inject_update($transient)`, `status_notice(): void`).
- Produces (consumed by Task 11 and existing call sites in AdminPage/RestController/McpHandler/uninstall):
  - `Licensing::isPremium(): bool` — sticky unlock minus revoked/invalid lock
  - `Licensing::activate(string $key): array{ok: bool, error: ?string}`
  - `Licensing::deactivate(): void` (server deactivate + clears sticky unlock)
  - `Licensing::refresh(bool $force = false): void`
  - `Licensing::status(): array{valid: bool, status: ?string, expires: ?int, reason: string}`
  - `Licensing::client(): LicenseClient`
  - `Licensing::clear(): void` (local-only wipe, for uninstall)
  - `Licensing::UPGRADE_URL` (unchanged const name)
  - Plugin constants: `AI_EDITOR_DIVI5_PRODUCT = 'ai-editor-divi5-pro'`; `AIED_API_BASE` wp-config define overrides the `https://divi5lab.com` default.

- [ ] **Step 1: Extend `tests/bootstrap.php`** with the shims the client needs (append after the existing option shims, all inside `function_exists` guards like the current ones):

```php
foreach ( [ 'MINUTE_IN_SECONDS' => 60, 'HOUR_IN_SECONDS' => 3600, 'DAY_IN_SECONDS' => 86400 ] as $c => $v ) {
    if ( ! defined( $c ) ) define( $c, $v );
}
if ( ! defined( 'AI_EDITOR_DIVI5_VERSION' ) )  define( 'AI_EDITOR_DIVI5_VERSION', '3.0.0' );
if ( ! defined( 'AI_EDITOR_DIVI5_PRODUCT' ) )  define( 'AI_EDITOR_DIVI5_PRODUCT', 'ai-editor-divi5-pro' );
if ( ! defined( 'AI_EDITOR_DIVI5_FILE' ) )     define( 'AI_EDITOR_DIVI5_FILE', __DIR__ . '/../wp-plugin/ai-editor-divi5.php' );

$GLOBALS['__wp_transients'] = [];
// Scripted HTTP: tests push [ 'code' => int, 'body' => array ] entries or the
// string 'network_error'; each wp_remote_post/get shifts the next one.
$GLOBALS['__wp_http_queue'] = [];
$GLOBALS['__wp_http_log']   = [];

if ( ! function_exists( 'get_transient' ) ) {
    function get_transient( $key ) { return $GLOBALS['__wp_transients'][ $key ] ?? false; }
}
if ( ! function_exists( 'set_transient' ) ) {
    function set_transient( $key, $value, $ttl = 0 ): bool { $GLOBALS['__wp_transients'][ $key ] = $value; return true; }
}
if ( ! function_exists( 'delete_transient' ) ) {
    function delete_transient( $key ): bool { unset( $GLOBALS['__wp_transients'][ $key ] ); return true; }
}
if ( ! class_exists( 'WP_Error' ) ) {
    class WP_Error { public function __construct( public string $code = 'http_request_failed' ) {} }
}
if ( ! function_exists( 'is_wp_error' ) ) {
    function is_wp_error( $thing ): bool { return $thing instanceof WP_Error; }
}
if ( ! function_exists( '__wp_http_next' ) ) {
    function __wp_http_next( string $url, $payload ) {
        $GLOBALS['__wp_http_log'][] = [ 'url' => $url, 'payload' => $payload ];
        $next = array_shift( $GLOBALS['__wp_http_queue'] );
        if ( $next === null || $next === 'network_error' ) return new WP_Error();
        return [ 'response' => [ 'code' => $next['code'] ], 'body' => json_encode( $next['body'] ) ];
    }
}
if ( ! function_exists( 'wp_remote_post' ) ) {
    function wp_remote_post( $url, $args = [] ) { return __wp_http_next( $url, $args['body'] ?? null ); }
}
if ( ! function_exists( 'wp_remote_get' ) ) {
    function wp_remote_get( $url, $args = [] ) { return __wp_http_next( $url, null ); }
}
if ( ! function_exists( 'wp_remote_retrieve_response_code' ) ) {
    function wp_remote_retrieve_response_code( $res ) { return is_wp_error( $res ) ? 0 : ( $res['response']['code'] ?? 0 ); }
}
if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {
    function wp_remote_retrieve_body( $res ) { return is_wp_error( $res ) ? '' : ( $res['body'] ?? '' ); }
}
if ( ! function_exists( 'wp_json_encode' ) ) {
    function wp_json_encode( $data ) { return json_encode( $data ); }
}
if ( ! function_exists( 'plugin_basename' ) ) {
    function plugin_basename( $file ) { return basename( dirname( $file ) ) . '/' . basename( $file ); }
}
if ( ! function_exists( 'get_bloginfo' ) ) {
    function get_bloginfo( $key ) { return $key === 'version' ? '6.5' : ''; }
}
```

Also reset `__wp_transients` / `__wp_http_queue` / `__wp_http_log` in each test's `setUp()`.

- [ ] **Step 2: Rewrite `tests/LicensingTest.php`** — delete the Ed25519 fixtures/tests wholesale; new file:

```php
<?php

declare(strict_types=1);

namespace Divi5Validator\Tests;

use AiEditorDivi5\WP\Licensing;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../wp-plugin/src/Licensing/LicenseClient.php';
require_once __DIR__ . '/../wp-plugin/src/Licensing.php';

/**
 * Sticky-unlock enforcement matrix: activation persists premium; ONLY an
 * explicit server verdict of `revoked` or `invalid` re-locks; lapse and
 * transient failures never do.
 */
class LicensingTest extends TestCase
{
    private const KEY = 'JHMG-TEST-TEST-TEST-TEST';

    protected function setUp(): void
    {
        $GLOBALS['__wp_options']    = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_http_queue'] = [];
        $GLOBALS['__wp_http_log']   = [];
        $GLOBALS['__wp_home_url']   = 'https://example.com';
        Licensing::resetForTests();
    }

    private function queue( int $code, array $body ): void
    {
        $GLOBALS['__wp_http_queue'][] = [ 'code' => $code, 'body' => $body ];
    }

    /** Age the cached state so refresh() actually hits the network. */
    private function ageState(): void
    {
        $state = $GLOBALS['__wp_options']['aied_license_state'];
        $state['checked_at'] = time() - 2 * DAY_IN_SECONDS;
        $GLOBALS['__wp_options']['aied_license_state'] = $state;
    }

    private function activatePremium(): void
    {
        $this->queue( 200, [ 'status' => 'active', 'product' => 'ai-editor-divi5-pro', 'expires' => '2027-07-12T00:00:00.000Z' ] );
        $res = Licensing::activate( self::KEY );
        $this->assertTrue( $res['ok'] );
        $this->assertTrue( Licensing::isPremium() );
    }

    public function testFreshInstallIsNotPremium(): void
    {
        $this->assertFalse( Licensing::isPremium() );
        $this->assertSame( 'no_key', Licensing::status()['reason'] );
    }

    public function testActivateSuccessUnlocksPremium(): void
    {
        $this->activatePremium();
        $this->assertSame( 'active', Licensing::status()['status'] );
        // activate posted to /api/license/activate with snake_case params
        $payload = json_decode( $GLOBALS['__wp_http_log'][0]['payload'], true );
        $this->assertSame( 'ai-editor-divi5-pro', $payload['product'] );
        $this->assertSame( self::KEY, $payload['key'] );
        $this->assertArrayHasKey( 'site_url', $payload );
    }

    public function testActivateInvalidKeyStaysLocked(): void
    {
        $this->queue( 404, [ 'error' => 'invalid_key' ] );
        $res = Licensing::activate( self::KEY );
        $this->assertFalse( $res['ok'] );
        $this->assertSame( 'invalid_key', $res['error'] );
        $this->assertFalse( Licensing::isPremium() );
    }

    public function testExpiredVerdictKeepsPremium(): void
    {
        $this->activatePremium();
        $this->ageState();
        $this->queue( 403, [ 'error' => 'license_not_usable', 'status' => 'expired' ] );
        Licensing::refresh();
        $this->assertTrue( Licensing::isPremium() );        // lapse never locks
        $this->assertSame( 'expired', Licensing::status()['status'] ); // but status is honest
    }

    public function testCanceledVerdictKeepsPremium(): void
    {
        $this->activatePremium();
        $this->ageState();
        $this->queue( 403, [ 'error' => 'license_not_usable', 'status' => 'canceled' ] );
        Licensing::refresh();
        $this->assertTrue( Licensing::isPremium() );
    }

    public function testRevokedVerdictLocksPremium(): void
    {
        $this->activatePremium();
        $this->ageState();
        $this->queue( 403, [ 'error' => 'license_not_usable', 'status' => 'revoked' ] );
        Licensing::refresh();
        $this->assertFalse( Licensing::isPremium() );
    }

    public function testInvalidKeyVerdictLocksPremium(): void
    {
        $this->activatePremium();
        $this->ageState();
        $this->queue( 404, [ 'error' => 'invalid_key' ] );
        Licensing::refresh();
        $this->assertFalse( Licensing::isPremium() );
    }

    public function testNetworkErrorKeepsPremium(): void
    {
        $this->activatePremium();
        $this->ageState();
        $GLOBALS['__wp_http_queue'][] = 'network_error';
        Licensing::refresh();
        $this->assertTrue( Licensing::isPremium() );
    }

    public function testRateLimitAnd5xxKeepPremium(): void
    {
        $this->activatePremium();
        $this->ageState();
        $this->queue( 429, [ 'error' => 'rate_limited' ] );
        Licensing::refresh();
        $this->assertTrue( Licensing::isPremium() );
        $this->ageState();
        $this->queue( 500, [] );
        Licensing::refresh();
        $this->assertTrue( Licensing::isPremium() );
    }

    public function testReactivationAfterRevokeUnlocksAgain(): void
    {
        $this->testRevokedVerdictLocksPremium();
        $this->queue( 200, [ 'status' => 'active', 'product' => 'ai-editor-divi5-pro', 'expires' => null ] );
        $res = Licensing::activate( 'JHMG-NEWK-NEWK-NEWK-NEWK' );
        $this->assertTrue( $res['ok'] );
        $this->assertTrue( Licensing::isPremium() );
    }

    public function testDeactivateClearsPremium(): void
    {
        $this->activatePremium();
        $this->queue( 200, [ 'ok' => true ] ); // server deactivate call
        Licensing::deactivate();
        $this->assertFalse( Licensing::isPremium() );
        $this->assertSame( 'no_key', Licensing::status()['reason'] );
    }

    public function testStatusExposesUnixExpires(): void
    {
        $this->activatePremium();
        $this->assertSame( strtotime( '2027-07-12T00:00:00.000Z' ), Licensing::status()['expires'] );
    }

    public function testClearWipesLocalStateOnly(): void
    {
        $this->activatePremium();
        Licensing::clear(); // uninstall path: no HTTP queued, must not error
        $this->assertFalse( Licensing::isPremium() );
        $this->assertSame( [], array_filter( array_keys( $GLOBALS['__wp_options'] ), fn ( $k ) => str_starts_with( $k, 'aied_' ) ) );
    }
}
```

- [ ] **Step 3: Run to verify failure** — `make test` → errors (old Licensing has no `activate/resetForTests`, client file possibly not required).

- [ ] **Step 4: Rewrite `wp-plugin/src/Licensing.php`:**

```php
<?php

declare(strict_types=1);

namespace AiEditorDivi5\WP;

use AiEditorDivi5\Licensing\LicenseClient;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Premium gate — an adapter over the divi5lab license server client.
 *
 * Enforcement (approved spec, differs from the converters' soft model because
 * here the license gates FEATURES): first successful activation sets a
 * persistent unlock; only an explicit server verdict of `revoked` or `invalid`
 * (invalid_key) re-locks. Lapse (expired/canceled/past_due) and transient
 * failures (offline/429/5xx) NEVER re-lock — lapsed customers keep what they
 * activated and only lose updates + support.
 */
final class Licensing
{
    private const UNLOCKED_OPTION = 'ai_editor_divi5_premium_unlocked';
    private const LOCKING = [ 'revoked', 'invalid' ];

    public const UPGRADE_URL = 'https://divi5lab.com/plugins/divi-5-ai-editor';

    private static ?LicenseClient $client = null;

    public static function client(): LicenseClient
    {
        if ( self::$client === null ) {
            self::$client = new LicenseClient(
                AI_EDITOR_DIVI5_PRODUCT,
                AI_EDITOR_DIVI5_VERSION,
                defined( 'AIED_API_BASE' ) ? AIED_API_BASE : 'https://divi5lab.com',
                plugin_basename( AI_EDITOR_DIVI5_FILE ),
                'ai-editor-divi5',
                self::UPGRADE_URL,
                'aied'
            );
        }
        return self::$client;
    }

    /** @internal test isolation only */
    public static function resetForTests(): void
    {
        self::$client = null;
    }

    public static function isPremium(): bool
    {
        if ( ! get_option( self::UNLOCKED_OPTION ) ) {
            return false;
        }
        $state = self::client()->get_state();
        return ! in_array( $state['status'] ?? '', self::LOCKING, true );
    }

    /** @return array{ok: bool, error: ?string} */
    public static function activate(string $key): array
    {
        $res = self::client()->activate( trim( $key ) );
        if ( $res['ok'] ) {
            update_option( self::UNLOCKED_OPTION, 1, false );
        }
        return [ 'ok' => (bool) $res['ok'], 'error' => $res['error'] ];
    }

    public static function deactivate(): void
    {
        self::client()->deactivate();
        delete_option( self::UNLOCKED_OPTION );
    }

    public static function refresh(bool $force = false): void
    {
        self::client()->refresh( $force );
    }

    /**
     * @return array{valid: bool, status: ?string, expires: ?int, reason: string}
     */
    public static function status(): array
    {
        if ( self::client()->get_key() === null ) {
            return [ 'valid' => false, 'status' => null, 'expires' => null, 'reason' => 'no_key' ];
        }
        $state   = self::client()->get_state();
        $status  = (string) ( $state['status'] ?? 'unknown' );
        $expires = null;
        if ( ! empty( $state['expires'] ) ) {
            $ts      = strtotime( (string) $state['expires'] );
            $expires = $ts !== false ? $ts : null;
        }
        return [ 'valid' => self::isPremium(), 'status' => $status, 'expires' => $expires, 'reason' => $status ];
    }

    /** Local-only wipe (uninstall). Never performs HTTP. */
    public static function clear(): void
    {
        delete_option( self::UNLOCKED_OPTION );
        delete_option( 'aied_license_key' );
        delete_option( 'aied_license_state' );
        delete_option( 'aied_update_blocked' );
    }
}
```

- [ ] **Step 5: Defines + autoload.** `wp-plugin/ai-editor-divi5.php` — next to the existing defines (line ~25-27):

```php
define('AI_EDITOR_DIVI5_PRODUCT', 'ai-editor-divi5-pro');
// License/update server. Override in wp-config.php for dev:
//   define('AIED_API_BASE', 'http://host.docker.internal:3100');
```

`wp-plugin/src/autoload.php` — insert BEFORE the `Licensing.php` require:

```php
require_once __DIR__ . '/Licensing/LicenseClient.php';
```

- [ ] **Step 6: Delete the Ed25519 vendor tooling**

```bash
git rm scripts/make-license.php license-signing-key.txt
```

(Verify first with `git log --oneline -1 -- scripts/make-license.php` that they're tracked; if `license-signing-key.txt` is untracked, plain-delete it.)

- [ ] **Step 7: Run** — `make test` → all green (including every pre-existing suite; RestController/McpHandler tests still compile because `Licensing::isPremium()`/`UPGRADE_URL` kept their signatures).

- [ ] **Step 8: Commit**

```bash
git add -A wp-plugin/src tests wp-plugin/ai-editor-divi5.php
git commit -m "feat(licensing)!: divi5lab license server client with sticky premium unlock (replaces offline Ed25519)"
```

### Task 11: wire updates, refresh, admin UI

**Files:**
- Modify: `wp-plugin/ai-editor-divi5.php:101-107`
- Modify: `wp-plugin/src/AdminPage.php:87-100` (handlers), `492-520` (licensePanel)
- Modify: `wp-plugin/uninstall.php` (no change needed — verify `Licensing::clear()` still fits; it does)
- Test: `tests/LicensingTest.php` (one more test), manual render check in Task 13

**Interfaces:**
- Consumes: `Licensing::client()` (inject_update, status_notice), `Licensing::activate/deactivate/refresh/status`.
- Produces: WP-native update checks; daily-cached validate refresh on admin loads; license panel with activate/deactivate/check-again.

- [ ] **Step 1: Failing test** — append to `tests/LicensingTest.php`:

```php
public function testInjectUpdateOffersPackageForUsableLicense(): void
{
    $this->activatePremium();
    $this->queue( 200, [ 'update' => true, 'version' => '3.1.0', 'package' => 'https://divi5lab.com/api/plugin/download?product=ai-editor-divi5-pro&key=' . self::KEY ] );
    $transient = Licensing::client()->inject_update( (object) [ 'response' => [] ] );
    $basename  = plugin_basename( AI_EDITOR_DIVI5_FILE );
    $this->assertSame( '3.1.0', $transient->response[ $basename ]->new_version );
    $this->assertSame( Licensing::UPGRADE_URL, $transient->response[ $basename ]->url );
}
```

Run `make test` → passes already if client synced correctly (it exercises the sed'd file end-to-end; if it fails, the sync transform is wrong — fix Task 7, not the client copy).

- [ ] **Step 2: Hooks** — in `wp-plugin/ai-editor-divi5.php`, replace the admin block (lines 101-107):

```php
// ---------------------------------------------------------------
// Licensing: WP-native update checks + periodic validation + notices
// ---------------------------------------------------------------

add_filter('pre_set_site_transient_update_plugins', static function ($transient) {
    return AiEditorDivi5\WP\Licensing::client()->inject_update($transient);
});

if (is_admin()) {
    (new AiEditorDivi5\WP\AdminPage())->register();
    add_action('admin_init', static function (): void {
        AiEditorDivi5\WP\Licensing::refresh(); // daily-cached validate (24h + 72h offline grace)
    });
    add_action('admin_notices', static function (): void {
        AiEditorDivi5\WP\Licensing::client()->status_notice();
    });
}
```

- [ ] **Step 3: AdminPage handlers** — replace `handleActivateLicense` / `handleDeactivateLicense` (lines 87-100):

```php
public function handleActivateLicense(): void
{
    $this->guard('ai_editor_divi5_activate_license');
    // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.MissingUnslash -- opaque key, trimmed in Licensing.
    $key    = sanitize_text_field( wp_unslash( $_POST['license_key'] ?? '' ) );
    $result = $key !== '' ? Licensing::activate( $key ) : [ 'ok' => false, 'error' => 'invalid_request' ];
    $this->redirect('upgrade', $result['ok'] ? 'license_activated' : 'license_invalid');
}

public function handleDeactivateLicense(): void
{
    $this->guard('ai_editor_divi5_deactivate_license');
    Licensing::deactivate();
    $this->redirect('upgrade', 'license_deactivated');
}
```

- [ ] **Step 4: licensePanel** — replace the `$license['valid']` branch body (lines 500-509): drop the email sentence (the server doesn't return one) and show status + renewal link when lapsed:

```php
<?php if ( $license['valid'] ) : ?>
    <p class="aied-muted">
        <?php esc_html_e( 'Premium is active on this site.', 'ai-editor-divi5' ); ?>
        <?php if ( $license['expires'] ) { echo ' ' . esc_html( sprintf( /* translators: %s date */ __( 'Renews %s.', 'ai-editor-divi5' ), date_i18n( get_option( 'date_format' ), (int) $license['expires'] ) ) ); } ?>
    </p>
    <?php if ( in_array( $license['status'], [ 'expired', 'canceled' ], true ) ) : ?>
        <p class="aied-muted">
            <?php esc_html_e( 'Your license has lapsed: premium features stay unlocked here, but updates and support are paused.', 'ai-editor-divi5' ); ?>
            <a href="<?php echo esc_url( Licensing::UPGRADE_URL ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Renew', 'ai-editor-divi5' ); ?></a>
        </p>
    <?php endif; ?>
    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
        <input type="hidden" name="action" value="ai_editor_divi5_deactivate_license">
        <?php wp_nonce_field( 'ai_editor_divi5_deactivate_license' ); ?>
        <button type="submit" class="button aied-btn-danger"><?php esc_html_e( 'Deactivate license', 'ai-editor-divi5' ); ?></button>
    </form>
<?php else : ?>
```

(keep the existing `else` activation-form branch unchanged, but change its placeholder to `JHMG-XXXX-XXXX-XXXX-XXXX`).

- [ ] **Step 5: Run** — `make test` → PASS. **Step 6: Commit**

```bash
git add wp-plugin/ai-editor-divi5.php wp-plugin/src/AdminPage.php tests/LicensingTest.php
git commit -m "feat(licensing): wire update checks, refresh cadence and license admin UI"
```

### Task 12: rebrand to divi5lab + v3.0.0

**Files:**
- Modify: `wp-plugin/ai-editor-divi5.php:2-26` (header + version defines)
- Modify: `wp-plugin/readme.txt`
- Sweep: `grep -rn "jhmediagroup" wp-plugin/` → replace all

**Interfaces:**
- Produces: `Version: 3.0.0`, `AI_EDITOR_DIVI5_VERSION = '3.0.0'`, `Plugin URI: https://divi5lab.com/plugins/divi-5-ai-editor`, `Author URI: https://divi5lab.com`, readme `Stable tag: 3.0.0`.

- [ ] **Step 1:** Header block: Plugin URI/Author URI per above; `Version: 3.0.0`; `define('AI_EDITOR_DIVI5_VERSION', '3.0.0');`.
- [ ] **Step 2:** readme.txt: stable tag 3.0.0; fix the "**Seven tools your AI gets**" heading to "**What your AI gets**" and make the list complete (13 tools — add `set_front_page`, `set_primary_menu`, `set_custom_css`, `propose_php_snippet` entries with one-line descriptions, marking the five premium ones "(Pro)"); replace any jhmediagroup.com URL with the divi5lab product page; add a `== Changelog ==` entry:

```
= 3.0.0 =
* Licensing now runs through divi5lab.com — annual Pro license, unlimited sites.
* Automatic plugin updates for licensed sites.
* Premium features: create pages, set front page, build menus, site-wide CSS, PHP proposals.
```

- [ ] **Step 3:** `grep -rn "jhmediagroup" wp-plugin/` → must return nothing.
- [ ] **Step 4:** `make test` → PASS. Commit:

```bash
git add wp-plugin
git commit -m "chore(release): rebrand to divi5lab, v3.0.0"
```

### Task 13: live e2e (both repos, before merge)

**Files:** none (verification only; log evidence in the ledger).

Preconditions: docker WP from VAL_REPO up (`make up`, WP at the URL it prints); SITE dev server on **:3100** with the LOCAL db (`PORT=3100 npm run dev` from the site worktree); local db migrated (Task 1).

- [ ] 1. In the docker WP's `wp-config.php` add `define('AIED_API_BASE', 'http://host.docker.internal:3100');` (or the compose env equivalent — check how the E2D5 e2e did it, `EDCP_API_BASE` precedent in docker-compose).
- [ ] 2. Install/refresh the plugin build in docker WP; activate. Confirm Settings → AI Editor renders; upgrade tab shows the activation form.
- [ ] 3. **Free tier**: call MCP `create_page` (or REST `POST /pages`) with the plugin API key → expect the premium-required answer (`premium: true`, upgrade_url = divi5lab product page).
- [ ] 4. Mint a dev license: `npx tsx scripts/mint-dev-license.ts` (product `ai-editor-divi5-pro`, against LOCAL db). Activate it in the upgrade tab → "License activated", status PREMIUM.
- [ ] 5. `create_page` again → page created. `set_front_page`, `set_custom_css` → work.
- [ ] 6. **Update path**: insert a fake `plugin_releases` row version `3.0.1` for `ai-editor-divi5-pro` in the local db (`npx tsx scripts/release-plugin.ts --product ai-editor-divi5-pro --version 3.0.1 --dir <plugin dir> --changelog test`); in WP, Dashboard → Updates → Check again → update offered with package URL.
- [ ] 7. **Lapse**: `UPDATE licenses SET status='canceled' ...` (or cancel via script) → in WP force "Check again" on the license tab → status shows canceled, `create_page` STILL works, update-check now offers no package.
- [ ] 8. **Revoke**: `npx tsx scripts/revoke-license.ts --key <key>` → force refresh in WP → premium locked, `create_page` → 402/premium answer again.
- [ ] 9. **Re-activate** with a fresh minted license → unlocked again.
- [ ] 10. SITE flows on :3100: `/plugins/divi-5-ai-editor` renders; free-download form captures (`email_captures` row with source `ai_editor_free`) and the revealed link 302s to the release zip; `POST /api/checkout {kind:'plugin',product:'ai-editor-divi5-pro'}` returns a cs_test URL whose checkout page shows the promo-code field.
- [ ] Record all evidence (commands + output) in both ledgers.

### Task 14: launch runbook

**Files:**
- Create: `docs/launch-runbook-ai-editor.md` (SITE repo)

Write the ordered go-live checklist (execution happens post-merge, gated on Lucas saying "deploy"/"launch"):

```markdown
# AI Editor launch runbook (post-merge)

Ordered; stop on any failure. LIVE-mode steps need .env.prod loaded.

1. Merge site branch → main; `git push origin main` (Vercel deploys). Verify /plugins/divi-5-ai-editor 200 in prod.
2. Prod migration: `npm run db:migrate` against prod Neon (adds 'revoked' enum value). [CONFIRM with Lucas first — db:migrate is on the always-confirm list]
3. LIVE Stripe product: `npx tsx scripts/stripe-plugin-products.ts` with LIVE key → paste STRIPE_PRICE_AI_EDITOR_PRO into Vercel prod env + .env.prod; redeploy.
4. Publish the plugin release: `npx tsx scripts/release-plugin.ts --product ai-editor-divi5-pro --version 3.0.0 --dir "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/wp-plugin" --changelog "Initial divi5lab release"` against PROD db.
   NOTE: the shipped folder name inside the zip must be `ai-editor-divi5` — if the dir basename differs, stage a copy named `ai-editor-divi5/` first (release-plugin zips under the folder's basename; WP's updater replaces the installed folder with it).
5. Verify prod: update-check 200 for product=ai-editor-divi5-pro; free-download 302; bad-key activate 404.
6. Stripe dashboard (LIVE): create coupon 40% off, duration=once → promotion code WAITLIST40, redeem-by = launch+7d, first-time-buyer not required.
7. Test the full LIVE loop with a real card (per Phase-2 precedent): checkout with WAITLIST40 (≈$47) → license email → activate on a real site → refund-free cancel per policy… or keep the sub as the canary. Lucas decides.
8. Loops: draft launch email to segment source=ai_editor_waitlist (subject + body to Lucas for approval BEFORE sending) — announce launch, WAITLIST40, 7-day expiry, link to /plugins/divi-5-ai-editor.
9. Watch first sales end-to-end (webhook mint, activation, update-check hits in logs).
```

- [ ] Commit:

```bash
git add docs/launch-runbook-ai-editor.md
git commit -m "docs: AI Editor launch runbook"
```

---

## Final gates (per phases 1–4 process)

- [ ] Whole-branch final review (superpowers:requesting-code-review) on BOTH repos.
- [ ] `npm run test && npm run typecheck && npm run lint` (SITE) and `make test` (VAL_REPO) — output shown, not asserted.
- [ ] Task 13 e2e evidence in ledgers.
- [ ] Merge site worktree → main; merge VAL_REPO branch → its default branch. Deployment/launch = runbook, only on Lucas's go.

## Self-review notes (already applied)

- Spec coverage: revoked status (T1/T2), product+pricing (T3/T5), promo (T4 + runbook 6), free download (T6/T8), client swap + sticky unlock (T7/T10), updates+UI (T11), rebrand (T12), guides (T9), pricing page (T8), e2e (T13), launch (T14). Webhook auto-revocation from the spec was deliberately narrowed to the manual script: checkout is all-sales-final so refunds are exceptional and hand-processed; a charge→invoice→subscription resolution chain needs extra Stripe API calls for a path that may never fire. The spec's "webhook branch" is NOT implemented — flag this to Lucas at review.
- Type consistency: `Licensing::status()` returns `status` key (string) — AdminPage licensePanel reads `$license['status']` and `$license['expires']` (unix int) only; the old `email`/`plan` keys are gone and no other caller reads them (verified: only AdminPage.php:494-503 consumed them).
- `resetForTests()` exists because `Licensing` memoizes the client while tests swap `$GLOBALS` state between cases.

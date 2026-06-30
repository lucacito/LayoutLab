# Phase 1 — Data Model & Read-Only Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the full §6 data model and a read-only storefront catalog — browse with faceted filtering/search/sort, layout & pack detail pages with screenshots, SEO metadata + JSON-LD, and a dynamic sitemap.

**Architecture:** Postgres (published rows only) → pure filter/SEO helpers + thin Drizzle query wrappers (`lib/catalog`, `lib/seo`) → React Server Component pages (`app/(catalog)`) → presentational components. Faceted filtering is server-side via URL query params. SEO is derived from stored fields by pure, unit-tested generators.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript 5, Drizzle ORM + @vercel/postgres, Tailwind 3, `next/image`, Vitest, Playwright.

## Global Constraints

- **Brand placeholder:** `Divi5Lab` / `layoutlab` — keep find-and-replaceable, never hardcode another brand. (CLAUDE.md header)
- **Secrets server-only.** Nothing sensitive in `NEXT_PUBLIC_*`. (§2.6, §16)
- **TDD:** write the failing test first for every non-trivial unit; config/scaffolding folds into the task whose deliverable needs it. (§17)
- **Path alias:** import app code via `@/*`.
- **Catalog visibility:** catalog queries and the sitemap return **only `status='published'`** rows. (§11)
- **Facet source:** filter on the denormalized `layouts` columns (`type/niche/style/colors`), not the tags join. (design decision 3)
- **Tags model:** a single `tags` table with an `axis` discriminator (`type|niche|style|feature`); no separate `categories` table. (design decision 4)
- **Previews:** seed references external placeholder image URLs; no committed binaries. (design decision 2)
- **Do not reimplement the validator in JS.** Out of scope here; never introduce one. (§2.1)
- **Commit after every task** with a conventional-commit message ending in the project's Co-Authored-By trailer.

---

### Task 1: Full §6 schema + migration

**Files:**
- Modify: `db/schema.ts` (expand the Phase 0 `layouts` stub into the full §6 model)
- Create: `db/migrations/<generated>.sql` (via drizzle-kit)
- Test: `tests/db.test.ts` (extend the Phase 0 guard test)

**Interfaces:**
- Consumes: nothing.
- Produces: Drizzle tables `users, accounts, sessions, verificationTokens, layouts, packs, packLayouts, tags, layoutTags, orders, orderItems, subscriptions, entitlements, downloads, emailCaptures`; enums `layoutStatus, packKind, packStatus, userRole, subscriptionStatus, orderStatus, tagAxis`. `layouts.colors` is a **Postgres `text[]` array** (not jsonb) so it is overlap-filterable. Row types via `typeof <table>.$inferSelect`.

- [ ] **Step 1: Write the failing guard test**

Replace `tests/db.test.ts` with:

```ts
// tests/db.test.ts
import { describe, it, expect } from 'vitest';
import {
  layouts, packs, packLayouts, tags, layoutTags,
  users, orders, orderItems, subscriptions, entitlements,
  downloads, emailCaptures,
} from '@/db/schema';

describe('db schema (Phase 1 full model)', () => {
  it('exposes the layouts table with facet columns', () => {
    expect((layouts as any).slug).toBeDefined();
    expect((layouts as any).type).toBeDefined();
    expect((layouts as any).niche).toBeDefined();
    expect((layouts as any).style).toBeDefined();
    expect((layouts as any).colors).toBeDefined();
    expect((layouts as any).status).toBeDefined();
  });

  it('exposes packs + the pack_layouts join', () => {
    expect((packs as any).slug).toBeDefined();
    expect((packs as any).kind).toBeDefined();
    expect((packLayouts as any).packId).toBeDefined();
    expect((packLayouts as any).layoutId).toBeDefined();
  });

  it('exposes a single tags table with an axis discriminator', () => {
    expect((tags as any).axis).toBeDefined();
    expect((tags as any).slug).toBeDefined();
    expect((layoutTags as any).tagId).toBeDefined();
  });

  it('exposes commerce + account tables (unused in Phase 1)', () => {
    for (const t of [users, orders, orderItems, subscriptions, entitlements, downloads, emailCaptures]) {
      expect(t).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/db.test.ts`
Expected: FAIL — `packs`, `tags`, etc. are not exported from `@/db/schema`.

- [ ] **Step 3: Write the full schema**

Replace `db/schema.ts` with:

```ts
// Drizzle schema for Divi5Lab — full §6 data model.
import {
  pgTable, text, timestamp, integer, boolean, jsonb, pgEnum, primaryKey, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

// ---- Enums ---------------------------------------------------------------
export const layoutStatus = pgEnum('layout_status', ['pending', 'approved', 'published', 'rejected']);
export const packKind = pgEnum('pack_kind', ['free', 'paid']);
export const packStatus = pgEnum('pack_status', ['draft', 'published']);
export const userRole = pgEnum('user_role', ['user', 'admin']);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'past_due', 'canceled']);
export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'refunded']);
export const tagAxis = pgEnum('tag_axis', ['type', 'niche', 'style', 'feature']);

// ---- Accounts (Auth.js adapter shape) -----------------------------------
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }));

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }));

// ---- Catalog -------------------------------------------------------------
export const layouts = pgTable('layouts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  niche: text('niche'),
  style: text('style'),
  colors: text('colors').array().notNull().default([]),
  diviJsonBlobKey: text('divi_json_blob_key').notNull(),
  previewImageKeys: jsonb('preview_image_keys').$type<string[]>().notNull().default([]),
  contentHash: text('content_hash').notNull().unique(),
  perceptualHash: text('perceptual_hash'),
  validatorPassed: boolean('validator_passed').notNull().default(false),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    ogImageKey?: string;
    keywords?: string[];
  }>(),
  status: layoutStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
}, (t) => ({
  statusIdx: index('layouts_status_idx').on(t.status),
  typeIdx: index('layouts_type_idx').on(t.type),
  nicheIdx: index('layouts_niche_idx').on(t.niche),
  styleIdx: index('layouts_style_idx').on(t.style),
}));

export const packs = pgTable('packs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  kind: packKind('kind').notNull(),
  priceCents: integer('price_cents'),
  stripePriceId: text('stripe_price_id'),
  coverImageKey: text('cover_image_key'),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    ogImageKey?: string;
    keywords?: string[];
  }>(),
  status: packStatus('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const packLayouts = pgTable('pack_layouts', {
  packId: text('pack_id').notNull().references(() => packs.id, { onDelete: 'cascade' }),
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.packId, t.layoutId] }) }));

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  axis: tagAxis('axis').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    intro?: string;
  }>(),
}, (t) => ({ axisSlugUq: uniqueIndex('tags_axis_slug_uq').on(t.axis, t.slug) }));

export const layoutTags = pgTable('layout_tags', {
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({ pk: primaryKey({ columns: [t.layoutId, t.tagId] }) }));

// ---- Commerce (defined now, exercised in Phase 4) ------------------------
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCheckoutId: text('stripe_checkout_id'),
  amountCents: integer('amount_cents').notNull().default(0),
  status: orderStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  packId: text('pack_id').notNull().references(() => packs.id),
  priceCents: integer('price_cents').notNull().default(0),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: subscriptionStatus('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end'),
});

export const entitlements = pgTable('entitlements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(), // 'pack:<id>' | 'all_access'
  source: text('source').notNull(), // 'order' | 'subscription' | 'free'
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const downloads = pgTable('downloads', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  layoutId: text('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  ip: text('ip'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const emailCaptures = pgTable('email_captures', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  packId: text('pack_id').references(() => packs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  loopsSynced: boolean('loops_synced').notNull().default(false),
});
```

- [ ] **Step 4: Run the guard test to verify it passes**

Run: `npm run test -- tests/db.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Generate the migration**

Run: `npm run db:generate`
Expected: a new SQL file under `db/migrations/` creating all tables + enums. (Generation works offline; `npm run db:migrate` is run later when `DATABASE_URL` is provisioned.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts db/migrations tests/db.test.ts
git commit -m "feat: full Phase 1 data model + migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Catalog filter parsing & query-building (pure)

**Files:**
- Create: `lib/catalog/filters.ts`
- Test: `tests/catalog-filters.test.ts`

**Interfaces:**
- Consumes: `layouts` from `@/db/schema`.
- Produces:
  - `AXIS_VALUES: { type: string[]; niche: string[]; style: string[]; color: string[] }`
  - `type SortKey = 'newest' | 'oldest' | 'title'`
  - `interface CatalogFilters { type: string[]; niche: string[]; style: string[]; color: string[]; q?: string; sort: SortKey; page: number }`
  - `PAGE_SIZE = 24`
  - `parseFilters(searchParams: Record<string, string | string[] | undefined>): CatalogFilters`
  - `buildLayoutFilters(f: CatalogFilters): { conditions: SQL[]; where: SQL | undefined; orderBy: SQL; limit: number; offset: number }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalog-filters.test.ts
import { describe, it, expect } from 'vitest';
import { parseFilters, buildLayoutFilters, PAGE_SIZE } from '@/lib/catalog/filters';

describe('parseFilters', () => {
  it('defaults to empty facets, newest sort, page 1', () => {
    const f = parseFilters({});
    expect(f).toEqual({ type: [], niche: [], style: [], color: [], q: undefined, sort: 'newest', page: 1 });
  });

  it('parses comma-separated axis values and keeps only known ones', () => {
    const f = parseFilters({ type: 'hero,pricing,bogus', niche: 'saas' });
    expect(f.type).toEqual(['hero', 'pricing']);
    expect(f.niche).toEqual(['saas']);
  });

  it('accepts repeated params as arrays', () => {
    const f = parseFilters({ style: ['minimal', 'dark'] });
    expect(f.style).toEqual(['minimal', 'dark']);
  });

  it('clamps an unknown sort to newest and a bad page to 1', () => {
    expect(parseFilters({ sort: 'wat' }).sort).toBe('newest');
    expect(parseFilters({ page: '0' }).page).toBe(1);
    expect(parseFilters({ page: 'abc' }).page).toBe(1);
    expect(parseFilters({ page: '3' }).page).toBe(3);
  });

  it('trims search text and drops empty', () => {
    expect(parseFilters({ q: '  hero  ' }).q).toBe('hero');
    expect(parseFilters({ q: '   ' }).q).toBeUndefined();
  });
});

describe('buildLayoutFilters', () => {
  it('always includes the published-status condition', () => {
    const { conditions } = buildLayoutFilters(parseFilters({}));
    expect(conditions.length).toBe(1); // status only
  });

  it('adds one condition per active facet plus search', () => {
    const f = parseFilters({ type: 'hero', niche: 'saas', style: 'dark', color: 'blue', q: 'bold' });
    const { conditions } = buildLayoutFilters(f);
    expect(conditions.length).toBe(6); // status + 4 facets + search
  });

  it('computes pagination from page and PAGE_SIZE', () => {
    const { limit, offset } = buildLayoutFilters(parseFilters({ page: '3' }));
    expect(limit).toBe(PAGE_SIZE);
    expect(offset).toBe(2 * PAGE_SIZE);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/catalog-filters.test.ts`
Expected: FAIL — cannot find `@/lib/catalog/filters`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/catalog/filters.ts
import { and, eq, inArray, ilike, or, arrayOverlaps, asc, desc, type SQL } from 'drizzle-orm';
import { layouts } from '@/db/schema';

export const AXIS_VALUES = {
  type: ['hero', 'pricing', 'testimonials', 'cta', 'features', 'faq', 'footer', 'header', 'contact', 'gallery', 'blog', 'full_landing'],
  niche: ['saas', 'agency', 'restaurant', 'real_estate', 'fitness', 'coaching', 'ecommerce', 'nonprofit', 'portfolio', 'events'],
  style: ['minimal', 'bold', 'dark', 'corporate', 'playful', 'elegant'],
  color: ['blue', 'green', 'red', 'purple', 'orange', 'monochrome', 'pastel'],
} as const;

export const PAGE_SIZE = 24;

export type SortKey = 'newest' | 'oldest' | 'title';
const SORTS: SortKey[] = ['newest', 'oldest', 'title'];

export interface CatalogFilters {
  type: string[];
  niche: string[];
  style: string[];
  color: string[];
  q?: string;
  sort: SortKey;
  page: number;
}

function readMulti(raw: string | string[] | undefined, allowed: readonly string[]): string[] {
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : raw.split(',');
  const set = new Set(allowed);
  return values.map((v) => v.trim()).filter((v) => set.has(v));
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): CatalogFilters {
  const type = readMulti(searchParams.type, AXIS_VALUES.type);
  const niche = readMulti(searchParams.niche, AXIS_VALUES.niche);
  const style = readMulti(searchParams.style, AXIS_VALUES.style);
  const color = readMulti(searchParams.color, AXIS_VALUES.color);

  const rawQ = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  const q = rawQ?.trim() ? rawQ.trim() : undefined;

  const rawSort = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = (SORTS as string[]).includes(rawSort ?? '') ? (rawSort as SortKey) : 'newest';

  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(rawPage ?? '', 10);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return { type, niche, style, color, q, sort, page };
}

export function buildLayoutFilters(f: CatalogFilters) {
  const conditions: SQL[] = [eq(layouts.status, 'published')];
  if (f.type.length) conditions.push(inArray(layouts.type, f.type));
  if (f.niche.length) conditions.push(inArray(layouts.niche, f.niche));
  if (f.style.length) conditions.push(inArray(layouts.style, f.style));
  if (f.color.length) conditions.push(arrayOverlaps(layouts.colors, f.color));
  if (f.q) {
    conditions.push(or(ilike(layouts.title, `%${f.q}%`), ilike(layouts.description, `%${f.q}%`)) as SQL);
  }

  const orderBy = f.sort === 'oldest' ? asc(layouts.createdAt)
    : f.sort === 'title' ? asc(layouts.title)
    : desc(layouts.createdAt);

  return {
    conditions,
    where: and(...conditions),
    orderBy,
    limit: PAGE_SIZE,
    offset: (f.page - 1) * PAGE_SIZE,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/catalog-filters.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/filters.ts tests/catalog-filters.test.ts
git commit -m "feat: catalog filter parsing + query builder (pure, tested)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: SEO metadata + JSON-LD generators (pure)

**Files:**
- Create: `lib/seo/metadata.ts`, `lib/seo/jsonld.ts`, `lib/seo/index.ts`
- Test: `tests/seo.test.ts`

**Interfaces:**
- Consumes: nothing (pure; callers pass resolved values + `siteUrl`).
- Produces:
  - `buildLayoutMetadata(i: { title; description?: string | null; slug; ogImage?: string; keywords?: string[]; siteUrl: string }): Metadata`
  - `buildPackMetadata(i: { title; description?: string | null; slug; ogImage?: string; keywords?: string[]; siteUrl: string }): Metadata`
  - `productJsonLd(p: { name; description?: string | null; image?: string; url; offer?: { priceCents: number; currency?: string } })`
  - `itemListJsonLd(items: { name: string; url: string }[])`
  - `breadcrumbJsonLd(crumbs: { name: string; url: string }[])`
  - `lib/seo/index.ts` re-exports all of the above.

- [ ] **Step 1: Write the failing test**

```ts
// tests/seo.test.ts
import { describe, it, expect } from 'vitest';
import { buildLayoutMetadata, buildPackMetadata, productJsonLd, itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo';

const SITE = 'https://divi5lab.com';

describe('buildLayoutMetadata', () => {
  it('sets title, canonical, and OG image', () => {
    const m = buildLayoutMetadata({ title: 'Bold SaaS Hero', slug: 'bold-saas-hero', ogImage: 'https://img/x.png', siteUrl: SITE });
    expect(m.title).toBe('Bold SaaS Hero');
    expect(m.alternates?.canonical).toBe(`${SITE}/layouts/bold-saas-hero`);
    expect((m.openGraph as any)?.images?.[0]?.url).toBe('https://img/x.png');
  });

  it('falls back to a generated description when none given', () => {
    const m = buildLayoutMetadata({ title: 'Hero', slug: 'hero', siteUrl: SITE });
    expect(typeof m.description).toBe('string');
    expect((m.description as string).length).toBeGreaterThan(0);
  });
});

describe('buildPackMetadata', () => {
  it('canonicalizes to the packs path', () => {
    const m = buildPackMetadata({ title: '100 Landing Pages', slug: 'landing-100', siteUrl: SITE });
    expect(m.alternates?.canonical).toBe(`${SITE}/packs/landing-100`);
  });
});

describe('json-ld', () => {
  it('productJsonLd includes an offer when price is provided', () => {
    const ld = productJsonLd({ name: 'Pack', url: `${SITE}/packs/x`, offer: { priceCents: 4900 } });
    expect(ld['@type']).toBe('Product');
    expect((ld as any).offers.price).toBe('49.00');
    expect((ld as any).offers.priceCurrency).toBe('USD');
  });

  it('itemListJsonLd numbers positions from 1', () => {
    const ld = itemListJsonLd([{ name: 'a', url: 'u1' }, { name: 'b', url: 'u2' }]);
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].position).toBe(2);
  });

  it('breadcrumbJsonLd maps crumbs to ListItems', () => {
    const ld = breadcrumbJsonLd([{ name: 'Home', url: SITE }, { name: 'Browse', url: `${SITE}/browse` }]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement[1].item).toBe(`${SITE}/browse`);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/seo.test.ts`
Expected: FAIL — cannot find `@/lib/seo`.

- [ ] **Step 3: Write the implementations**

```ts
// lib/seo/metadata.ts
import type { Metadata } from 'next';

interface EntityMetaInput {
  title: string;
  description?: string | null;
  slug: string;
  ogImage?: string;
  keywords?: string[];
  siteUrl: string;
}

function baseMetadata(i: EntityMetaInput, canonical: string): Metadata {
  const description = i.description?.trim() || `Divi 5 layout: ${i.title}. Download-ready, validated, and ready to import.`;
  const images = i.ogImage ? [{ url: i.ogImage }] : [];
  return {
    title: i.title,
    description,
    keywords: i.keywords,
    alternates: { canonical },
    openGraph: { title: i.title, description, url: canonical, type: 'website', images },
    twitter: { card: 'summary_large_image', title: i.title, description, images: i.ogImage ? [i.ogImage] : [] },
  };
}

export function buildLayoutMetadata(i: EntityMetaInput): Metadata {
  return baseMetadata(i, `${i.siteUrl}/layouts/${i.slug}`);
}

export function buildPackMetadata(i: EntityMetaInput): Metadata {
  return baseMetadata(i, `${i.siteUrl}/packs/${i.slug}`);
}
```

```ts
// lib/seo/jsonld.ts
export function productJsonLd(p: {
  name: string;
  description?: string | null;
  image?: string;
  url: string;
  offer?: { priceCents: number; currency?: string };
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url: p.url,
  };
  if (p.description) base.description = p.description;
  if (p.image) base.image = p.image;
  if (p.offer) {
    base.offers = {
      '@type': 'Offer',
      price: (p.offer.priceCents / 100).toFixed(2),
      priceCurrency: p.offer.currency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: p.url,
    };
  }
  return base;
}

export function itemListJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}
```

```ts
// lib/seo/index.ts
export { buildLayoutMetadata, buildPackMetadata } from './metadata';
export { productJsonLd, itemListJsonLd, breadcrumbJsonLd } from './jsonld';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/seo tests/seo.test.ts
git commit -m "feat: SEO metadata + JSON-LD generators (pure, tested)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Sitemap builder (pure) + robots route

> The dynamic `app/sitemap.ts` route depends on query functions created in Task 6, so it is built there — not here. This task delivers the pure, fully-testable builder plus `app/robots.ts` (which needs only `env`), keeping the whole branch typecheck-clean at every commit.

**Files:**
- Create: `lib/seo/sitemap.ts`, `app/robots.ts`
- Modify: `lib/seo/index.ts` (re-export `sitemapEntries`)
- Test: `tests/sitemap.test.ts`

**Interfaces:**
- Consumes: `env.NEXT_PUBLIC_SITE_URL` (in `robots.ts`). The pure builder has no deps.
- Produces: `sitemapEntries(i: { siteUrl: string; layouts: { slug: string; publishedAt: Date | null }[]; packs: { slug: string; createdAt: Date }[] }): MetadataRoute.Sitemap`. (The `app/sitemap.ts` route that consumes this builder is created in Task 6.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/sitemap.test.ts
import { describe, it, expect } from 'vitest';
import { sitemapEntries } from '@/lib/seo/sitemap';

const SITE = 'https://divi5lab.com';

describe('sitemapEntries', () => {
  const out = sitemapEntries({
    siteUrl: SITE,
    layouts: [{ slug: 'a', publishedAt: new Date('2026-01-01') }, { slug: 'b', publishedAt: null }],
    packs: [{ slug: 'p1', createdAt: new Date('2026-02-01') }],
  });

  it('includes static marketing pages', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}`);
    expect(urls).toContain(`${SITE}/browse`);
    expect(urls).toContain(`${SITE}/pricing`);
  });

  it('includes every layout and pack url', () => {
    const urls = out.map((e) => e.url);
    expect(urls).toContain(`${SITE}/layouts/a`);
    expect(urls).toContain(`${SITE}/layouts/b`);
    expect(urls).toContain(`${SITE}/packs/p1`);
  });

  it('total = static(5) + 1 pack + 2 layouts', () => {
    expect(out).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/sitemap.test.ts`
Expected: FAIL — cannot find `@/lib/seo/sitemap`.

- [ ] **Step 3: Write the builder + robots route**

```ts
// lib/seo/sitemap.ts
import type { MetadataRoute } from 'next';

export function sitemapEntries(i: {
  siteUrl: string;
  layouts: { slug: string; publishedAt: Date | null }[];
  packs: { slug: string; createdAt: Date }[];
}): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: i.siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${i.siteUrl}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${i.siteUrl}/pricing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${i.siteUrl}/license`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${i.siteUrl}/about`, changeFrequency: 'yearly', priority: 0.3 },
  ];
  const packEntries: MetadataRoute.Sitemap = i.packs.map((p) => ({
    url: `${i.siteUrl}/packs/${p.slug}`,
    lastModified: p.createdAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
  const layoutEntries: MetadataRoute.Sitemap = i.layouts.map((l) => ({
    url: `${i.siteUrl}/layouts/${l.slug}`,
    lastModified: l.publishedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...staticPages, ...packEntries, ...layoutEntries];
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/api'] },
    sitemap: `${env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
```

Add to `lib/seo/index.ts`:

```ts
export { sitemapEntries } from './sitemap';
```

> The `app/sitemap.ts` route that calls `sitemapEntries` with live DB rows is created in Task 6, after its `listAllPublished*` query dependencies exist — that keeps the branch typecheck-clean at this commit.

- [ ] **Step 4: Run to verify the builder test passes**

Run: `npm run test -- tests/sitemap.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck (must stay clean)**

Run: `npm run typecheck`
Expected: PASS — no forward references; `app/robots.ts` and the builder resolve.

- [ ] **Step 6: Commit**

```bash
git add lib/seo/sitemap.ts lib/seo/index.ts app/robots.ts tests/sitemap.test.ts
git commit -m "feat: sitemap entry builder + robots route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Blob asset URL helper + idempotent seed

**Files:**
- Modify: `lib/blob/index.ts` (add `assetUrl`)
- Create: `db/seed.ts`
- Test: `tests/blob.test.ts` (extend), `tests/seed-data.test.ts`

**Interfaces:**
- Consumes: all catalog tables from Task 1.
- Produces:
  - `assetUrl(key: string): string` — returns `key` unchanged if it is already an absolute URL (`http(s)://…`), otherwise builds a Blob URL.
  - `buildSeedData(): { tags; layouts; packs; packLayouts; layoutTags }` — pure factory returning the rows to insert (exported for testing).
  - A runnable `db/seed.ts` (`npm run db:seed`) that upserts `buildSeedData()` idempotently.

- [ ] **Step 1: Write the failing tests**

Add to `tests/blob.test.ts` (keep the existing `uploadAsset` test):

```ts
import { assetUrl } from '@/lib/blob';

describe('assetUrl', () => {
  it('passes through absolute URLs (placeholder previews)', () => {
    expect(assetUrl('https://picsum.photos/seed/x/800/600')).toBe('https://picsum.photos/seed/x/800/600');
  });
  it('builds a blob url for a bare key', () => {
    expect(assetUrl('layouts/abc.png')).toContain('layouts/abc.png');
    expect(assetUrl('layouts/abc.png').startsWith('https://')).toBe(true);
  });
});
```

```ts
// tests/seed-data.test.ts
import { describe, it, expect } from 'vitest';
import { buildSeedData } from '@/db/seed';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('buildSeedData', () => {
  const data = buildSeedData();

  it('produces at least 12 published layouts with valid facet values', () => {
    expect(data.layouts.length).toBeGreaterThanOrEqual(12);
    for (const l of data.layouts) {
      expect(l.status).toBe('published');
      expect(l.validatorPassed).toBe(true);
      expect(AXIS_VALUES.type).toContain(l.type);
      expect(l.previewImageKeys.length).toBeGreaterThan(0);
    }
  });

  it('produces exactly one free pack and at least one paid pack', () => {
    expect(data.packs.filter((p) => p.kind === 'free')).toHaveLength(1);
    expect(data.packs.filter((p) => p.kind === 'paid').length).toBeGreaterThanOrEqual(1);
    for (const p of data.packs) expect(p.status).toBe('published');
  });

  it('has unique layout and pack slugs', () => {
    const ls = data.layouts.map((l) => l.slug);
    const ps = data.packs.map((p) => p.slug);
    expect(new Set(ls).size).toBe(ls.length);
    expect(new Set(ps).size).toBe(ps.length);
  });

  it('only references real layout/pack ids in join rows', () => {
    const layoutIds = new Set(data.layouts.map((l) => l.id));
    const packIds = new Set(data.packs.map((p) => p.id));
    for (const pl of data.packLayouts) {
      expect(packIds.has(pl.packId)).toBe(true);
      expect(layoutIds.has(pl.layoutId)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test -- tests/seed-data.test.ts tests/blob.test.ts`
Expected: FAIL — `assetUrl` / `buildSeedData` not exported.

- [ ] **Step 3: Add `assetUrl`**

In `lib/blob/index.ts`, append:

```ts
const BLOB_PUBLIC_BASE = 'https://blob.vercel-storage.com';

// Phase 1: seed stores absolute placeholder URLs directly; the pipeline will
// later store bare blob keys. assetUrl normalizes both to a renderable URL.
export function assetUrl(key: string): string {
  if (/^https?:\/\//.test(key)) return key;
  return `${BLOB_PUBLIC_BASE}/${key.replace(/^\/+/, '')}`;
}
```

- [ ] **Step 4: Write the seed**

```ts
// db/seed.ts
import { db } from './client';
import { layouts, packs, packLayouts, tags, layoutTags } from './schema';
import { AXIS_VALUES } from '@/lib/catalog/filters';

type LayoutSeed = typeof layouts.$inferInsert;
type PackSeed = typeof packs.$inferInsert;
type TagSeed = typeof tags.$inferInsert;
type PackLayoutSeed = typeof packLayouts.$inferInsert;
type LayoutTagSeed = typeof layoutTags.$inferInsert;

function preview(slug: string, n: number): string[] {
  return [0, 1, 2].map((i) => `https://picsum.photos/seed/${slug}-${i}/1200/${900 + i}`).slice(0, n);
}

// A deterministic spread across the four axes so every filter has matches.
const COMBOS: { type: string; niche: string; style: string; colors: string[] }[] = [
  { type: 'hero', niche: 'saas', style: 'minimal', colors: ['blue', 'monochrome'] },
  { type: 'hero', niche: 'agency', style: 'bold', colors: ['purple'] },
  { type: 'pricing', niche: 'saas', style: 'dark', colors: ['blue'] },
  { type: 'pricing', niche: 'ecommerce', style: 'corporate', colors: ['green'] },
  { type: 'testimonials', niche: 'coaching', style: 'elegant', colors: ['pastel'] },
  { type: 'cta', niche: 'fitness', style: 'bold', colors: ['red', 'orange'] },
  { type: 'features', niche: 'saas', style: 'minimal', colors: ['blue'] },
  { type: 'faq', niche: 'nonprofit', style: 'minimal', colors: ['green'] },
  { type: 'footer', niche: 'agency', style: 'dark', colors: ['monochrome'] },
  { type: 'header', niche: 'restaurant', style: 'elegant', colors: ['orange'] },
  { type: 'contact', niche: 'real_estate', style: 'corporate', colors: ['blue'] },
  { type: 'gallery', niche: 'portfolio', style: 'playful', colors: ['purple', 'pastel'] },
  { type: 'full_landing', niche: 'saas', style: 'bold', colors: ['blue', 'purple'] },
  { type: 'full_landing', niche: 'events', style: 'playful', colors: ['orange'] },
];

const TITLE_CASE: Record<string, string> = {
  saas: 'SaaS', cta: 'CTA', faq: 'FAQ', real_estate: 'Real Estate',
  ecommerce: 'E-commerce', full_landing: 'Full Landing Page',
};
function label(v: string): string {
  return TITLE_CASE[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

export function buildSeedData(): {
  tags: TagSeed[];
  layouts: LayoutSeed[];
  packs: PackSeed[];
  packLayouts: PackLayoutSeed[];
  layoutTags: LayoutTagSeed[];
} {
  // Tags across all four axes (used by Phase 6 landing pages).
  const tagRows: TagSeed[] = [];
  (['type', 'niche', 'style'] as const).forEach((axis) => {
    AXIS_VALUES[axis].forEach((slug) => {
      tagRows.push({ id: `tag_${axis}_${slug}`, axis, slug, title: label(slug) });
    });
  });
  AXIS_VALUES.color.forEach((slug) => {
    tagRows.push({ id: `tag_feature_${slug}`, axis: 'feature', slug, title: label(slug) });
  });

  const layoutRows: LayoutSeed[] = COMBOS.map((c, i) => {
    const slug = `${c.type}-${c.niche}-${c.style}-${i + 1}`;
    const title = `${label(c.style)} ${label(c.niche)} ${label(c.type)}`;
    const description = `A ${c.style} ${label(c.type)} section designed for ${label(c.niche)} sites. Validated Divi 5 layout, ready to import.`;
    return {
      id: `layout_${i + 1}`,
      slug,
      title,
      description,
      type: c.type,
      niche: c.niche,
      style: c.style,
      colors: c.colors,
      diviJsonBlobKey: `layouts/${slug}.json`,
      previewImageKeys: preview(slug, 3),
      contentHash: `seed-hash-${i + 1}`,
      validatorPassed: true,
      seo: {
        metaTitle: `${title} — Divi 5 Layout`,
        metaDescription: description,
        keywords: [c.type, c.niche, c.style, 'divi 5', 'layout'],
      },
      status: 'published',
      publishedAt: new Date('2026-06-01T00:00:00Z'),
    };
  });

  const packRows: PackSeed[] = [
    {
      id: 'pack_free_heroes', slug: 'free-hero-starter', title: 'Free Hero Starter',
      description: 'A free taste of the library: hero sections to drop into any Divi 5 site.',
      kind: 'free', priceCents: 0, coverImageKey: 'https://picsum.photos/seed/pack-free/1200/800',
      seo: { metaTitle: 'Free Hero Starter Pack', metaDescription: 'Free Divi 5 hero sections.' },
      status: 'published',
    },
    {
      id: 'pack_saas', slug: 'saas-conversion-kit', title: 'SaaS Conversion Kit',
      description: 'Pricing, features, CTAs and full landing pages tuned for SaaS conversions.',
      kind: 'paid', priceCents: 4900, coverImageKey: 'https://picsum.photos/seed/pack-saas/1200/800',
      seo: { metaTitle: 'SaaS Conversion Kit', metaDescription: 'Divi 5 layouts for SaaS.' },
      status: 'published',
    },
    {
      id: 'pack_agency', slug: 'agency-essentials', title: 'Agency Essentials',
      description: 'Bold hero, footer and gallery sections for agencies and portfolios.',
      kind: 'paid', priceCents: 3900, coverImageKey: 'https://picsum.photos/seed/pack-agency/1200/800',
      seo: { metaTitle: 'Agency Essentials', metaDescription: 'Divi 5 layouts for agencies.' },
      status: 'published',
    },
  ];

  // Assign layouts to packs by niche/type.
  const packLayoutRows: PackLayoutSeed[] = [];
  const pushPL = (packId: string, predicate: (l: LayoutSeed) => boolean) => {
    layoutRows.filter(predicate).forEach((l, pos) =>
      packLayoutRows.push({ packId, layoutId: l.id!, position: pos }));
  };
  pushPL('pack_free_heroes', (l) => l.type === 'hero');
  pushPL('pack_saas', (l) => l.niche === 'saas');
  pushPL('pack_agency', (l) => l.niche === 'agency' || l.niche === 'portfolio');

  // Tag each layout on its three primary axes.
  const layoutTagRows: LayoutTagSeed[] = [];
  layoutRows.forEach((l) => {
    layoutTagRows.push({ layoutId: l.id!, tagId: `tag_type_${l.type}` });
    if (l.niche) layoutTagRows.push({ layoutId: l.id!, tagId: `tag_niche_${l.niche}` });
    if (l.style) layoutTagRows.push({ layoutId: l.id!, tagId: `tag_style_${l.style}` });
  });

  return { tags: tagRows, layouts: layoutRows, packs: packRows, packLayouts: packLayoutRows, layoutTags: layoutTagRows };
}

async function main() {
  const data = buildSeedData();
  // Idempotent: upsert parents, then replace join rows.
  await db.insert(tags).values(data.tags).onConflictDoNothing();
  await db.insert(layouts).values(data.layouts)
    .onConflictDoUpdate({ target: layouts.slug, set: { status: layouts.status } });
  await db.insert(packs).values(data.packs)
    .onConflictDoUpdate({ target: packs.slug, set: { status: packs.status } });
  await db.insert(packLayouts).values(data.packLayouts).onConflictDoNothing();
  await db.insert(layoutTags).values(data.layoutTags).onConflictDoNothing();
  console.log(`Seeded ${data.layouts.length} layouts, ${data.packs.length} packs, ${data.tags.length} tags.`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 5: Run to verify tests pass**

Run: `npm run test -- tests/seed-data.test.ts tests/blob.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no forward references remain (the sitemap route is created in Task 6).

- [ ] **Step 7: Commit**

```bash
git add lib/blob/index.ts db/seed.ts tests/blob.test.ts tests/seed-data.test.ts
git commit -m "feat: blob assetUrl helper + idempotent catalog seed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Catalog query layer + sitemap route

**Files:**
- Create: `lib/catalog/queries.ts`, `lib/catalog/index.ts`, `app/sitemap.ts`
- Test: `tests/catalog-queries.test.ts`

**Interfaces:**
- Consumes: `db` (`@/db/client`), catalog tables, `buildLayoutFilters`/`CatalogFilters` (Task 2), `sitemapEntries` + `env` (Task 4) for the route.
- Produces (all return only `published` rows):
  - `type LayoutRow = typeof layouts.$inferSelect`, `type PackRow = typeof packs.$inferSelect`
  - `listLayouts(f: CatalogFilters): Promise<LayoutRow[]>`
  - `getLayoutBySlug(slug: string): Promise<LayoutRow | null>`
  - `listPacks(): Promise<PackRow[]>`
  - `getPackBySlug(slug: string): Promise<PackRow | null>`
  - `getLayoutsForPack(packId: string): Promise<LayoutRow[]>`
  - `getPacksForLayout(layoutId: string): Promise<PackRow[]>`
  - `facetCounts(): Promise<Record<'type'|'niche'|'style'|'color', Record<string, number>>>`
  - `listAllPublishedLayoutSlugs(): Promise<{ slug: string; publishedAt: Date | null }[]>`
  - `listAllPublishedPackSlugs(): Promise<{ slug: string; createdAt: Date }[]>`
  - `lib/catalog/index.ts` re-exports `filters.ts` + `queries.ts`.

- [ ] **Step 1: Write the integration test (gated on DATABASE_URL)**

```ts
// tests/catalog-queries.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { parseFilters } from '@/lib/catalog/filters';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('catalog queries (integration — needs a seeded DATABASE_URL)', () => {
  let q: typeof import('@/lib/catalog/queries');

  beforeAll(async () => {
    q = await import('@/lib/catalog/queries');
  });

  it('listLayouts returns only published rows', async () => {
    const rows = await q.listLayouts(parseFilters({}));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.status).toBe('published');
  });

  it('narrows by a facet', async () => {
    const all = await q.listLayouts(parseFilters({}));
    const heroes = await q.listLayouts(parseFilters({ type: 'hero' }));
    expect(heroes.length).toBeLessThanOrEqual(all.length);
    for (const r of heroes) expect(r.type).toBe('hero');
  });

  it('getLayoutBySlug returns null for an unknown slug', async () => {
    expect(await q.getLayoutBySlug('does-not-exist')).toBeNull();
  });

  it('facetCounts reports counts per axis value', async () => {
    const counts = await q.facetCounts();
    expect(Object.values(counts.type).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it is wired (skips without a DB)**

Run: `npm run test -- tests/catalog-queries.test.ts`
Expected: PASS-as-skipped when `DATABASE_URL` is unset (0 failures). With a seeded DB set, the assertions run and pass.

- [ ] **Step 3: Write the query layer**

```ts
// lib/catalog/queries.ts
import { and, eq, asc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts, packs, packLayouts } from '@/db/schema';
import { buildLayoutFilters, type CatalogFilters } from './filters';

export type LayoutRow = typeof layouts.$inferSelect;
export type PackRow = typeof packs.$inferSelect;

export async function listLayouts(f: CatalogFilters): Promise<LayoutRow[]> {
  const { where, orderBy, limit, offset } = buildLayoutFilters(f);
  return db.select().from(layouts).where(where).orderBy(orderBy).limit(limit).offset(offset);
}

export async function getLayoutBySlug(slug: string): Promise<LayoutRow | null> {
  const rows = await db.select().from(layouts)
    .where(and(eq(layouts.slug, slug), eq(layouts.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function listPacks(): Promise<PackRow[]> {
  return db.select().from(packs).where(eq(packs.status, 'published')).orderBy(asc(packs.title));
}

export async function getPackBySlug(slug: string): Promise<PackRow | null> {
  const rows = await db.select().from(packs)
    .where(and(eq(packs.slug, slug), eq(packs.status, 'published'))).limit(1);
  return rows[0] ?? null;
}

export async function getLayoutsForPack(packId: string): Promise<LayoutRow[]> {
  const rows = await db.select({ layout: layouts }).from(packLayouts)
    .innerJoin(layouts, eq(packLayouts.layoutId, layouts.id))
    .where(and(eq(packLayouts.packId, packId), eq(layouts.status, 'published')))
    .orderBy(asc(packLayouts.position));
  return rows.map((r) => r.layout);
}

export async function getPacksForLayout(layoutId: string): Promise<PackRow[]> {
  const rows = await db.select({ pack: packs }).from(packLayouts)
    .innerJoin(packs, eq(packLayouts.packId, packs.id))
    .where(and(eq(packLayouts.layoutId, layoutId), eq(packs.status, 'published')))
    .orderBy(asc(packs.title));
  return rows.map((r) => r.pack);
}

export async function facetCounts(): Promise<Record<'type' | 'niche' | 'style' | 'color', Record<string, number>>> {
  const rows = await db.select({
    type: layouts.type, niche: layouts.niche, style: layouts.style, colors: layouts.colors,
  }).from(layouts).where(eq(layouts.status, 'published'));

  const counts = { type: {}, niche: {}, style: {}, color: {} } as Record<'type' | 'niche' | 'style' | 'color', Record<string, number>>;
  const bump = (axis: 'type' | 'niche' | 'style' | 'color', key: string | null) => {
    if (!key) return;
    counts[axis][key] = (counts[axis][key] ?? 0) + 1;
  };
  for (const r of rows) {
    bump('type', r.type);
    bump('niche', r.niche);
    bump('style', r.style);
    for (const c of r.colors ?? []) bump('color', c);
  }
  return counts;
}

export async function listAllPublishedLayoutSlugs(): Promise<{ slug: string; publishedAt: Date | null }[]> {
  return db.select({ slug: layouts.slug, publishedAt: layouts.publishedAt })
    .from(layouts).where(eq(layouts.status, 'published'));
}

export async function listAllPublishedPackSlugs(): Promise<{ slug: string; createdAt: Date }[]> {
  return db.select({ slug: packs.slug, createdAt: packs.createdAt })
    .from(packs).where(eq(packs.status, 'published'));
}
```

```ts
// lib/catalog/index.ts
export * from './filters';
export * from './queries';
```

- [ ] **Step 4: Wire the dynamic sitemap route (its query deps now exist)**

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { listAllPublishedLayoutSlugs, listAllPublishedPackSlugs } from '@/lib/catalog/queries';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [layouts, packs] = await Promise.all([
    listAllPublishedLayoutSlugs(),
    listAllPublishedPackSlugs(),
  ]);
  return sitemapEntries({ siteUrl: env.NEXT_PUBLIC_SITE_URL, layouts, packs });
}
```

- [ ] **Step 5: Full typecheck (sitemap route + queries resolve)**

Run: `npm run typecheck`
Expected: PASS — `app/sitemap.ts` resolves its imports.

- [ ] **Step 6: Run the suite**

Run: `npm run test`
Expected: PASS — filters, seo, sitemap, seed-data, blob, db green; catalog-queries skips without a DB.

- [ ] **Step 7: Commit**

```bash
git add lib/catalog/queries.ts lib/catalog/index.ts app/sitemap.ts tests/catalog-queries.test.ts
git commit -m "feat: catalog query layer (published-only) + facet counts + sitemap route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Presentational components

**Files:**
- Create: `components/JsonLd.tsx`, `components/Breadcrumbs.tsx`, `components/LayoutCard.tsx`, `components/PackCard.tsx`, `components/FacetFilters.tsx`, `components/SearchSort.tsx`, `components/ScreenshotGallery.tsx`
- Test: `tests/components.test.tsx`
- Modify: `vitest.config.ts` (add a jsdom project for `.test.tsx`), `package.json` (add `@testing-library/react`, `jsdom` dev deps)

**Interfaces:**
- Consumes: `LayoutRow`/`PackRow` (Task 6), `assetUrl` (Task 5), `AXIS_VALUES` (Task 2).
- Produces: the components above. `JsonLd` and `Breadcrumbs` are pure/server; `FacetFilters` and `SearchSort` are client components that update URL query params; `LayoutCard`/`PackCard` render `next/image` thumbnails; `ScreenshotGallery` is a client component with a lightbox.

- [ ] **Step 1: Add jsdom test deps + a tsx test project**

Run: `npm install -D @testing-library/react jsdom`

Replace `vitest.config.ts` with (uses `environmentMatchGlobs`, valid in Vitest 2.x; `globals: true` enables React Testing Library auto-cleanup):

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    // .test.tsx files render React components → run them under jsdom.
    environmentMatchGlobs: [['tests/**/*.test.tsx', 'jsdom']],
    globals: true,
  },
});
```

> The existing node test files (`env`, `auth`, `db`, `blob`, …) import `describe/it/expect` explicitly, so `globals: true` is additive and does not break them.

- [ ] **Step 2: Write the failing component test**

```tsx
// tests/components.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LayoutCard } from '@/components/LayoutCard';

const layout = {
  id: 'l1', slug: 'bold-saas-hero', title: 'Bold SaaS Hero', description: 'desc',
  type: 'hero', niche: 'saas', style: 'bold', colors: ['blue'],
  diviJsonBlobKey: 'k.json', previewImageKeys: ['https://picsum.photos/seed/x/800/600'],
  contentHash: 'h', perceptualHash: null, validatorPassed: true, seo: null,
  status: 'published', createdAt: new Date(), publishedAt: new Date(),
} as any;

describe('components', () => {
  it('JsonLd renders a ld+json script with the payload', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Product', name: 'X' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script!.innerHTML).toContain('"Product"');
  });

  it('Breadcrumbs renders each crumb label', () => {
    const { getByText } = render(<Breadcrumbs crumbs={[{ name: 'Home', url: '/' }, { name: 'Browse', url: '/browse' }]} />);
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Browse')).toBeTruthy();
  });

  it('LayoutCard links to the layout detail page and shows the title', () => {
    const { getByText, container } = render(<LayoutCard layout={layout} />);
    expect(getByText('Bold SaaS Hero')).toBeTruthy();
    expect(container.querySelector('a[href="/layouts/bold-saas-hero"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/components.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 4: Write the components**

```tsx
// components/JsonLd.tsx
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
```

```tsx
// components/Breadcrumbs.tsx
import Link from 'next/link';

export function Breadcrumbs({ crumbs }: { crumbs: { name: string; url: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex flex-wrap gap-1">
        {crumbs.map((c, i) => (
          <li key={c.url} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {i < crumbs.length - 1
              ? <Link href={c.url} className="hover:underline">{c.name}</Link>
              : <span aria-current="page" className="text-gray-700">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

```tsx
// components/LayoutCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import type { LayoutRow } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';

export function LayoutCard({ layout }: { layout: LayoutRow }) {
  const cover = layout.previewImageKeys[0];
  return (
    <Link href={`/layouts/${layout.slug}`} className="group block overflow-hidden rounded-lg border border-gray-200 transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gray-100">
        {cover && (
          <Image src={assetUrl(cover)} alt={layout.title} fill sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition group-hover:scale-[1.02]" />
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-gray-900">{layout.title}</h3>
        <p className="mt-1 text-xs text-gray-500">{layout.type} · {layout.niche} · {layout.style}</p>
      </div>
    </Link>
  );
}
```

```tsx
// components/PackCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import type { PackRow } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';

export function PackCard({ pack }: { pack: PackRow }) {
  const price = pack.kind === 'free' ? 'Free'
    : pack.priceCents != null ? `$${(pack.priceCents / 100).toFixed(0)}` : '';
  return (
    <Link href={`/packs/${pack.slug}`} className="group block overflow-hidden rounded-lg border border-gray-200 transition hover:shadow-md">
      <div className="relative aspect-[3/2] bg-gray-100">
        {pack.coverImageKey && (
          <Image src={assetUrl(pack.coverImageKey)} alt={pack.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
        )}
      </div>
      <div className="flex items-center justify-between p-3">
        <h3 className="truncate text-sm font-medium text-gray-900">{pack.title}</h3>
        <span className="ml-2 shrink-0 text-sm font-semibold text-gray-700">{price}</span>
      </div>
    </Link>
  );
}
```

```tsx
// components/FacetFilters.tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AXIS_VALUES } from '@/lib/catalog/filters';

const AXES: { key: keyof typeof AXIS_VALUES; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'niche', label: 'Industry' },
  { key: 'style', label: 'Style' },
  { key: 'color', label: 'Color' },
];

export function FacetFilters({ counts }: { counts: Record<string, Record<string, number>> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const toggle = (axis: string, value: string) => {
    const current = new Set((params.get(axis)?.split(',') ?? []).filter(Boolean));
    if (current.has(value)) current.delete(value); else current.add(value);
    const next = new URLSearchParams(params.toString());
    if (current.size) next.set(axis, [...current].join(',')); else next.delete(axis);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <aside className="space-y-6">
      {AXES.map(({ key, label }) => {
        const selected = new Set((params.get(key)?.split(',') ?? []).filter(Boolean));
        return (
          <fieldset key={key}>
            <legend className="mb-2 text-sm font-semibold text-gray-900">{label}</legend>
            <ul className="space-y-1">
              {AXIS_VALUES[key].map((value) => (
                <li key={value}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={selected.has(value)} onChange={() => toggle(key, value)} />
                    <span className="capitalize">{value.replace('_', ' ')}</span>
                    <span className="ml-auto text-xs text-gray-400">{counts[key]?.[value] ?? 0}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </aside>
  );
}
```

```tsx
// components/SearchSort.tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SearchSort() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={(fd) => update('q', String(fd.get('q') ?? ''))} className="flex-1">
        <input name="q" defaultValue={params.get('q') ?? ''} placeholder="Search layouts…"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </form>
      <select value={params.get('sort') ?? 'newest'} onChange={(e) => update('sort', e.target.value)}
        className="rounded border border-gray-300 px-2 py-2 text-sm">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="title">Title A–Z</option>
      </select>
    </div>
  );
}
```

```tsx
// components/ScreenshotGallery.tsx
'use client';
import { useState } from 'react';
import Image from 'next/image';
import { assetUrl } from '@/lib/blob';

export function ScreenshotGallery({ keys, title }: { keys: string[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (!keys.length) return null;
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {keys.map((k, i) => (
          <button key={k} onClick={() => setActive(i)} className="relative aspect-[4/3] overflow-hidden rounded border border-gray-200">
            <Image src={assetUrl(k)} alt={`${title} screenshot ${i + 1}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </button>
        ))}
      </div>
      {active !== null && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setActive(null)}>
          <div className="relative h-[80vh] w-full max-w-5xl">
            <Image src={assetUrl(keys[active])} alt={`${title} full`} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify component tests pass**

Run: `npm run test -- tests/components.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components tests/components.test.tsx vitest.config.ts package.json package-lock.json
git commit -m "feat: catalog presentational components + dom test project

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `/browse` page

**Files:**
- Create: `app/(catalog)/browse/page.tsx`

**Interfaces:**
- Consumes: `parseFilters`, `listLayouts`, `facetCounts` (Tasks 2, 6); `FacetFilters`, `SearchSort`, `LayoutCard` (Task 7).
- Produces: the `/browse` route — server-rendered faceted grid.

- [ ] **Step 1: Write the page**

```tsx
// app/(catalog)/browse/page.tsx
import type { Metadata } from 'next';
import { parseFilters } from '@/lib/catalog/filters';
import { listLayouts, facetCounts } from '@/lib/catalog/queries';
import { FacetFilters } from '@/components/FacetFilters';
import { SearchSort } from '@/components/SearchSort';
import { LayoutCard } from '@/components/LayoutCard';

export const metadata: Metadata = {
  title: 'Browse Divi 5 Layouts',
  description: 'Browse and filter validated Divi 5 layouts by type, industry, style and color.',
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [layouts, counts] = await Promise.all([listLayouts(filters), facetCounts()]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Browse layouts</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <FacetFilters counts={counts} />
        <section>
          <div className="mb-4"><SearchSort /></div>
          {layouts.length === 0 ? (
            <p className="py-16 text-center text-gray-500">No layouts match these filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + build the route**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(catalog)/browse/page.tsx"
git commit -m "feat: /browse faceted catalog page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `/layouts/[slug]` page

**Files:**
- Create: `app/(catalog)/layouts/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getLayoutBySlug`, `getPacksForLayout` (Task 6); `buildLayoutMetadata`, `productJsonLd`, `breadcrumbJsonLd` (Task 3); `assetUrl` (Task 5); `ScreenshotGallery`, `Breadcrumbs`, `JsonLd`, `PackCard` (Task 7); `env`.
- Produces: the `/layouts/[slug]` route with `generateMetadata`, gallery, packs-it-belongs-to, and JSON-LD.

- [ ] **Step 1: Write the page**

```tsx
// app/(catalog)/layouts/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getLayoutBySlug, getPacksForLayout } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildLayoutMetadata, productJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { PackCard } from '@/components/PackCard';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const layout = await getLayoutBySlug(slug);
  if (!layout) return {};
  return buildLayoutMetadata({
    title: layout.seo?.metaTitle ?? layout.title,
    description: layout.seo?.metaDescription ?? layout.description,
    slug: layout.slug,
    ogImage: layout.previewImageKeys[0] ? assetUrl(layout.previewImageKeys[0]) : undefined,
    keywords: layout.seo?.keywords,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
}

export default async function LayoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const layout = await getLayoutBySlug(slug);
  if (!layout) notFound();

  const packs = await getPacksForLayout(layout.id);
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/layouts/${layout.slug}`;
  const cover = layout.previewImageKeys[0] ? assetUrl(layout.previewImageKeys[0]) : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Browse', url: `${site}/browse` }, { name: layout.title, url }]} />
      <JsonLd data={productJsonLd({ name: layout.title, description: layout.description, image: cover, url })} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Browse', url: `${site}/browse` }, { name: layout.title, url }])} />

      <h1 className="mt-4 text-2xl font-semibold">{layout.title}</h1>
      <p className="mt-1 text-sm text-gray-500">{layout.type} · {layout.niche} · {layout.style}</p>
      {layout.description && <p className="mt-3 max-w-2xl text-gray-700">{layout.description}</p>}

      <div className="mt-6"><ScreenshotGallery keys={layout.previewImageKeys} title={layout.title} /></div>

      {packs.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Included in these packs</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => <PackCard key={p.id} pack={p} />)}
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(catalog)/layouts/[slug]/page.tsx"
git commit -m "feat: /layouts/[slug] detail page with gallery + JSON-LD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `/packs/[slug]` page

**Files:**
- Create: `app/(catalog)/packs/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getPackBySlug`, `getLayoutsForPack` (Task 6); `buildPackMetadata`, `productJsonLd`, `itemListJsonLd`, `breadcrumbJsonLd` (Task 3); `assetUrl` (Task 5); `LayoutCard`, `Breadcrumbs`, `JsonLd` (Task 7); `env`.
- Produces: the `/packs/[slug]` route with metadata, included-layouts grid, price + CTA stub, and JSON-LD.

- [ ] **Step 1: Write the page**

```tsx
// app/(catalog)/packs/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getPackBySlug, getLayoutsForPack } from '@/lib/catalog/queries';
import { assetUrl } from '@/lib/blob';
import { buildPackMetadata, productJsonLd, itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { LayoutCard } from '@/components/LayoutCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) return {};
  return buildPackMetadata({
    title: pack.seo?.metaTitle ?? pack.title,
    description: pack.seo?.metaDescription ?? pack.description,
    slug: pack.slug,
    ogImage: pack.coverImageKey ? assetUrl(pack.coverImageKey) : undefined,
    keywords: pack.seo?.keywords,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  const layouts = await getLayoutsForPack(pack.id);
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/packs/${pack.slug}`;
  const price = pack.kind === 'free' ? 'Free' : pack.priceCents != null ? `$${(pack.priceCents / 100).toFixed(0)}` : '';

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs crumbs={[{ name: 'Home', url: site }, { name: 'Pricing', url: `${site}/pricing` }, { name: pack.title, url }]} />
      <JsonLd data={productJsonLd({
        name: pack.title, description: pack.description, image: pack.coverImageKey ? assetUrl(pack.coverImageKey) : undefined, url,
        offer: pack.priceCents != null ? { priceCents: pack.priceCents } : undefined,
      })} />
      <JsonLd data={itemListJsonLd(layouts.map((l) => ({ name: l.title, url: `${site}/layouts/${l.slug}` })))} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site }, { name: 'Pricing', url: `${site}/pricing` }, { name: pack.title, url }])} />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{pack.title}</h1>
          {pack.description && <p className="mt-2 max-w-2xl text-gray-700">{pack.description}</p>}
          <p className="mt-1 text-sm text-gray-500">{layouts.length} layouts</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{price}</div>
          {/* Commerce is Phase 4 — CTA is a stub link to pricing. */}
          <Link href="/pricing" className="mt-2 inline-block rounded bg-black px-4 py-2 text-sm text-white">
            {pack.kind === 'free' ? 'Get this pack' : 'Buy this pack'}
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">What&apos;s inside</h2>
        {layouts.length === 0 ? (
          <p className="text-gray-500">No layouts in this pack yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layouts.map((l) => <LayoutCard key={l.id} layout={l} />)}
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(catalog)/packs/[slug]/page.tsx"
git commit -m "feat: /packs/[slug] detail page with ItemList JSON-LD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Image host config, e2e smoke, and Phase 1 acceptance

**Files:**
- Modify: `next.config.mjs` (allow the placeholder image host)
- Create: `e2e/catalog.spec.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a green full verification pass for Phase 1.

- [ ] **Step 1: Allow the placeholder image host**

Replace `next.config.mjs` with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Preview screenshots are served from Vercel Blob (pipeline output).
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'blob.vercel-storage.com' },
      // Phase 1 seed previews (placeholder image service).
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Write the e2e smoke (gated on a seeded DB at runtime)**

```ts
// e2e/catalog.spec.ts
import { test, expect } from '@playwright/test';

// These run against `npm run dev`; they require a seeded DATABASE_URL.
// Skipped in environments without one.
test.skip(!process.env.DATABASE_URL, 'needs a seeded DATABASE_URL');

test('browse renders layout cards and filtering narrows results', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.getByRole('heading', { name: 'Browse layouts' })).toBeVisible();
  const cards = page.locator('a[href^="/layouts/"]');
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();

  await page.getByLabel('Hero', { exact: false }).first().check();
  await expect(page).toHaveURL(/type=hero/);
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(total);
});

test('layout detail renders a gallery and JSON-LD', async ({ page }) => {
  await page.goto('/browse');
  await page.locator('a[href^="/layouts/"]').first().click();
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

- [ ] **Step 3: Full unit suite**

Run: `npm run test`
Expected: PASS — node project (filters, seo, sitemap, seed-data, blob, db) + dom project (components) green; catalog-queries skips without a DB.

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: PASS — `/browse`, `/layouts/[slug]`, `/packs/[slug]`, `/sitemap.xml`, `/robots.txt` all compile.

- [ ] **Step 6: Live DB smoke (requires DATABASE_URL provisioned)**

Run:
```bash
npm run db:migrate
npm run db:seed
npm run db:seed   # second run must not error or duplicate (idempotency)
npm run dev       # then visit /browse, filter, open a layout and a pack
```
Expected: migrate applies all tables; seed reports ~14 layouts/3 packs; the second seed succeeds with no duplicate-key error; `/browse` shows cards, facets narrow results, detail pages render with screenshots.

- [ ] **Step 7: e2e smoke (with the dev server + seeded DB)**

Run: `npm run test:e2e -- catalog.spec.ts`
Expected: PASS when `DATABASE_URL` is set and seeded; skipped otherwise.

- [ ] **Step 8: Commit + tag**

```bash
git add next.config.mjs e2e/catalog.spec.ts
git commit -m "test: catalog e2e smoke + placeholder image host

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag phase-1-complete
```

---

## Notes / external prerequisites (user-provided)

- **`DATABASE_URL`** (Vercel Postgres) gates `db:migrate`, `db:seed`, the
  integration tests, and the e2e smoke. Pure unit tests + build run without it.
- No new third-party services are introduced in Phase 1. Placeholder previews
  use `picsum.photos`; real screenshots arrive from the Phase 3 pipeline and are
  served from Blob (already whitelisted).

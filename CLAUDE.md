# Divi5Lab — Divi 5 Layout Marketplace — Claude Code Instructions

> Brand: **Divi5Lab** · domain: **divi5lab.com**. (The local dev database keeps the
> legacy identifier `layoutlab` — see `docker-compose.yml` — to avoid recreating it.)

---

## 0. Read this first

You are building a **marketplace that sells AI-generated Divi 5 layouts** as
downloadable JSON, plus the **automated pipeline that generates, screenshots,
SEO-optimizes, and publishes those layouts at scale**.

This repo has **two halves that talk only through a single ingest API**:

1. **The web app** (`app/`, `components/`, `lib/`, `db/`) — a Next.js (App Router)
   storefront on Vercel. Catalog, accounts, Stripe checkout, downloads, admin,
   programmatic SEO.
2. **The generation pipeline** (`pipeline/`) — a standalone TypeScript
   orchestrator. It runs Claude → the deterministic validator → a local Docker
   WordPress+Divi render env → Playwright screenshots → uploads to Blob → POSTs
   to the web app's protected ingest API, where layouts land as `pending`.

**The deterministic validator is the quality gate.** It lives in the sibling
repo `../Divi 5 Deterministic Validator` (the "AI Editor for Divi 5" project).
We never ship a layout that fails validation. We never reimplement the validator
in JS — we call it.

### Working with the Superpowers plugin

This project uses the **Superpowers** plugin. Honor it:

- **`brainstorming`** before any new feature or subsystem — explore intent first.
- **`writing-plans`** to turn a spec/phase into a concrete implementation plan.
- **`test-driven-development`** for all non-trivial logic (commerce, entitlements,
  pipeline steps, SEO generators). Write the test first.
- **`systematic-debugging`** for any bug or unexpected behavior.
- **`using-git-worktrees`** for isolated feature work.
- **`requesting-code-review`** before merging anything substantial.
- **`verification-before-completion`** — never claim done without running the
  verification command and showing output.

Instruction priority: **user's explicit instructions > Superpowers skills >
default behavior.** This file is the user's instructions for this project.

---

## 1. Mission & business model

Sell Divi 5 layouts to WordPress/Divi users. Two product shapes, one catalog:

- **Free packs** — lead magnets (e.g. "50 Divi 5 Hero Sections"). Download is
  gated behind an **email capture** that pushes the contact to Loops.
- **Paid packs** — one-time purchases (e.g. "100 Conversion Landing Pages").
- **All-access membership** — a Stripe **subscription** that unlocks the entire
  library while active.

The unit sold is the **pack** (a curated collection of layouts). The atomic
content unit is the **layout** (one Divi 5 JSON export + its preview images +
SEO metadata). A layout can belong to multiple packs.

### What a buyer receives

A **downloadable Divi 5 layout JSON file** (per layout) plus a bundled
`LICENSE.txt`. Delivery is via **signed, expiring download URLs** that check the
buyer's entitlement. No live/interactive demos — buyers evaluate via **high-res
screenshots with lightbox zoom**.

### Licensing

**One simple commercial license** for every purchase: the buyer may use the
layout on unlimited sites they own or build for clients; **resale or
redistribution of the layout files is prohibited.** The license text is shown at
checkout and bundled inside every download. (Full text lives in
`lib/license/commercial-license.txt` — see TODO in §17.)

---

## 2. Hard constraints — do not violate

1. **Never reimplement the deterministic validator in JavaScript.** Call the real
   PHP validator (see §9). Same input → same verdict is the entire trust model.
2. **Never publish a layout that fails validation.** Validation is a mandatory
   pipeline step; the ingest API re-checks the validator verdict flag and rejects
   anything not marked validated.
3. **No invented Divi schema.** All layout JSON comes from real generation +
   validation, never hand-authored block types from memory.
4. **Generated layouts are never auto-live.** They land as `pending` and require
   **one-click admin approval** before `published` (see §11). Auto-QA can flag,
   never auto-approve.
5. **Downloads require a valid entitlement.** No public/un-signed URLs to paid
   layout JSON or full-res assets. Free-pack downloads require a captured email.
6. **Secrets never reach the client bundle.** Stripe secret key, ingest token,
   `ANTHROPIC_API_KEY`, DB URL, Blob token are server-only.
7. **The pipeline is idempotent and resumable.** Re-running must not create
   duplicates (dedupe by content hash) or double-charge API calls already done.
8. **Money code is tested first (TDD) and never trusts the client.** Prices,
   entitlements, and webhook handling are server-authoritative.

---

## 3. Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router)**, TypeScript, React Server Components |
| Hosting | **Vercel** |
| Database | **Vercel Postgres** |
| ORM | **Drizzle ORM** (typed schema in `db/schema.ts`, migrations via drizzle-kit) |
| Auth | **Auth.js (NextAuth v5)** — email/password + magic link; OAuth optional later |
| File/asset storage | **Vercel Blob** (layout JSON + preview images), signed URLs |
| Payments | **Stripe** — Checkout for one-off packs + subscription; webhooks for fulfillment; **Stripe Tax** for VAT/sales-tax |
| Transactional email | **Resend** (receipts, download links, magic links) |
| Marketing email | **Loops** (newsletters, free-pack capture lists, broadcasts) |
| Styling | **Tailwind CSS** + a small component layer (`components/`) |
| Screenshots | **Playwright** (in the pipeline) |
| Render env | This repo's sibling **Docker WP+Divi** (`make up` in the validator repo) |
| AI generation | **Anthropic Claude** via the official SDK (pipeline only, server-side) |
| Testing | **Vitest** (unit/integration) + **Playwright** (e2e smoke) |
| Analytics | **Vercel Analytics** + privacy-friendly events; GA4 optional |

Keep dependencies lean. Prefer platform-native (Vercel) services to reduce
vendor sprawl.

---

## 4. Directory structure

```
layoutlab/
├── CLAUDE.md                 # this file
├── README.md
├── package.json
├── tsconfig.json
├── next.config.mjs
├── drizzle.config.ts
├── .env.example              # every env var, documented, no secrets
├── app/                      # Next.js App Router
│   ├── (marketing)/          # home, pricing, about, license
│   ├── (catalog)/            # browse, layout & pack detail, taxonomy pages
│   ├── (account)/            # login, dashboard, purchases, downloads
│   ├── admin/                # role-gated approval queue + management
│   ├── api/                  # route handlers (stripe webhook, ingest, download)
│   ├── sitemap.ts            # dynamic sitemap
│   ├── robots.ts
│   └── layout.tsx
├── components/               # shared UI (cards, filters, lightbox, etc.)
├── db/
│   ├── schema.ts             # Drizzle schema (§6)
│   ├── migrations/
│   └── seed.ts
├── lib/
│   ├── auth/                 # Auth.js config
│   ├── stripe/               # checkout, webhook handlers, entitlements
│   ├── blob/                 # upload + signed-URL helpers
│   ├── email/                # Resend + Loops clients
│   ├── seo/                  # metadata + JSON-LD generators
│   └── license/              # license text + bundling
├── pipeline/                 # generation orchestrator (§10)
│   ├── index.ts              # CLI entry: batch + drip modes
│   ├── generate.ts           # Claude → Divi 5 JSON
│   ├── validate.ts           # calls the deterministic validator
│   ├── render.ts             # import to Docker WP + Playwright screenshot
│   ├── seo.ts                # AI metadata/taxonomy generation
│   ├── ingest.ts             # POST to the web app ingest API
│   ├── dedupe.ts             # content-hash + perceptual-hash dedupe
│   └── recipes/              # generation prompts/specs per layout type & niche
├── public/
├── docs/
│   └── superpowers/specs/    # design docs (this spec lives here too)
└── tests/
```

---

## 5. Environment variables

All documented in `.env.example`. Server-only unless prefixed `NEXT_PUBLIC_`.

```
# Core
NEXT_PUBLIC_SITE_URL=https://divi5lab.com
DATABASE_URL=                      # Vercel Postgres
# Auth
AUTH_SECRET=
AUTH_URL=
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_MEMBERSHIP_MONTHLY=
STRIPE_PRICE_MEMBERSHIP_YEARLY=
# Storage
BLOB_READ_WRITE_TOKEN=
# Email
RESEND_API_KEY=
LOOPS_API_KEY=
# Pipeline (server / local only — NOT in the web app's Vercel runtime)
ANTHROPIC_API_KEY=
INGEST_API_TOKEN=                  # shared secret: pipeline ↔ ingest API
VALIDATOR_CMD=                     # how to invoke the validator (see §9)
WP_RENDER_BASE_URL=http://localhost:8080
```

---

## 6. Data model (Drizzle, Postgres)

Core tables (refine in implementation; keep names stable):

- **`users`** — id, email, name, role (`user` | `admin`), created_at. (Auth.js
  adapter tables: accounts, sessions, verification_tokens.)
- **`layouts`** — id, slug, title, description, **type** (hero, pricing,
  testimonial, cta, footer, full_landing, …), **niche**, **style**, **colors**
  (array), `divi_json_blob_key`, `preview_image_keys` (array), `content_hash`,
  `perceptual_hash`, `validator_passed` (bool), `seo` (jsonb: metaTitle,
  metaDescription, ogImageKey, keywords), `status` (`pending` | `approved` |
  `published` | `rejected`), created_at, published_at.
- **`packs`** — id, slug, title, description, `kind` (`free` | `paid`),
  `price_cents`, `stripe_price_id`, cover_image_key, seo (jsonb), status,
  created_at.
- **`pack_layouts`** — pack_id, layout_id, position. (many-to-many)
- **`categories`** / **`tags`** — taxonomy nodes across the 4 axes (type, niche,
  style, color/feature), each with slug + seo fields for landing pages.
- **`layout_tags`** — layout_id, tag_id.
- **`orders`** — id, user_id, stripe_checkout_id, amount_cents, status, created_at.
- **`order_items`** — order_id, pack_id, price_cents.
- **`subscriptions`** — id, user_id, stripe_subscription_id, status
  (`active` | `past_due` | `canceled`), current_period_end.
- **`entitlements`** — id, user_id, scope (`pack:<id>` | `all_access`),
  source (`order` | `subscription` | `free`), granted_at, expires_at (nullable).
- **`downloads`** — id, user_id, layout_id, ip, created_at (audit / abuse limits).
- **`email_captures`** — id, email, pack_id, created_at, loops_synced (bool).

**Entitlement rule (single source of truth in `lib/stripe/entitlements.ts`):**
a user may download a layout if it belongs to a pack they own (`pack:<id>`
entitlement), OR they have an active `all_access` entitlement, OR the layout's
pack is `free` and they've submitted an email capture for it.

---

## 7. Taxonomy (drives navigation AND programmatic SEO)

Four independent axes, all filterable and all generating SEO landing pages:

1. **Type** — hero, pricing, testimonials, CTA, features, FAQ, footer, header,
   contact, gallery, blog, full landing page, …
2. **Industry / niche** — SaaS, agency, restaurant, real estate, fitness,
   coaching, e-commerce, nonprofit, portfolio, events, …
3. **Style / aesthetic** — minimal, bold, dark, corporate, playful, elegant, …
4. **Color / feature** — color palette, has-video, has-form, has-pricing-table, …

Each axis value gets a landing page (`/layouts/hero`, `/niche/saas`,
`/style/minimal`, `/feature/has-form`) and useful combinations get pages too
(`/hero/saas`, `/style/dark/niche/agency`). Generate these from the data, not by
hand. AI assigns axis values during the pipeline's SEO step.

---

## 8. Web app — pages & routes

**Marketing:** `/` (hero + featured packs + value prop + email capture),
`/pricing` (packs grid + membership), `/license`, `/about`.

**Catalog:**
- `/browse` — faceted catalog (filter by all 4 axes, search, sort), card grid
  with screenshot thumbnails.
- `/layouts/[slug]` — single layout: screenshot gallery + lightbox zoom,
  metadata, the packs it belongs to, CTA to buy/membership, schema.org `Product`.
- `/packs/[slug]` — pack detail: included layouts grid, price/CTA, what's
  inside, schema.org `Product` + `ItemList`.
- Taxonomy landing pages per §7, each with `ItemList` JSON-LD + intro copy.

**Account (Auth.js, gated):** `/login`, `/signup`, `/account` (dashboard),
`/account/purchases`, `/account/downloads` (re-download anytime), `/account/billing`
(Stripe portal).

**Admin (role=admin):** `/admin` dashboard; `/admin/queue` (pending → one-click
approve, bulk approve/unpublish, preview); `/admin/packs` (assemble/curate packs);
`/admin/layouts`; `/admin/dedupe` (flagged near-duplicates).

**API route handlers (`app/api/`):**
- `POST /api/ingest` — pipeline → DB. Auth via `INGEST_API_TOKEN`. Validates
  payload, rejects un-validated layouts, stores as `pending`. Idempotent on
  `content_hash`.
- `POST /api/stripe/webhook` — fulfillment: create orders/subscriptions/
  entitlements. Verify signature.
- `POST /api/checkout` — create Stripe Checkout session (pack or membership).
- `GET /api/download/[layoutId]` — entitlement check → signed Blob URL (short TTL).
- `POST /api/capture` — free-pack email capture → Loops + grant free entitlement.

---

## 9. Calling the deterministic validator

The validator is the **sibling repo** (`../Divi 5 Deterministic Validator`,
package `Divi5Validator`, also bundled in the AI Editor plugin). The pipeline
must call it — never reimplement it.

Pick the wiring in implementation (document the chosen one in `pipeline/validate.ts`):

- **Option A (preferred): CLI** — invoke the validator over the validator repo's
  `make validate FILE=x` (or a thin PHP entry it exposes), capture the verdict +
  violation codes. Set `VALIDATOR_CMD` to the exact invocation.
- **Option B: HTTP** — call the AI Editor plugin's `validate_layout` REST/MCP
  endpoint on a running WP/Docker instance.

A layout only proceeds past `validate.ts` if the verdict is **valid**. Violation
codes are logged so generation prompts can self-correct (feed them back to Claude
for a repair attempt before giving up).

---

## 10. The generation pipeline (`pipeline/`)

A CLI orchestrator with two modes:
- **`batch`** — big-bang launch: generate hundreds of layouts across the taxonomy.
- **`drip`** — steady cadence: generate N layouts/packs on demand or on schedule.

### Per-layout flow (idempotent, resumable)

1. **Plan** (`recipes/`) — choose `{type, niche, style}` target from a coverage
   matrix; skip combinations already covered (resumability).
2. **Generate** (`generate.ts`) — Claude produces Divi 5 layout JSON for the
   target. Prompts are grounded in real, valid Divi 5 structure (reuse the
   validator repo's style guide / section recipes as generation context — do NOT
   invent schema).
3. **Validate** (`validate.ts`) — run the deterministic validator (§9). On failure,
   feed violation codes back to Claude for up to K repair attempts, then drop +
   log if still invalid.
4. **Dedupe** (`dedupe.ts`) — compute `content_hash`; skip exact dupes. (Perceptual
   hash added after render for near-dupes.)
5. **Render** (`render.ts`) — import the validated JSON into the local Docker
   WP+Divi env (`make up` in the validator repo), open the page, **Playwright**
   screenshots: full-page + above-the-fold + responsive widths. Compute
   `perceptual_hash`; flag near-duplicates.
6. **SEO** (`seo.ts`) — Claude generates title, slug, meta description, OG copy,
   keywords, and assigns the 4 taxonomy axes. Fully automated.
7. **Upload** — push JSON + images to Vercel Blob; collect keys.
8. **Ingest** (`ingest.ts`) — POST the record (incl. `validator_passed: true`,
   hashes, blob keys, SEO, taxonomy) to `POST /api/ingest`. Lands as `pending`.

### After the run

- Layouts sit in `/admin/queue` until a human **one-click approves** → `published`.
- **Pack assembly** can be pipeline-assisted (group approved layouts by theme into
  packs with AI-written pack copy) but packs are reviewed before going live.

### Auto-QA (flag, never auto-approve)

Validator pass (hard gate) + screenshot sanity (non-blank, expected dimensions) +
perceptual-hash dedupe. Failures/flags surface in the admin queue.

---

## 11. Quality gate & publishing

`pending` → admin review (`/admin/queue`) → `approved`/`published` or `rejected`.
Bulk actions supported. Published layouts/packs appear in the catalog and
sitemaps. Unpublish is always available. **No content goes live without a human
click.**

---

## 12. Commerce & delivery (Stripe)

- **Checkout:** `POST /api/checkout` creates a Stripe Checkout Session for a pack
  (one-time) or membership (subscription). Stripe Tax enabled for VAT/sales tax.
- **Fulfillment:** the **webhook is the source of truth.** On
  `checkout.session.completed` / `invoice.paid` / `customer.subscription.*`,
  create/update `orders`, `subscriptions`, and **`entitlements`**. Never grant
  access from client-side success redirects.
- **Downloads:** `GET /api/download/[layoutId]` checks entitlement → returns a
  **short-TTL signed Blob URL**. Bundle `LICENSE.txt` with each download (zip the
  JSON + license, or serve license alongside).
- **Re-downloads:** available anytime from `/account/downloads` for entitled users.
- **Refunds/abuse:** record `downloads` for rate-limiting; digital-goods refund
  policy stated on `/license` and checkout.

---

## 13. SEO automation (programmatic, no blog)

- **Per-entity metadata** generated by `lib/seo/` from stored fields: `<title>`,
  meta description, canonical, Open Graph + Twitter cards (OG image = the layout
  screenshot).
- **JSON-LD:** `Product` (layouts & packs, with offers/price), `ItemList`
  (catalog & taxonomy pages), `BreadcrumbList`.
- **Programmatic landing pages** for every taxonomy axis value + key combos (§7),
  each with AI-written intro copy and an `ItemList`.
- **Dynamic `sitemap.ts`** (all published layouts, packs, taxonomy pages) +
  `robots.ts`. Ping/submit on publish.
- **Performance = SEO:** RSC, image optimization (`next/image`), good Core Web
  Vitals. Screenshots served responsive from Blob.

---

## 14. Email & marketing

- **Resend (transactional):** magic-link/verification, purchase receipts,
  download links, membership lifecycle.
- **Loops (marketing):** free-pack email captures sync to a Loops list; new-pack
  announcements; membership nurture. `POST /api/capture` writes `email_captures`,
  syncs to Loops, and grants the free entitlement.

---

## 15. Analytics & ops

Vercel Analytics for traffic/Web Vitals. Track funnel events: view → add →
checkout → purchase, plus free-capture conversions. Dashboards later; keep events
named consistently from day one.

---

## 16. Security checklist

- Server-only secrets; nothing sensitive in `NEXT_PUBLIC_*`.
- Ingest API behind `INGEST_API_TOKEN`; reject payloads lacking `validator_passed`.
- Stripe webhook signature verification; idempotent handlers.
- Entitlement check on **every** download; signed, short-TTL Blob URLs only.
- Admin routes role-gated server-side (not just hidden in UI).
- Rate-limit `/api/capture`, `/api/checkout`, `/api/download`.
- Input validation (zod) on all route handlers.

---

## 17. Testing strategy

- **TDD** for commerce, entitlements, ingest validation, SEO generators, and each
  pipeline step. Write the failing test first.
- **Vitest** unit/integration: entitlement logic, webhook fulfillment (with
  Stripe fixtures), ingest idempotency/rejection, dedupe hashing, SEO output
  shape, sitemap generation.
- **Playwright** e2e smoke: browse → layout page → checkout (Stripe test mode) →
  download (entitled), and free-capture → download.
- **Pipeline tests:** validator integration (a known-good and known-bad fixture),
  resumability (re-run skips covered combos), idempotent ingest.
- CI: lint + typecheck + vitest on every PR; deploy previews on Vercel.

---

## 18. Commands

```
npm run dev          # Next.js dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint
npm run test         # vitest
npm run test:e2e     # playwright
npm run db:generate  # drizzle-kit generate
npm run db:migrate   # apply migrations
npm run db:seed      # seed taxonomy + sample data
npm run pipeline -- batch   # big-bang generation
npm run pipeline -- drip --count=N
```

The render env (`make up`, `make export-layouts`) is run from the **validator
repo** sibling, not here.

---

## 19. Phased build roadmap

Build in order. Each phase: brainstorm → plan → TDD → review → verify.

- **Phase 0 — Scaffold & infra.** Next.js + TS + Tailwind, Drizzle + Vercel
  Postgres, Auth.js, Vercel Blob, env wiring, CI. App boots, DB migrates, login
  works. *(This skeleton already stubs structure; finish wiring.)*
- **Phase 1 — Data model & catalog (read-only).** Schema, seed taxonomy + sample
  layouts/packs, `/browse`, `/layouts/[slug]`, `/packs/[slug]` with screenshots,
  faceted filtering. SEO metadata + JSON-LD + sitemap.
- **Phase 2 — Ingest API + admin queue.** `POST /api/ingest` (token, validation,
  idempotent), `/admin/queue` with one-click approve/publish. End-to-end:
  manually POST a sample layout → approve → see it live.
- **Phase 3 — Generation pipeline.** `pipeline/` end-to-end against the Docker
  render env + validator: generate → validate → render → SEO → upload → ingest.
  Big-bang a real catalog.
- **Phase 4 — Commerce.** Stripe checkout (packs + membership), webhook
  fulfillment, entitlements, signed downloads, account dashboard, re-downloads.
- **Phase 5 — Free packs & marketing.** Email capture → Loops, free entitlement,
  Resend transactional, pricing page polish.
- **Phase 6 — SEO depth & launch polish.** All taxonomy landing pages, OG images,
  performance pass, analytics events, refund/license pages, launch.

---

## 20. Definition of done (per feature)

- Tests written first and passing (`npm run test`); typecheck + lint clean.
- No secrets in client bundle; route inputs validated; auth/entitlement enforced
  server-side.
- For pipeline work: idempotent + resumable, validator gate intact.
- For UI: responsive, accessible, SEO metadata present.
- `verification-before-completion` run — output shown, not asserted.

---

## 21. Open questions / TODOs (resolve as you go)

- [ ] Real brand name + domain (replace `Divi5Lab` / `divi5lab.com`).
- [ ] Final pricing: per-pack prices + membership monthly/yearly amounts.
- [ ] Final commercial license text → `lib/license/commercial-license.txt`.
- [ ] Coverage matrix for big-bang generation (how many of each type × niche).
- [ ] Validator wiring decision (CLI vs HTTP) — document in `pipeline/validate.ts`.
- [ ] OAuth providers for login? (email + magic link assumed for v1.)
- [ ] Refund policy specifics for digital goods.
- [ ] Whether to bundle each download as a zip (JSON + LICENSE) or serve separately.

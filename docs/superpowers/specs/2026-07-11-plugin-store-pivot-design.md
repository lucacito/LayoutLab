# Divi5Lab Plugin-Store Pivot — Design

**Date:** 2026-07-11
**Status:** Approved by Lucas (brainstorming session)
**Supersedes:** the layout-marketplace business model and the services-funnel homepage as the site's primary story.

## 1. Summary

divi5lab.com becomes a **plugin-selling site** for three JHMG WordPress plugins:

1. **JHMG Converter For Elementor to Divi 5** — live on wordpress.org
   (`jhmg-converter-for-elementor-to-divi`, v2.0.0, 100+ active installs, ~10 downloads/day).
2. **JHMG Converter For Divi to Elementor** — v1.0.0, not yet on wordpress.org.
3. **Divi 5 AI Editor** (the "Divi 5 Deterministic Validator" project) — **waitlist only in v1**;
   its business model (BYO API key vs hosted AI) is decided later as its own project.

The converters follow a **freemium** model: free version on wordpress.org (top of funnel),
**Pro companion plugin** sold on divi5lab.com as an **annual auto-renewing license,
unlimited sites**, via the site's existing Stripe stack. divi5lab.com is the license
server, update server, and Pro download host (Approach A — self-built, no Freemius/MoR fees).

The layout marketplace is **demoted to free goodies**: catalog and SEO pages stay live,
layouts become free downloads behind email capture, packs/membership stop being sold.
No sales existed at pivot time, so there is nothing to migrate.

## 2. Decisions made (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Commerce/licensing infra | Self-built on divi5lab + Stripe | Commerce spine (checkout one-time+subscription, webhook fulfillment, entitlements, gated downloads, magic-link auth) already exists and is tested; no 5–7% platform fees; Lucas explicitly wants Stripe. |
| AI Editor in v1 | Coming-soon page + email waitlist | Its AI-cost model (BYO key vs hosted proxy) is a separate, bigger decision; don't block converter revenue on it. |
| Pricing shape | Annual license, unlimited sites, per plugin (placeholder $49/yr) | Industry-standard for WP plugins; matches existing Stripe subscription code; one SKU per plugin keeps pricing simple. Bundle possible later. Lapsed license = plugin keeps working, no more updates/support. |
| Old marketplace | Demote to free goodies | Keeps indexed SEO pages and Divi keyword rankings as the plugin marketing channel; removes second commerce story. |
| Existing customers | None (Stripe live since 2026-07-04, zero sales) | Archive pack/membership Stripe products cleanly. |
| wp.org compliance | Split premium code into separate Pro plugins | wp.org guideline 5 forbids locked/disabled premium code in the free plugin. Premium features move out of the wp.org zips into Pro companions delivered only from divi5lab. Upsell screens (links, comparison tables) remain in free — advertising is allowed, locked code is not. |
| Divi→Elementor distribution | Submit free version to wordpress.org as part of this project | It currently has zero distribution; wp.org is the funnel. Its readme currently advertises batch + all export formats as free — walk that back **before** first publication. |

## 3. Product line & free/pro boundaries

| Product | Free (wordpress.org) | Pro (divi5lab, annual license) |
|---|---|---|
| Elementor → Divi 5 | Single-page JSON import, unlimited | Kit ZIP import; global headers/footers → Divi Theme Builder; global styles. (This boundary is already coded behind `PremiumManager`.) |
| Divi → Elementor | Single-page JSON import | Batch import; Theme Builder templates; WooCommerce widgets. |
| Divi 5 AI Editor | — | Waitlist only. |

## 4. Backend design (layoutlab repo)

### 4.1 New Drizzle tables

- **`licenses`** — id, user_id, product_slug (`elementor-to-divi5-pro` | `divi-to-elementor-pro`),
  license_key (`JHMG-XXXX-XXXX-XXXX-XXXX`, minted at fulfillment), status
  (`active` | `past_due` | `expired` | `canceled`), stripe_subscription_id,
  current_period_end, created_at.
- **`license_activations`** — id, license_id, site_url (normalized), plugin_version,
  wp_version, activated_at, deactivated_at, last_seen_at. Sites are unlimited but
  recorded for support/abuse visibility and the account "manage sites" list.
- **`plugin_releases`** — id, product_slug, version, blob_key (Pro zip in Vercel Blob),
  changelog, released_at. Written by a publish script; read by the update-check endpoint.
- Waitlist: reuse **`email_captures`** with a product tag; sync to Loops.

### 4.2 Fulfillment (extends existing Stripe webhook)

- `checkout.session.completed` (plugin product) → subscription row → **mint license** →
  grant `plugin:<slug>` entitlement → Resend email with license key + download link.
- `customer.subscription.updated/deleted` → license status follows, with a **7-day
  grace period** on `past_due` before Pro features lock (covers failed-payment retries).
  Webhook remains the sole source of truth; idempotent handlers.

### 4.3 License API (new route handlers; auth = the license key)

- `POST /api/license/activate` — {key, site_url} → validate, record activation, return status + expiry.
- `POST /api/license/validate` — periodic re-check. Plugin caches 24h; **72h offline grace**
  so a divi5lab outage never disables a buyer's site.
- `POST /api/license/deactivate` — marks activation deactivated (bookkeeping).
- `GET /api/plugin/update-check?product&version&key` — if licensed and newer release exists,
  returns version metadata + **short-TTL signed Blob URL** to the Pro zip.
- All: zod-validated, rate-limited, same conventions as existing routes.

### 4.4 Pro release publishing

`scripts/release-plugin.ts`: bump version → zip Pro plugin → upload to Blob →
insert `plugin_releases` row. Shipping a Pro update never requires a site deploy.

## 5. Plugin-side design (both converter repos, identical pattern)

- **Free plugin (wp.org):** physically remove premium feature classes
  (`includes/premium/`, premium handlers, ZIP/kit paths). Keep the upsell landing /
  comparison table, now linking to divi5lab.com. Remove the fake
  `edc_activate_premium` flag-flip entirely.
- **Pro companion plugin** (e.g. `jhmg-converter-elementor-to-divi5-pro`): contains the
  premium converter code + the shared license client. Requires the free plugin
  (admin notice + graceful no-op if missing). Only downloadable from divi5lab
  with an entitlement.
- **`JHMG_License_Client`** (shared, single-file PHP class): canonical copy lives in the
  layoutlab repo; a sync script copies it into both Pro plugins. Provides:
  - license settings screen (paste key → activate);
  - cached validate (24h) with 72h offline grace; `is_licensed()` gate for Pro features;
  - WP-native updates: `update_plugins` transient filter hitting `/api/plugin/update-check`.
- **Divi→Elementor:** port the free/Pro split (its sibling's `PremiumManager` pattern),
  trim the readme's free-feature claims, then submit the free version to wordpress.org.

## 6. Website rework

- **`/`** — plugin-store homepage: hero (move-between-builders / Divi 5 tooling),
  3 product cards, proof strip (wp.org installs, conversion counts), free-layouts
  goodies band, AI Editor waitlist CTA. Services components retired.
- **`/plugins`** hub + **`/plugins/elementor-to-divi-5`**, **`/plugins/divi-to-elementor`** —
  long-form product pages: Free-vs-Pro comparison table, screenshots/GIF, FAQ, docs links,
  buy CTA, `Product` JSON-LD.
- **`/plugins/divi-5-ai-editor`** — coming-soon + waitlist capture.
- **`/pricing`** — rebuilt: two license cards + AI Editor teaser.
- **`/docs/[plugin]/*`** — how-to/troubleshooting guides. Primary SEO play:
  buyer-intent migration keywords ("convert elementor to divi", "divi to elementor").
- **`/account/licenses`** — keys, status/renewal, activated sites, Pro zip download.
  Billing via existing Stripe portal.
- **Marketplace demotion:** `/browse` + layout/taxonomy/keyword pages stay live;
  all layouts free behind email capture; pack purchase + membership UI removed;
  plugin cross-promo blocks added to catalog pages. Archive Stripe pack/membership products.
- Nav rework: Plugins / Pricing / Docs / Free layouts / Account.

## 7. Error handling & edge cases

- Bad/expired key on activate/validate → explicit machine-readable error codes;
  plugin shows human message + renew link.
- divi5lab unreachable → plugin serves cached license state (24h) then 72h grace;
  after grace, Pro features lock with a notice, nothing breaks or loses data.
- Refund/cancel → subscription webhook flips license; next validate locks Pro features.
- Update-check with lapsed license → returns "update exists" metadata but no package URL
  (visible nudge to renew).
- Duplicate webhook delivery → existing idempotent event-dedup path covers license minting.

## 8. Testing

- **Vitest (TDD):** license minting on fulfillment, activate/validate/deactivate/update-check
  handlers (expired, canceled, grace, bad key, rate-limit), release-publish script logic.
- **PHPUnit (both plugin repos):** license client caching/grace, Pro feature gating,
  update transient injection.
- **Playwright e2e:** test-mode checkout → license email → activate on Docker WP →
  Pro features unlock → update-check returns signed package.

## 9. Rollout order

1. Backend licensing (tables, fulfillment, license API, account page, checkout products).
2. Elementor→Divi5 split: free 2.1.0 to wp.org (premium code removed), Pro 1.0.0 with
   license client, release pipeline. **Revenue-capable here** — funnel already exists.
3. Site marketing rework (home, product pages, pricing, docs, nav, marketplace demotion).
4. Divi→Elementor split + wordpress.org submission of the free version.
5. AI Editor waitlist page.

## 10. Out of scope (v1)

- AI Editor business model, packaging, and sale.
- Plugin bundles, lifetime tier, site-limit tiers.
- Affiliate program, coupons, trials.
- Migrating the wp.org free plugin's existing "premium landing" beyond re-pointing it.

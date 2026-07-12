# Phase 5 — AI Editor for Divi 5 as a divi5lab product

**Date:** 2026-07-12
**Status:** Approved by Lucas (all sections)
**Prior phases:** plugin-store pivot spec `2026-07-11-plugin-store-pivot-design.md` (phases 1–4 shipped)

## Decisions (made by Lucas in brainstorming, 2026-07-12)

1. **Business model: BYO assistant.** The plugin is an MCP/REST tool server; the
   customer connects their own AI assistant (Claude Desktop, Cursor, VS Code
   Copilot, ChatGPT). divi5lab carries zero AI API cost. Hosted AI is out of
   scope and remains possible later as "just another REST client."
2. **Distribution: divi5lab-only, single plugin.** No wp.org submission, no
   free/Pro companion split. The one zip contains premium code behind license
   gates — allowed off wp.org.
3. **Licensing: divi5lab license server.** Replace the plugin's offline Ed25519
   licensing with the canonical `JHMG_License_Client`. Annual auto-renew Stripe
   subscription, activation/validation API, WP-native updates, /account/licenses.
4. **Free tier: keep the current boundary, capture-gated download.**
   Free = edit/validate existing pages + all guides. Premium = `create_page`,
   `set_front_page`, `set_primary_menu`. Free zip downloads behind email capture
   (Loops source `ai_editor_free`).
5. **Price: $79/yr** (annual auto-renew, unlimited sites) — flagship pricing
   above the converters' $49.
6. **Enforcement on lapse: keep features, gate updates.** Once activated on a
   site, premium features stay unlocked there. Renewal buys updates + support.
   Only refund/chargeback/manual revocation re-locks features.
7. **Launch promo: 40% off first year** via Stripe promotion code `WAITLIST40`
   (≈ $47 first year), first-year-only, expires ~7 days after the launch email.

## Current state (verified 2026-07-12)

- Plugin: `wp-plugin/` in `../Divi 5 Deterministic Validator`, v2.15.0,
  headers/readme branded jhmediagroup.com. 13 tools over MCP (`McpHandler`) +
  REST (`RestController`); bearer `ApiKey`; `UsageTracker`; bundled validator.
- Premium gate: 402 responses on `/front-page`, `/primary-menu`, and
  `create_page`, driven by `Licensing.php` — offline Ed25519 signed keys, no
  server, no revocation. **No Ed25519 keys were ever sold** → legacy path can be
  deleted outright, no back-compat.
- Site: waitlist live at `/plugins/divi-5-ai-editor` (Loops source
  `ai_editor_waitlist`); pricing page has a teaser. Licensing backend live in
  prod (Phase 1), canonical parameterized PHP client + per-destination sync
  transforms (Phase 4). `StoredLicenseStatus = active | past_due | expired |
  canceled` (no `revoked` yet). `stripe-plugin-products.ts` has a single shared
  $49 price constant. Checkout does not yet pass `allow_promotion_codes`.

## 1. Product & business model

Sell the **AI Editor for Divi 5** from divi5lab.com only, as a single plugin:

- **Free tier** (same zip): current free surface unchanged — list pages,
  get/update/validate layout, style/landing/image/site guides, section recipes.
  Download gated by email capture, Loops source `ai_editor_free`.
- **Pro license, $79/yr**: unlocks `create_page`, `set_front_page`,
  `set_primary_menu` (site-building from scratch).
- **Lapse policy**: activated sites keep premium features forever; lapsed
  license = no updates or support. Refund/chargeback/manual revocation locks.
- **Launch**: flip waitlist page to sales page, Loops email to
  `ai_editor_waitlist` with `WAITLIST40`.

## 2. Plugin changes (validator repo `wp-plugin/`)

- **License client swap.** Delete `Licensing.php` (Ed25519) and its mint script
  references; sync in the canonical client via `scripts/sync-license-client.sh`
  with a new destination entry (transform: namespace `AiEditorDivi5\WP`, prefix
  `AIED_`, text domain `ai-editor-divi5`, product `ai-editor-divi5-pro`, admin
  page slug = existing settings page, product URL
  `https://divi5lab.com/plugins/divi-5-ai-editor`). Never edit the plugin copy —
  canonical lives at layoutlab `lib/license-server/php-client/`.
- **Sticky unlock semantics** (differs from converters' soft model — here the
  license gates features):
  - First successful activation sets persistent option
    `ai_editor_divi5_premium_unlocked = true` → 402 gates open.
  - Periodic re-check piggybacks the client's existing 6h-cached update-check /
    validate flow. Re-lock **only** on explicit server answer `invalid_key`
    (404) or `license_not_usable` with `status: revoked`.
  - `expired`, `canceled`, `past_due`, 429, 5xx, network failure → features stay
    on. This is the lapse policy in code.
- **Updates**: WP-native via the client's `update_plugins` transient wiring,
  gated by license usability (lapsed = no update offers), same as converters.
- **Admin UI**: license tab (activate/deactivate, status, renew link) in the
  existing settings page; upgrade URL constant → divi5lab product page.
- **Rebrand**: plugin headers, readme.txt, and any jhmediagroup.com URLs →
  divi5lab.com. Version → **3.0.0**.
- **Untouched**: tools, `ApiKey`, `UsageTracker`, bundled validator, MCP
  handler, free/premium boundary.

## 3. Site backend changes (layoutlab)

- **`revoked` status**: add to `StoredLicenseStatus` and `effectiveStatus`
  (terminal, never auto-clears). Setters: a webhook branch on
  `charge.refunded` / `charge.dispute.created` for plugin-license purchases, and
  a manual `scripts/revoke-license.ts`. Wire contract: frozen error codes
  unchanged; `license_not_usable` responses already carry `status`, we only add
  a new value — additive, safe for deployed converter clients.
- **Product wiring**: add `ai-editor-divi5-pro` to `PLUGIN_PRODUCTS` +
  product-name map; extend `stripe-plugin-products.ts` with per-product pricing
  (refactor away the shared `YEARLY_USD_CENTS`; new entry $79/yr, env
  `STRIPE_PRICE_AI_EDITOR_PRO`). Checkout/webhook/license-mint flow is already
  product-generic — just env + map additions.
- **Promo support**: `allow_promotion_codes: true` on plugin checkout sessions;
  create `WAITLIST40` (40% off, `duration: once` on the yearly sub, redeem-by
  ~7 days post-launch) via script or dashboard at launch time.
- **Release delivery**: publish the plugin zip with existing
  `release-plugin.ts --product ai-editor-divi5-pro` (product must match the
  license product so update-check resolves). Free download = same zip in Blob
  under a random-nonce path, URL revealed only after email capture.

## 4. Site frontend changes

- **`/plugins/divi-5-ai-editor`** — waitlist → sales page:
  hero (validator moat: "AI edits, deterministic validator guarantees it
  imports"), how-it-works (connect assistant → plain-English instruction →
  validated → saved), the tool list (13 tools; readme.txt's outdated "seven
  tools" copy gets refreshed as part of the rebrand), free-vs-Pro comparison
  table,
  `BuyProButton product="ai-editor-divi5-pro"`, free-download email-capture form
  (`ai_editor_free`), FAQ (what BYO assistant means, supported assistants,
  lapse policy, unlimited sites).
- **`/pricing`** — replace the AI Editor teaser with a real Pro card at $79/yr.
- **Docs/guides** (existing guide pattern, also the SEO surface):
  setup guides for Claude Desktop (MCP), Cursor/VS Code (MCP), ChatGPT
  (OpenAPI actions).
- **`/account/licenses`** — already product-generic; verify the new product
  name renders.
- Sitemap picks up new pages via existing generation.

## 5. Launch sequence

1. Local e2e (docker WP + license server on `:3100`, Phase 2/4 pattern):
   activate → premium tools open → update-check serves a release → simulate
   cancel → features stay, updates stop → revoke → features lock (402 again).
2. Merge both repos (per-task review + final whole-branch review first).
3. Deploy site; run `stripe-plugin-products.ts` against LIVE → env var in
   Vercel prod + `.env.prod`.
4. Publish plugin release to prod `plugin_releases`; upload free-download zip.
5. Flip product page live; verify all routes.
6. Create `WAITLIST40` in LIVE Stripe; verify checkout applies it.
7. Loops launch email to `ai_editor_waitlist` segment (only after live verify:
   cs_live checkout, real activation, gated download, update-check 200).

## 6. Testing (TDD)

- **Validator repo (PHPUnit)**: client-swap integration; sticky-unlock matrix
  (activation unlocks; expired/canceled/past_due/429/5xx/offline keep unlocked;
  `revoked`/`invalid_key` lock; re-activation after revoke unlocks); update
  gating on lapse; admin license tab actions.
- **Layoutlab (Vitest)**: `revoked` in `effectiveStatus` + handlers
  (`license_not_usable` carries it); refund/dispute webhook revocation;
  `revoke-license.ts`; checkout accepts `ai-editor-divi5-pro` + passes
  `allow_promotion_codes`; per-product pricing in the products script;
  product-name maps.
- **Live e2e** before merge, ledgered in `.superpowers/sdd/progress.md`.

## Out of scope

- Hosted AI proxy / metered AI tier (future fast-follow candidate).
- wp.org submission and free/Pro plugin split.
- mcp-server npm packaging changes.
- Changes to tool surface or the free/premium boundary.

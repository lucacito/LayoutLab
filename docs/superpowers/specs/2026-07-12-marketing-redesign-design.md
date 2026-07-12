# Marketing site redesign — "The validator spine"

**Date:** 2026-07-12
**Status:** Approved design, pending implementation plan
**Scope:** All marketing pages — `/`, `/plugins`, `/plugins/elementor-to-divi-5`,
`/plugins/divi-to-elementor`, `/plugins/divi-5-ai-editor`, `/pricing`, `/about`,
`/contact`, `/license`, `/guides` (index only).

## 1. Problem

The current marketing pages are clean and factual but thin: short heroes, bare
feature bullets, 3–4 FAQ entries, generic "Learn more" CTAs, no storytelling,
no product visuals, no comparison depth. They state facts; they don't persuade,
and they don't express what actually differentiates the products.

## 2. Direction (approved)

- **Narrative architecture:** one spine — **deterministic validation** — expressed
  differently on every page. The unifying promise: *output that imports clean,
  every time; same input → same verdict.*
- **Depth:** full redesign — new copy, new sections, and visual upgrades.
- **Voice:** craftsman-technical. Confident, precise, a bit opinionated. Short
  sentences, concrete numbers, zero fluff, dry wit allowed. Think Linear/Stripe.
- **Visuals:** built-in-code demos only (CSS/SVG/React). No image files, no
  Vercel Blob dependency (Blob is currently paused — nothing on these pages may
  load from Blob). Assets that must be raster live in `/public` — but this
  design requires none.

## 3. Voice guidelines (apply everywhere)

- Lead with the job and the mechanism, never the category ("Divi 5 tools that
  never ship a broken layout", not "WordPress plugins by Divi5Lab").
- Concrete numbers over adjectives: 140+ widget mappings, 35+ modules, 100+
  active installs, real validation-rule count (pull from the validator repo at
  implementation time — do not invent).
- Every Pro feature gets a *why it matters* sentence, not a bare bullet.
- CTAs are specific: "See the converter", "Get Pro — $49/yr", never "Learn more".
- Honest about limits (e.g. a conversion report that shows one graceful
  fallback; "pending wordpress.org review" stated plainly).

## 4. Page designs

### 4.1 Homepage `/` — story arc in 8 bands

1. **Hero** — headline: promise-first (working draft: *"Divi 5 tools that never
   ship a broken layout."*). Subhead names the mechanism: every converter output
   and AI edit passes a deterministic validator before it touches the site.
   CTAs: primary → Elementor→Divi 5 converter; secondary → AI Editor.
   **Proof strip** beneath: 140+ widgets mapped · 35+ modules · 100+ active
   installs · N validation rules (real count).
2. **Problem band** (dark, `bg-ink`) — 3 sentences: hand-rebuilds take weeks;
   naive converters and raw AI output produce markup Divi half-renders; you find
   out after import. Dry, confident.
3. **The mechanism** — "Same input, same verdict." Three-step code-built
   diagram: *Convert or generate → Validate every block, attribute, nesting
   rule → Import clean.* Beside it, a **mock verdict card**: realistic violation
   caught (styled like real validator output), then the corrected pass.
4. **Three doors** — upgraded product cards: small code-built visual motif per
   product (mapping arrows / batch rows / chat bubble), job-to-be-done headline
   ("Leave Elementor without rebuilding" / "Go the other way" / "Edit Divi in
   plain English"), 2–3 concrete stats, specific CTA. Keeps status chips
   (green/amber) from current cards.
5. **Centerpiece demo** — animated **AI Editor chat sequence** (client
   component): user prompt → tool call → validator verdict → saved. CSS/JS
   stepped animation; `prefers-reduced-motion` renders the final state
   statically.
6. **Free layouts band** — existing lead-capture band kept (same `/api/lead`
   endpoint + `homepage_free_band` source), reframed as proof of scale:
   *"The validator has already shipped 200+ layouts. They're free — take them."*
   (Use the real published-layout count, rounded down.)
7. **Guides strip** — 3 featured guides, internal links.
8. **Closing CTA** (dark band) — sharpened copy, one primary action → /pricing.

### 4.2 Plugin pages — shared skeleton, distinct centerpiece

**Shared skeleton (all three):**
1. Job-to-be-done hero + product-specific stat strip.
2. Product demo visual (centerpiece, below).
3. "What actually happens" — product-specific pipeline section.
4. Feature depth — grouped features with why-it-matters prose.
5. **Free vs Pro comparison table** — capability rows, ✓/— columns (replaces
   the two-card layout).
6. Use-case vignettes ×3 (agency migrating client sites / site owner switching
   / freelancer on retainer) — short, concrete.
7. Expanded FAQ (8–10): unmapped widgets, data safety, Divi 4 vs 5, refunds,
   license/renewal behavior, assistants supported (AI Editor), etc.
8. Closing CTA band.
- JSON-LD (`Product`, `FAQPage`) and metadata updated to match new copy.
  Canonicals unchanged.

**Centerpieces:**
- **Elementor → Divi 5** (`/plugins/elementor-to-divi-5`): before/after
  **mapping panel** — Elementor widget tree left, Divi 5 module tree right,
  animated mapping arrows. Plus a **mock conversion report** with realistic
  per-widget results including one honest graceful fallback. Plus a
  collapsible **widget-mapping reference list** (the 140+ mappings — sourced
  from the actual plugin mapping table at implementation time; trust + SEO).
- **Divi → Elementor** (`/plugins/divi-to-elementor`): batch-conversion table
  mock (pages queueing → converted). "Pending wordpress.org review" framed as
  a waitlist asset; notify CTA promoted.
- **AI Editor** (`/plugins/divi-5-ai-editor`): fullest **animated chat demo**
  (prompt → tool call → violation caught → self-correction → saved);
  assistants-compatibility row (Claude Desktop, Cursor, Windsurf, VS Code
  Copilot, ChatGPT); free/pro tool split presented as "what your assistant can
  do today vs. with Pro".

### 4.3 Pricing `/pricing`

- One coherent **3-column product table** (E→D5 / D→E / AI Editor) with Free
  and Pro tiers as rows, prices inline ($49/$49-coming/$79 per year).
- **License philosophy** told once above the table: unlimited sites; nothing
  breaks if you stop paying; renewal buys updates and support, not hostage
  access.
- Free layouts band stays as the zero-cost row.
- FAQ expanded to ~8 entries. `FAQPage` JSON-LD kept in sync.

### 4.4 About `/about`

Origin story in craftsman voice, first person plural:
- Why the validator exists (AI and converters both produce confident, broken
  markup; deterministic checking is the honest fix).
- The trust model: same input → same verdict.
- The **Lab** framing: the layout catalog is the validator's proving ground —
  hundreds of generated, validated, shipped layouts.
- Numbers band (same stats as homepage proof strip).
- Who's behind it (JHMG). No stock-team fluff.
- Pointers into plugins + guides.

### 4.5 Supporting pages

- **Plugins hub `/plugins`** — homepage's upgraded three-door cards + a
  **"Which tool do I need?"** decision strip (3 one-line situations → product).
- **License `/license`** — plain-English summary cards up top (✓ unlimited
  sites, ✓ client work, ✓ keeps working / ✗ resale, ✗ redistribution), full
  text below.
- **Contact `/contact`** — reassurance copy: what to expect, response time,
  what to include for support requests. Form unchanged.
- **Guides index `/guides`** — grouped cards + intro copy positioning guides as
  the lab notebook. Guide *content* is out of scope.

## 5. Shared components (new, in `components/marketing/`)

| Component | Used on | Notes |
|---|---|---|
| `ValidatorChatDemo` | home, AI Editor page | client component; stepped animation; reduced-motion → static final frame |
| `VerdictCard` | home, plugin pages | static; styled like real validator output |
| `MappingPanel` | home motif, E→D5 page | SVG trees + arrows; CSS animation |
| `StatStrip` | home, plugin pages, about | server component; takes stat array |
| `ComparisonTable` | plugin pages, pricing | server component; accessible table markup |
| `CtaBand` | all pages | dark closing band, configurable copy/CTA |
| `UseCaseVignettes` | plugin pages | server component |

All on existing design tokens (navy / ink / paper / mist / fog / border / muted
/ action; existing type scale and radii). No new colors or fonts. Existing
`Container`, `Card`, `Icon`, `SectionTitle` reused.

## 6. Constraints

- **No Blob-hosted assets anywhere on these pages** (Blob outage; also keeps
  pages self-contained).
- No new dependencies.
- All animation respects `prefers-reduced-motion`.
- Stats and mapping lists must be **real** — pulled from the validator repo /
  plugin source / DB at implementation time, never invented.
- Metadata + JSON-LD stay present and consistent with visible copy; canonicals
  unchanged; no route/URL changes.
- Lead capture keeps the existing `/api/lead` endpoint and source tags.

## 7. Testing & verification

- Render tests (vitest + testing-library) for each new shared component,
  including the reduced-motion static fallback of `ValidatorChatDemo`.
- Existing vitest suite, typecheck, lint, and `next build` stay green.
- Playwright e2e smoke still passes (nav, lead capture, buy buttons render).
- Manual eyeball pass of every changed page in the browser before prod sync
  (per project practice — gates don't catch visual drift).

## 8. Out of scope

- Catalog pages (`/browse`, layout/pack detail, taxonomy landing pages).
- Guide article content.
- New products, bundles, or pricing changes.
- Restoring Blob (separate outage, tracked in memory).

## 9. Implementation-time lookups (do first)

1. Real validation-rule count from `../Divi 5 Deterministic Validator`.
2. Real published-layout count from the DB for the free-layouts band.
3. Actual widget-mapping list from the Elementor→Divi converter source.
4. Pick 3 featured guides for the homepage strip.

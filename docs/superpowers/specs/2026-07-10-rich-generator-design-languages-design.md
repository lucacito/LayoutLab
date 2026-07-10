# Rich Generator — Design Languages, Verified Icons, and a Premium Design Ceiling

**Date:** 2026-07-10 (v2 — revised after architecture review)
**Status:** Approved design, pending implementation plan
**Owner:** pipeline (generation quality)

> v2 changes (architecture review): Language → Variant hierarchy; selection-key
> entropy fix (the biggest v1 flaw); three-axis ownership model with a binding
> ownership matrix; numeric scales over adjectives; Layout DNA axis (3 entries);
> photography direction rebuilt around Pexels queries (not filters); structured
> art-direction contract; hero/thumbnail-first heuristics; complexity cuts
> (candidates deferred, lint trimmed, catalog 80–100, exemplars 2–3,
> designScore flag-only); revised phased roadmap.

---

## 1. Problem

Generated sections are too plain and too samey. Root causes, all in our own
prompts (NOT the validator — see §3):

1. **One card recipe everywhere.** Every card treatment resolves to the same
   object: white/tinted background, `border.radius ~16–20px`, soft box shadow,
   `translateY(-6px)` hover lift, icon + heading + 1–2 lines. That sentence is
   templated in `pipeline/recipes/prompts.ts` (cards directive + "Design bar")
   and repeated across the `benefits`/`services`/`social_proof` role treatments
   in `pipeline/recipes/section-types.ts`.
2. **Cohesion enforced against variety.** `pipeline/compose/section-prompt.ts`
   instructs: *"Reuse ONE corner-radius and ONE soft box-shadow for every card
   so the page feels systematic."* Fixes intra-page drift, but flattens every
   page to the same look.
3. **Icon whitelist of ~15 glyphs.** The cards directive restricts glyphs to
   those appearing in 3 grounding recipes ("never invent icon codes"), so the
   same star/check/gear repeats forever. The D5 exemplar corpus is no help
   (40 icon usages, 6 distinct glyphs, mostly literal `$`/`#`).
4. **Copy shape monoculture.** Icon + short heading + 1–2 sentences, everywhere.
5. **Default typography and buttons.** No font pairing direction, one implicit
   button shape — the strongest "this is a template" signals.

## 2. Goal

The generator produces layouts a buyer would believe were hand-designed by a
senior designer: committed aesthetic direction per page, page-to-page variety
**within the same (style, niche)**, distinctive typography, art-directed
photography, on-topic icons — while preserving every existing hard guarantee
(validator gate, determinism, resumability, idempotent ingest, contrast
safety).

## 3. The unlock (verified)

The validator does **not** gate styling. `docs/STYLE.md` (validator repo) ends:
decoration attributes *"pass through untouched … affect rendering only"*; the
validator guarantees structure, known block types, and render-critical content
keys. STYLE.md documents a large styling vocabulary the generator never uses:
multi-stop gradients (+ `overlaysImage`), boxShadow presets 1–5 incl. colored
glows, `transform.translate`, CSS filters, glassmorphism (rgba surface +
hairline border + radius), absolute position + z-index, per-corner radii, font
family/weight/letterSpacing/style (any Google font), `flexType` fractional
column widths, dividers, hover states.

STYLE.md is already in the model's context (the `=== STYLE GUIDE ===` grounding
block); our own directives then forbid most of it ("use ONLY the
decoration/attribute shapes shown in the recipes"). The fix is therefore mostly
**prompt architecture**, not new schema.

Icon ground truth (verified in the render env + recipes):

| System | In layout exports? | Decision |
|---|---|---|
| ETModules (`type:"divi"`) | Yes — module content icons; `modules.ttf` shipped | Catalog source #1 |
| Font Awesome (`type:"fa"`) | Yes — 9 of 13 icon usages in the validator's own recipes are `fa`; theme ships `fa-solid-900`, `fa-regular-400`, `fa-brands-400` | Catalog source #2 (richest topical coverage) |
| Material Symbols / Dashicons / builder SVG | No — builder/admin chrome only, never in exports | Out of scope |

Photography ground truth (verified in `pipeline/images.ts`): the model writes
loremflickr keyword placeholder URLs; post-generation, `resolveImages()` swaps
each for a **live Pexels search** on that keyword + orientation. Image subject,
mood, and framing are therefore directly steerable through the *keywords the
model is told to write* — a far stronger lever than CSS filters.

## 4. Architecture — three owned axes plus a per-page contract

Every prompt concern has **exactly one owner**. This ownership matrix is
binding — it is what prevents two prose systems from contradicting each other
("generous whitespace" vs. "dense") as the registries grow:

| Axis | Owns | Lives in | Selected by |
|---|---|---|---|
| **Structure** (existing role treatments) | what a section is made of: image-cards vs. timeline vs. numbered list vs. stat band | `section-types.ts` | rendezvous (existing) |
| **Surface** (NEW: Design Language → Variant) | typography, buttons, card/panel surfaces, corners/shadows, icon presentation, motifs, photography direction, breakout move | `compose/design-language.ts` | rendezvous, entropy key (§5.3) |
| **Rhythm** (NEW: Layout DNA) | section padding scale, background-alternation cadence, image frequency, copy length tendency, density, section transitions | `compose/layout-dna.ts` | rendezvous, entropy key |
| **Voice/Content** (existing brief + NEW art-direction contract) | business facts, tone, copy voice, the page's one signature detail | `compose/brief.ts` | generated once per page, pinned |

Hard rule: **Language prose never mentions spacing/density; DNA prose never
mentions colors/fonts/surfaces; role treatments never mention surface.** A
lint-style test enforces the treatment rule; golden prompt snapshots (§7)
catch the rest.

```
target (style, niche) + discriminator (businessName | variant.id)
  ├─ selectPalette()            — existing, unchanged
  ├─ selectDesignLanguage()     — NEW: rendezvous over style-eligible languages
  │    └─ selectLanguageVariant() — NEW: rendezvous over that language's variants
  ├─ selectLayoutDna()          — NEW: rendezvous over 3 DNA entries
  ├─ role treatment             — existing, EXPANDED variants; surface prose stripped
  ├─ art-direction contract     — NEW: 1 LLM call per page, pinned (§5.8)
  └─ prompt assembly            — ONE function, fixed field order, labeled
                                  provenance ([structure]/[surface]/[rhythm]/[brief])
```

Modules touched: `pipeline/compose/design-language.ts` (new),
`pipeline/compose/layout-dna.ts` (new), `pipeline/recipes/icons.ts` (new),
`pipeline/design-lint.ts` (new, trimmed scope), `section-types.ts`,
`section-prompt.ts`, `prompts.ts`, `brief.ts`, `vision-critic.ts`,
`ingest.ts` (metadata), `scripts/extract-divi-icons.ts` (new).

## 5. Components

### 5.1 Design languages (`pipeline/compose/design-language.ts`)

Six languages × 2–3 hand-curated **variants** each. A language is a **typed
data object, not a prose blob** — every field individually testable,
swappable, and injected by the single assembly function:

```ts
interface DesignLanguage {
  id: string;                        // stable, hand-assigned (rendezvous anchor)
  eligibleStyles: string[];          // style-axis gate
  variants: LanguageVariant[];       // 2–3, each with stable id
  cardSurface: string;               // surface prose (no spacing words)
  buttons: string;                   // primary/secondary shapes
  iconPresentation: string;          // bare glyph / circle badge / square tile / outlined ring
  motifs: MotifId[];                 // 2–3 refs into the shared MOTIFS registry
  photography: PhotoDirection;       // §5.6
  breakout: MoveId;                  // ref into the shared MOVES registry
  scale: NumericScale;               // §5.1.1 — numbers, not adjectives
}
interface LanguageVariant {
  id: string;
  typography: { display: string; body: string; eyebrowPolicy: string };
  iconPresentation?: string;         // optional overrides
  motifEmphasis?: MotifId;
  photography?: Partial<PhotoDirection>;
}
```

**Shared registries** (`MOTIFS: Record<MotifId, string>`, `MOVES:
Record<MoveId, string>`): motif/move prose lives ONCE; languages reference
ids. Same registry idiom as `SECTION_TYPES`. Adding a language = append an
entry + eligibility + snapshot pins; a zod schema validates every entry at
test time (all fields present, motif/move ids resolve, pinned colors pass
`contrastRatio`).

The six languages (surfaces summarized; full prose authored at implementation):

| Language | Card surface | Corners / shadows | Variant typography (display + body) | Buttons | Motifs |
|---|---|---|---|---|---|
| `soft-saas` | white card, soft shadow, hover lift | ~16px, soft presets | Inter / Plus Jakarta; Sora / Inter | rounded, solid accent | today's look, kept as one option |
| `editorial` | flat, hairline border, no shadow | 0–4px sharp | Fraunces / Inter; Playfair / Source Sans | sharp rect, ghost secondary | oversized numerals, thin rules |
| `bold-vibrant` | gradient-accent surfaces, colored glow shadows | large radii / pill | Space Grotesk / Inter; Archivo / Inter | pill, high-contrast | accent glow, gradient bands |
| `glass-dark` | glass cards (rgba + hairline border) on dark panels | ~20px | Outfit / Inter; Sora / Inter | bordered glass, light-on-dark | gradient-over-image overlays, dark full-bleed bands |
| `brutalist-flat` | flat blocks, 2px solid borders, zero shadow | 0px | Archivo Black / IBM Plex Sans (+ Mono accents); Space Grotesk / IBM Plex Sans | sharp, thick-bordered | two-tone splits, stark contrast, uppercase |
| `luxe` | ivory/tinted panels, thin borders | subtle (~6px) | Cormorant Garamond / Outfit; Marcellus / Outfit | thin-bordered, letterspaced | muted metallic accents, serif pull-quotes, whitespace-as-decoration |

Every motif/move maps to attribute paths documented in STYLE.md (ghost
oversized numeral = absolute position + z-index + low-opacity heading;
gradient wash; glow = boxShadow preset + accent color; straddle =
transform.translate + z-index) — nothing invented.

**Composition grammar** (surface-adjacent, owned by language): allowed grid
rhythms via `flexType` fractions — equal columns, asymmetric 1/3+2/3
(editorial default), wide-feature + narrow-stack; full-bleed vs. contained
(`maxWidth` + auto margins).

**Breakout & straddle (scarce moves):** exactly one eligible mid-page role per
composed page (rendezvous-picked among solution/benefits/social_proof) gets
the language's breakout move, overriding the background alternation for that
slot. **Straddle** (a stat/card row overlapping the hero's bottom edge) is a
separate language-gated move (soft-saas, bold-vibrant, glass-dark), max one
per page, and ships in the LAST visual phase with explicit mobile QA — it is
the highest-render-risk move in the system.

**Replaces:** the "Reuse ONE corner-radius and ONE soft box-shadow" line in
`buildSectionRolePrompt` with the language's own system prose. Applies to
**both** composed pages and standalone/vary targets.

#### 5.1.1 Numeric scales — numbers, not adjectives

LLMs follow numbers far more reliably than "generous". Each language pins a
`NumericScale` (DNA multiplies it, §5.2): H1/H2/eyebrow/body font sizes and
weights, card padding, grid gap, base section padding range. Injected as
explicit values in the prompt ("section padding 120–160px top/bottom; H1
64–80px weight 650; eyebrow 13px letterspaced 2px uppercase"). This converts
vibes into enforceable, testable direction and gives intra-page consistency a
concrete anchor.

### 5.2 Layout DNA (`pipeline/compose/layout-dna.ts`)

Three entries — deliberately few; DNA is a multiplier, not a second language
system:

| DNA | Padding scale | Image frequency | Copy length | Rhythm & transitions |
|---|---|---|---|---|
| `airy-editorial` | 1.25–1.5× base | every 2nd–3rd section | short, oversized | long white runs, rare tint; rule/divider transitions |
| `balanced-standard` | 1× | alternating | medium | today's white/tint alternation |
| `dense-conversion` | 0.75–0.9× | image-light, proof-heavy | compact, scannable | frequent tint panels; color-bleed between adjacent sections |

DNA also owns the **section-transition vocabulary** — dark-to-dark bridging
into the final CTA, color-bleed between tinted neighbors, divider treatments
at boundaries — the main thing separating "composed from sections" from
"designed as a whole". And the **image-frequency rhythm**: deliberately
alternating image-heavy and text-only sections (uniform image density is a
subtle template tell).

6 languages × 2–3 variants × 3 DNA × 12 palettes ≈ **400+ distinct systems
from ~30 curated definitions.**

### 5.3 Selection — deterministic, with real entropy

`style|niche` alone (v1 flaw) meant every Healthcare+Corporate page got the
identical full design system forever. Fixed by adding a high-entropy
**deterministic discriminator** that already exists on every path:

- **Composed pages:** key = `style|niche|${brief.businessName}` — the brief is
  generated once and pinned (theme.ts pattern), so: same brief → same look,
  every run. Resumable.
- **Vary/standalone targets:** key = `style|niche|${variant.id}` —
  `buildVariants` already assigns stable variant ids.

Selection chain (all `pickByRendezvous`, all append-stable, ids hand-assigned):
language (over the style-eligibility map) → variant (within language) → DNA →
breakout slot. Eligibility map: elegant → luxe/editorial/glass-dark; playful →
bold-vibrant/soft-saas; corporate → soft-saas/editorial; dark →
glass-dark/brutalist-flat; bold → bold-vibrant/brutalist-flat; minimal →
editorial/soft-saas/luxe. Unknown style falls back like palettes. Every
`select*Id()` exported for snapshot tests.

Noted for the future, not built now: weighted rendezvous (hash × weight) if
brief voice/business-type should ever *bias* (not gate) eligibility.

### 5.4 Verified icon catalog (`pipeline/recipes/icons.ts`)

- **Ground truth:** `scripts/extract-divi-icons.ts` dumps cmap codepoints from
  the four shipped font files in the render env (`modules.ttf`,
  `fa-solid-900.ttf`, `fa-regular-400.ttf`, `fa-brands-400.ttf`) into a
  checked-in `pipeline/recipes/divi-icon-codepoints.json`. A unit test asserts
  catalog ⊆ cmap — a wrong unicode fails CI, not a render.
- **Curation: ~80–100 glyphs** (v2 trim — curation is the bottleneck, not
  extraction; the cmap test makes later growth safe): `{ name, unicode, type:
  'divi'|'fa', weight ('900' solid / '400' regular for fa), topics: [...] }`.
  Topics sized to ACTIVE niches first: growth, security, speed, communication,
  health, food, home/real-estate, finance, people, craft/trades, fitness,
  tech, commerce.
- **Prompt integration:** `directives()` injects a ~20-icon topic-relevant
  slice (deterministic: topic match, stable order) as an explicit pick-list —
  replacing "ONLY from the grounding recipes".
- **Render-verify once:** a fixture page displaying every catalog glyph,
  rendered and eyeballed before the catalog is trusted; re-run on Divi updates.

### 5.5 Structure vocabulary expansion (`section-types.ts`)

- **Strip surface prose from role treatments** — treatments keep structure
  only; surface arrives from the language. Enforced by a lint-style test (no
  radius/shadow/color words in treatment text).
- **New structural variants** (documented shapes only), appended with new
  stable ids: overlap-badge cards, two-tone split cards, oversized-numeral
  editorial rows, stat band, image-bleed cards (photo as card background +
  gradient overlay + text at bottom), checklist-comparison rows. Roles go from
  2 to 3–5 variants.

### 5.6 Photography direction (`PhotoDirection`)

Rebuilt around the real lever (§3): the model's keywords become live Pexels
queries. Filters are optional seasoning, not the system (Pexels photos are
already graded; stacked CSS filters read as processed).

```ts
interface PhotoDirection {
  styleWords: string[];   // mechanically appended to every image keyword →
                          // provably reach the Pexels query
  framing: string;        // e.g. 'environmental wides with negative space for text overlays'
  subjects: string;       // e.g. 'real people mid-task, not posed stock'
  usage: 'full-bleed-overlay' | 'framed-panels' | 'mosaic';
  filters?: string;       // optional decoration.filters recipe
}
```

Per language (variant-overridable): luxe → `['moody','low key']`, close-up
textures, negative space; editorial → `['documentary','overhead']`,
environmental wides; bold-vibrant → `['vibrant','high contrast']`,
product-focused; glass-dark → darkened + gradient overlay usage. Framing
guidance ("negative space" where text overlays) directly attacks the
text-over-busy-photo legibility failures the vision critic keeps catching.

### 5.7 Prompt & grounding updates (`prompts.ts`)

1. **Relax the vocabulary fence** in SYSTEM and the "Design bar": "use ONLY
   shapes shown in the recipes" → *"use decoration attribute shapes documented
   in the STYLE GUIDE and the recipes; never invent new attribute paths."*
2. **"STYLING MOVES" digest** appended to the stable grounding block (static →
   cache-eligible): names the advanced moves and points at the STYLE.md
   sections defining their exact paths.
3. **Design bar rewritten** around three heuristics: (a) committed aesthetic
   direction (echoing STYLE.md's "Aesthetic variety"); (b) **hero-first** —
   the hero is the catalog thumbnail, so it gets the language's strongest
   treatment (motif mandatory, signature move, photography at full strength);
   (c) **thumbnail legibility** — buyers judge at ~400px card width: strong
   macro-composition, one dominant contrast block, readable at thumbnail
   scale.
4. **Single assembly function** emits language/DNA/brief prose in fixed field
   order with labeled provenance (`[structure]`, `[surface]`, `[rhythm]`,
   `[brief]`) — debuggable, greppable, snapshot-testable. Cache layout
   preserved: static additions in the stable grounding block; per-target prose
   in the user prompt (T1.4 property untouched).
5. **Typography, button, scale directives** — the variant's font pairing and
   the numeric scale values become explicit per-call directives.

### 5.8 Art-direction contract (`compose/brief.ts`)

`brief.designNotes` (optional paragraph) becomes a **structured 4-field
contract**, generated in the existing brief LLM call (no new call), with the
chosen language/variant/DNA/palette as inputs, persisted/pinned like theme
briefs:

```ts
artDirection: {
  mood: string;            // one sentence
  photography: string;     // one sentence, consistent with PhotoDirection
  typography: string;      // one sentence
  signatureDetail: string; // ONE memorable, specific move for this page
                           // e.g. 'ember-orange rules under every heading'
}
```

Why structured beats a paragraph: fields are individually injected (sections
can't ignore them); `signatureDetail` gives each page one designed-feeling
move; and the vision critic receives the same object and judges **commitment
to the stated direction** — a far more reliable rubric than generic
prettiness.

### 5.9 Copy-shape variety

Per-language/role content shapes beyond icon+heading+line: stat + label pairs,
mini case results ("Cut intake time 40%"), before/after fragments,
question-led headings, one-word eyebrow + long subhead, serif pull-quote
fragments (luxe/editorial). Rides in role-treatment + language prose;
content-lint bans unchanged. DNA owns copy *length* tendency.

### 5.10 Deterministic design lint (`pipeline/design-lint.ts`) — trimmed

V2 scope cut to what's proven necessary:

- **Keep:** the fix-buttons transform port (center-buttons /
  center-lone-buttons / labels — the 66/193 prod incident; bolder layouts
  raise this risk) + the trivial straddle/breakout once-per-page count check.
- **Cut from v1:** decoration-tree JSON checks (glass-on-light,
  gradient-overlay presence) — parsing generated decoration trees is moderate
  effort for speculative benefit; the vision critic already catches
  illegibility. Revisit only if the critic's catch-rate proves insufficient.

### 5.11 Vision-critic design signal (`vision-critic.ts`) — flag-only at launch

Additive `designScore` (1–5) + `designIssues` in the rubric/JSON contract —
same additive pattern as `imageRelevanceScore`. Rubric anchors: the premium
bar ("would this hold up next to hand-designed work"), **commitment to the
art-direction contract** (the critic receives it), and **thumbnail
legibility**. Launches flag-only; promoted to a hard gate via
`VISION_CRITIC_MIN_DESIGN_SCORE` only after calibration on the eyeball batch.

### 5.12 Gold exemplars + promotion loop (`library/`) — trimmed seed

- **Seed 2–3** (v2 trim: hand-crafting is real work; don't stall the rollout)
  for the languages furthest from current output: editorial, glass-dark,
  brutalist-flat. Interactively: generate → validate → render → refine → tag
  by language + kind in the BM25 corpus.
- **Promote:** after each eyeball batch, promote the best rendered sections
  into the corpus (language- and kind-tagged). Compounding; also erodes the
  documented testimonials/faq corpus gap.
- Retrieval prefers same-language entries as a tie-break, not a hard filter.

### 5.13 Language persistence (`ingest.ts`)

The chosen language/variant/DNA ids recorded in the ingest payload inside the
existing `seo` jsonb (`seo.designLanguage`, `seo.designVariant`, `seo.layoutDna`)
— additive, no migration. Enables which-languages-sell analytics and future
catalog filters / programmatic SEO pages per aesthetic ("glassmorphism Divi
layouts").

### 5.14 Deferred: best-of-N candidate sampling

Explicitly deferred (was 5.9 in v1): real `run.ts` orchestration complexity,
N× cost, value limited to flagship/free-pack showcases, nothing else depends
on it. Revisit post-launch as `DESIGN_CANDIDATES=N`.

## 6. Determinism & guarantees (unchanged invariants)

- No `Math.random`/`Date.now` anywhere new — all selection via
  `pickByRendezvous` on stable string keys + hand-assigned ids.
- Same target + same pinned brief → same language, variant, DNA, treatments,
  icon slice, every run. Resumable; re-runs skip covered combos as today.
- Validator gate untouched; repair loop untouched; content-lint untouched.
- Contrast: any color a language pins passes the `contrastRatio` gate pattern
  (extends the palette test).
- Prompt-cache layout preserved (T1.4): static → stable grounding block;
  per-target → user prompt.

## 7. Testing (TDD per step)

- **Selection:** `selectDesignLanguageId` / variant / DNA snapshot pins for
  concrete keys incl. two same-(style,niche) briefs resolving to DIFFERENT
  languages (the entropy fix's regression test); eligibility-map coverage
  (every style ≥2 languages, every language reachable); append-stability.
- **Language schema:** zod validation of every entry; motif/move ids resolve;
  numeric scales complete; pinned colors pass contrast.
- **Ownership matrix enforcement:** role treatments carry no surface prose
  (lint-style test); language fields carry no spacing words; DNA fields carry
  no color/font words (word-list tests — coarse but drift-catching).
- **Golden prompt snapshots:** the fully assembled section prompt for one
  representative (language, variant, DNA, role) per language — catches drift,
  contradictions, and provenance-order regressions in one mechanism.
- **Icons:** catalog ⊆ extracted cmap fixture; every entry ≥1 topic; slice
  selection deterministic + topic-relevant; fa weight ↔ font file consistency.
- **Design lint:** fix-buttons transform fixtures (prod incident set);
  once-per-page move count.
- **Critic:** designScore parsed additively; flag-only behavior; contract
  passed through.
- **Eval harness (T4.1):** A/B old vs. new prompts on a fixed target matrix —
  vision scores, validator first-pass rate, repair-attempt counts (richer
  prompts must not tank validity).

## 8. Rollout — revised phases (impact-ranked)

`DESIGN_LANGUAGES=1` env knob (default ON, escape hatch OFF — the
generator-hardening pattern). Preflight unchanged (dev server + render env up
before any paid run). Eyeball batch before any prod-facing run: ~2 pages per
language, full render pipeline, reviewed per the established visual-review
workflow.

- **Phase 1 — Foundation (days; transforms everything):**
  selection-entropy fix → grounding unlock + design-bar rewrite (incl.
  hero/thumbnail heuristics) → minimal language records for all 6 (typography
  variants + buttons + card surface + numeric scales) → fix-buttons lint port
  (urgent independently) → eval A/B validity check.
- **Phase 2 — Vocabulary:** icon catalog (~80) + cmap CI + render-verify
  fixture; PhotoDirection through Pexels queries.
- **Phase 3 — Depth:** full language layer (motif/move registries, breakout)
  + structure variants + art-direction contract.
- **Phase 4 — Rhythm:** DNA axis + section transitions + straddle moves
  (mobile-QA'd; last of the visual moves — highest render risk).
- **Phase 5 — Quality machinery:** designScore flag + rubric; 2–3 gold
  exemplars; persistence; eyeball batch → designScore calibration.
- **Post-launch:** designScore hard gate; promotion-loop cadence; candidates
  mode; more languages/variants as data (the registries make this append-only).

## 9. Costs

- Prompt growth: ~1–2 KB per call (language/DNA prose + icon slice + digest);
  digest is cache-eligible.
- Art-direction contract rides in the existing brief call — no new LLM call.
- One-time: icon extraction + ~80-glyph curation, 2–3 gold exemplars,
  calibration batch.

## 10. Non-goals

- No validator changes, no new block types, no invented attribute paths.
- No per-section AI free-styling outside the language system (determinism).
- No touching already-published layouts (editing-live-layouts workflow exists).
- No entrance/scroll animations in v1 — screenshots are the sales surface;
  scroll-triggered animations risk capturing invisible content. Revisit only
  with a scroll-warming render step.
- No candidate sampling in v1 (§5.14). No decoration-tree lint checks (§5.10).
- No niche fact-packs (overlaps the pinned-brief/facts mechanism).
- No full design-token compiler — typed prose fields consumed by prompts are
  the right altitude; a token→attribute compiler is over-engineering for an
  LLM consumer.

## 11. Risks & mitigations

- **Richer prompts hurt first-pass validity** → eval A/B before trusting;
  repair loop absorbs transients; watch repair-attempt counts.
- **Prose systems contradict each other** → ownership matrix (§4) + word-list
  tests + golden prompt snapshots.
- **Bolder moves break renders** (overlap collisions, illegible glass) →
  scarce-move policy (one breakout, one straddle max), straddle shipped last
  with mobile QA, vision critic, design lint count check.
- **Model ignores the language and reverts to habit** → gold exemplars anchor
  the look; critic judges commitment to the contract; numeric scales give it
  unambiguous targets.
- **Icon curation error** → cmap CI test + render-verify fixture.
- **Variety fragments brand cohesion of the catalog itself** → eligibility map
  keeps taste-gating; palettes/languages are curated, not generated.

## 12. Open questions

- Final glyph curation list (~80–100) — decided during implementation with the
  render-verify fixture as arbiter.
- designScore threshold — set from the calibration batch, not guessed.
- Whether `luxe` and `editorial` share a dark-panel treatment — decide when
  authoring language data.
- Exact numeric scale values per language×DNA cell — authored with the gold
  exemplars as visual reference.

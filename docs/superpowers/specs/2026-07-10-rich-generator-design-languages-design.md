# Rich Generator — Design Languages, Verified Icons, and a Premium Design Ceiling

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan
**Owner:** pipeline (generation quality)

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
senior designer: committed aesthetic direction per page, page-to-page variety,
distinctive typography, art-directed photography, on-topic icons — while
preserving every existing hard guarantee (validator gate, determinism,
resumability, idempotent ingest, contrast safety).

## 3. The unlock (verified)

The validator does **not** gate styling. `docs/STYLE.md` (validator repo) ends:
decoration attributes *"pass through untouched … affect rendering only"*; the
validator guarantees structure, known block types, and render-critical content
keys. STYLE.md documents a large styling vocabulary the generator never uses:
multi-stop gradients (+ `overlaysImage`), boxShadow presets 1–5 incl. colored
glows, `transform.translate`, CSS filters (brightness/contrast/saturate/blur/
hue), glassmorphism (rgba surface + hairline border + radius), absolute
position + z-index, per-corner radii, font family/weight/letterSpacing/style
(any Google font), `flexType` fractional column widths, dividers, hover states.

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

## 4. Architecture

One new concept threads through everything: a **design language** — a named,
page-wide aesthetic selected deterministically per page (same mechanism as
palettes). Key separation:

> **Role treatments (existing) describe STRUCTURE** — image-cards vs. timeline
> vs. numbered list. **Design languages (new) describe SURFACE** — what a card,
> button, heading, or photo looks like. Today surface is hardcoded inside every
> structure. Separating them yields structure × surface variety while each page
> stays internally coherent.

```
target (style, niche)
  ├─ selectPalette()        — existing, unchanged
  ├─ selectDesignLanguage() — NEW: pickByRendezvous('style|niche', eligible languages)
  │    └─ language → card surface, corners/shadows, font pairing, button system,
  │                  motifs, photo treatment, composition grammar, breakout move
  ├─ role treatment         — existing, EXPANDED variants; surface prose stripped
  └─ prompt assembly        — section-prompt.ts / prompts.ts inject language prose
```

Modules touched: `pipeline/compose/design-language.ts` (new),
`pipeline/recipes/icons.ts` (new), `pipeline/design-lint.ts` (new),
`section-types.ts`, `section-prompt.ts`, `prompts.ts`, `brief.ts`,
`vision-critic.ts`, `run.ts` (candidates mode), `ingest.ts` (metadata),
`scripts/extract-divi-icons.ts` (new, one-time + CI fixture).

## 5. Components

### 5.1 Design languages (`pipeline/compose/design-language.ts`)

Six languages, each a data object of prompt-ready prose per concern. Every
"move" maps to attribute paths documented in STYLE.md — nothing invented.

| Language | Card surface | Corners / shadows | Typography (display + body, 2 variants each) | Buttons | Signature motifs |
|---|---|---|---|---|---|
| `soft-saas` | white card, soft shadow, hover lift | ~16px, soft presets | Inter/Plus Jakarta + system-ish body | rounded, solid accent | today's look, kept as one option |
| `editorial` | flat, hairline border, no shadow | 0–4px sharp | Fraunces / Playfair + Inter; uppercase letterspaced eyebrows | sharp rect, ghost secondary | oversized numerals, thin rules (`divi/divider`) |
| `bold-vibrant` | gradient-accent surfaces, colored glow shadows | large radii / pill | Space Grotesk / Archivo + Inter | pill, high-contrast | accent glow (boxShadow preset + accent color), gradient bands |
| `glass-dark` | glass cards (rgba surface + hairline border) on dark panels | ~20px | Outfit / Sora | bordered glass, light-on-dark | gradient-over-image overlays, dark full-bleed bands |
| `brutalist-flat` | flat blocks, 2px solid borders, zero shadow | 0px | Archivo Black / IBM Plex Sans (+ Mono accents) | sharp, thick-bordered | two-tone split sections, stark contrast, uppercase |
| `luxe` | ivory/tinted panels, thin borders, generous padding | subtle (~6px) | Cormorant Garamond / Marcellus + Outfit | thin-bordered, letterspaced | muted metallic accents, whitespace-as-decoration, serif pull-quotes |

Each language additionally defines:

- **Composition grammar** — allowed grid rhythms via `flexType` fractions:
  equal columns, asymmetric 1/3+2/3 (editorial default), wide-feature +
  narrow-stack, staggered rows; full-bleed vs. contained (`maxWidth` + auto
  margins) section rhythm.
- **Photo treatment** — a consistent `decoration.filters` recipe (luxe →
  desaturate/moody; bold-vibrant → saturation lift; editorial → contrast lift;
  glass-dark → darkened + gradient overlay) plus 1–2 image-keyword modifier
  words for the image directive. Cohesive photography reads as art-directed.
- **Icon presentation** — bare accent glyph / filled circle badge / soft
  square tile / outlined ring (per-corner radii + border shapes).
- **Breakout move** — the one bolder section per page (see below): full-bleed
  dark stat band, overlapping split, gradient banner, oversized-quote panel.
- **Motif policy** — 2–3 whitelisted decorative motifs (ghost oversized
  numeral/word behind content via absolute position + z-index + low-opacity
  heading; gradient wash panels; hairline rules; accent-colored stat digits).
  The section prompt REQUIRES at least one motif per section (strength varies
  by role) instead of politely suggesting polish.

**Selection:** `selectDesignLanguage({style, niche})` via `pickByRendezvous`
keyed `style|niche` (identical mechanism/key shape to `selectPalette`) over a
**style-axis eligibility map**: elegant → luxe/editorial/glass-dark; playful →
bold-vibrant/soft-saas; corporate → soft-saas/editorial; dark →
glass-dark/brutalist-flat; bold → bold-vibrant/brutalist-flat; minimal →
editorial/soft-saas/luxe. Unknown style falls back like palettes do.
`selectDesignLanguageId()` exported for snapshot tests. Language variant ids
are hand-assigned strings, never array positions (append-stability).

**Breakout section:** exactly one eligible mid-page role per composed page
(rendezvous-picked among solution/benefits/social_proof) receives the
language's breakout move, overriding the white/tint background alternation for
that slot. **Section straddle/overlap** (a stat/card row overlapping the hero's
bottom edge via `transform.translate` + z-index) is a distinct, language-gated
move limited to **one per page**, applied only where the language declares it
(soft-saas, bold-vibrant, glass-dark) — the hallmark premium move, kept scarce.

**Replaces:** the "Reuse ONE corner-radius and ONE soft box-shadow" line in
`buildSectionRolePrompt` with the language's own system prose (which is itself
internally consistent — cohesion via language, not via sameness). Applies to
**both** composed pages and standalone/vary targets, keyed off the same
(style, niche).

### 5.2 Verified icon catalog (`pipeline/recipes/icons.ts`)

- **Ground truth:** `scripts/extract-divi-icons.ts` dumps cmap codepoints from
  the four shipped font files in the render env (`modules.ttf`,
  `fa-solid-900.ttf`, `fa-regular-400.ttf`, `fa-brands-400.ttf`) into a
  checked-in `pipeline/recipes/divi-icon-codepoints.json`. A unit test asserts
  catalog ⊆ cmap — a wrong unicode fails CI, not a render.
- **Curation:** ~150–200 glyphs hand-tagged: `{ name, unicode, type:
  'divi'|'fa', weight ('900' solid / '400' regular for fa), topics: [...] }`.
  Topic axes sized to our niches: growth, security, speed, communication,
  health, food, home/real-estate, finance, people, craft/trades, fitness,
  travel, tech, nature, legal, education, commerce.
- **Prompt integration:** `directives()` injects a ~20-icon topic-relevant
  slice (matched to niche + role) as an explicit pick-list — replacing "ONLY
  from the grounding recipes". Kills the star/check/gear monoculture while
  staying hallucination-proof. Slice selection is deterministic (topic match,
  stable order).
- **Render-verify once:** a fixture page displaying every catalog glyph,
  rendered and eyeballed before the catalog is trusted; re-run on Divi updates.

### 5.3 Structure vocabulary expansion (`section-types.ts`)

- **Strip surface prose from role treatments** — treatments keep structure
  only; surface arrives from the language. (E.g. `benefits-image-cards` stops
  saying "rounded corners (~16px) … soft box shadow".)
- **New structural variants** (all expressible in documented shapes), appended
  with new stable ids (never renamed — rendezvous append-stability):
  overlap-badge cards (`transform.translate`), two-tone split cards,
  oversized-numeral editorial rows, stat band, image-bleed cards (photo as
  card background + gradient overlay + text at bottom), checklist-comparison
  rows. Roles go from 2 to 3–5 variants.

### 5.4 Prompt & grounding updates (`prompts.ts`)

1. **Relax the vocabulary fence** in SYSTEM and the "Design bar": "use ONLY
   shapes shown in the recipes" → *"use decoration attribute shapes documented
   in the STYLE GUIDE and the recipes; never invent new attribute paths."*
2. **"STYLING MOVES" digest** appended to the stable grounding block (static
   text → stays cache-eligible): names the advanced moves (gradient
   backgrounds + overlays, glow shadows, transform offsets, glass cards,
   filters, per-corner radii, display-font moves, ghost numerals, dividers)
   and points at the STYLE.md sections that define their exact paths.
3. **Design bar rewritten** to demand a committed aesthetic direction (echoing
   STYLE.md's own "Aesthetic variety" section) instead of mandating
   rounded+soft-shadow; judged against "premium theme marketplace next to
   hand-designed work".
4. **Cards directive surface text becomes language-driven** — `directives()`
   accepts the selected language and emits its card surface, button system,
   icon presentation, and motif policy. Cache note: grounding block stays a
   pure function of (type, guide); language prose rides in the **user prompt**
   (target-specific, like library exemplars), preserving T1.4 cache behavior.
5. **Typography + button directives** — the language's font pairing (family,
   weights, letterSpacing, uppercase policy) and button spec become explicit
   per-call directives.

### 5.5 Design-director brief (`compose/brief.ts`)

`brief.designNotes` is today optional and generic. It becomes a mandatory
per-page **art-direction paragraph**: one extra cheap LLM call at brief time,
seeded with the chosen language + palette + niche, producing a specific,
evocative direction ("charcoal field, single ember-orange accent, oversized
serif numerals, photography desaturated and moody…"). Every section prompt
already carries `designNotes` — no plumbing change downstream. Deterministic
resumability: the note is generated once per page and persisted with the run
state like other per-page artifacts (theme.ts briefs already persist pinned
briefs; same pattern).

### 5.6 Copy-shape variety

Per-language/role content shapes beyond icon+heading+line: stat + label pairs,
mini case results ("Cut intake time 40%"), before/after fragments,
question-led headings, one-word eyebrow + long subhead, serif pull-quote
fragments (luxe/editorial). Rides in role-treatment + language prose; the
content-lint bans are unchanged.

### 5.7 Deterministic design lint (`pipeline/design-lint.ts`, new)

Post-generation, pre-render deterministic transforms/checks (the fix-buttons
port, already flagged urgent after the 66/193 prod button-centering incident):

- **Transforms:** the generic fix-buttons modes (center-buttons /
  center-lone-buttons / labels) applied to fresh output — bolder layouts raise
  misalignment risk, so this lands together with the creativity changes.
- **Checks (reject → repair loop, like validation):** glass card prose on a
  light panel (illegibility), text over gradient/image without an overlay,
  breakout/straddle used more than once per page, fa glyph with a weight that
  doesn't match its font file.

### 5.8 Vision-critic design gate (`vision-critic.ts`)

Additive `designScore` (1–5) + `designIssues` in the rubric and JSON contract —
same additive pattern as `imageRelevanceScore`. Rubric anchor: *"would this
hold up on a premium theme marketplace next to hand-designed work — committed
aesthetic, real hierarchy, not a default template?"* Rollout: flag-only first,
calibrated against a small labeled set of good/bad renders, then promoted to a
hard gate via `VISION_CRITIC_MIN_DESIGN_SCORE` (default set after
calibration). The critic prompt also receives the intended language name so it
can judge commitment to the chosen direction.

### 5.9 Best-of-N candidate sampling (`run.ts`)

Optional `DESIGN_CANDIDATES=N` (default 1 = off): generate N variants of a
section (same target, varied treatment/motif picks), render all, vision-critic
scores them, keep the winner, discard the rest before ingest. Selection
pressure for flagship/free-pack showcase work; cost scales ~N× per section, so
it is a knob, never a default. Dedupe/idempotency unaffected (losers never
reach ingest).

### 5.10 Gold exemplars + promotion loop (`library/`)

- **Seed:** hand-craft one showcase section per language (interactively:
  generate → validate → render → refine), and add them to the BM25 exemplar
  corpus tagged by language + kind. Day-one few-shot anchors for the new
  vocabulary — the model imitates our best, not just the stock 73-page corpus.
- **Promote:** after each eyeball batch, promote the best rendered sections
  into the corpus (language- and kind-tagged). Compounding quality; also
  erodes the documented testimonials/faq corpus gap over time.
- Retrieval: exemplar retrieval prefers same-language entries when present
  (tie-break, not a hard filter — corpus is small at first).

### 5.11 Language persistence & catalog tie-in (`ingest.ts`, web app later)

The chosen language id is recorded in the ingest payload inside the existing
`seo` jsonb (`seo.designLanguage`) — additive, no migration, no ingest schema
break. Future (not this project): surface as a catalog filter + programmatic
SEO landing pages per aesthetic ("glassmorphism Divi layouts", "brutalist Divi
layouts").

## 6. Determinism & guarantees (unchanged invariants)

- No `Math.random`/`Date.now` anywhere new — all selection via
  `pickByRendezvous` on stable string keys + hand-assigned ids.
- Same (style, niche) target → same language, same treatments, same icon
  slice, every run. Resumable; re-runs skip covered combos exactly as today.
- Validator gate untouched; repair loop untouched; content-lint untouched.
- Palette contrast tests extend to any colors a language pins (e.g. glass
  surface rgba on dark) — same `contrastRatio` gate pattern.
- Prompt-cache layout preserved: static additions go in the stable grounding
  block; per-target language prose goes in the user prompt.

## 7. Testing (TDD per step)

- **Selection snapshots:** `selectDesignLanguageId` pins for concrete
  (style, niche) pairs; eligibility-map coverage (every style axis value maps
  to ≥2 languages; every language reachable); append-stability test (adding a
  language doesn't remap existing pins that keep losing).
- **Icon catalog:** catalog ⊆ extracted cmap fixture; every entry has ≥1
  topic; slice selection deterministic + topic-relevant; fa weight ↔ font file
  consistency.
- **Prompt assembly:** language prose present for composed AND vary targets;
  "ONE corner-radius" phrase absent (regression); STYLING MOVES digest in the
  stable block; grounding block still byte-identical across same-type targets
  (cache property).
- **Structure:** role-treatment variants carry no surface prose (lint-style
  test); breakout + straddle at most once per page; new ids unique.
- **Design lint:** fix-buttons transform fixtures (from the prod incident
  set); glass-on-light and gradient-overlay checks with known-bad fixtures.
- **Critic:** designScore parsed additively (absent field never breaks
  consumers); gate behavior behind env knob.
- **Eval harness (T4.1):** A/B old vs. new prompts on a fixed target matrix;
  compare vision scores + validator pass-rate + repair-attempt counts (watch
  for regression: richer prompts must not tank first-pass validity).

## 8. Rollout

1. `DESIGN_LANGUAGES=1` env knob (default ON, escape hatch OFF — the
   generator-hardening pattern).
2. Order of implementation: **icons (5.2) → grounding unlock (5.4) → languages
   + structure (5.1/5.3) → brief + copy shapes (5.5/5.6) → design lint (5.7) →
   critic gate (5.8) → candidates (5.9) → gold exemplars (5.10) → persistence
   (5.11)**. Icons + grounding alone already visibly improve output.
3. Eyeball batch before any prod-facing run: ~2 pages per language through the
   full render pipeline, visually reviewed per the established visual-review
   workflow (phone drift, off-subject photos, icon sanity, gallery holes).
4. designScore calibration on that batch → set
   `VISION_CRITIC_MIN_DESIGN_SCORE` → promote to hard gate.
5. Preflight unchanged: dev server + render env up before any paid run.

## 9. Costs

- Prompt growth: ~1–2 KB per call (language prose + icon slice + digest);
  digest is cache-eligible.
- One extra cheap LLM call per composed page (art-direction paragraph).
- Optional N× generation+render for candidate sampling (explicit knob).
- One-time: icon extraction/curation, 6 gold exemplars, calibration batch.

## 10. Non-goals

- No validator changes, no new block types, no invented attribute paths.
- No per-section AI free-styling outside the language system (determinism).
- No touching already-published layouts (the editing-live-layouts workflow
  exists for that).
- No entrance/scroll animations in v1 — **deliberately deferred**: screenshots
  are the sales surface, and scroll-triggered entrance animations risk
  capturing invisible/mid-fade content in full-page shots. Revisit only with a
  render step that scroll-warms the page first.
- No niche fact-packs (overlaps the existing pinned-brief/facts mechanism in
  theme scripts).

## 11. Risks & mitigations

- **Richer prompts hurt first-pass validity** → eval-harness A/B (§7) before
  trusting; repair loop already absorbs transient failures; watch
  repair-attempt counts.
- **Bolder moves break renders** (overlap collisions, illegible glass) →
  design lint (5.7) + vision critic (5.8) + the scarce-move policy (one
  breakout, one straddle max).
- **Model ignores the language and reverts to habit** → gold exemplars (5.10)
  anchor the look; critic judges commitment to the named language; candidates
  mode for high-stakes work.
- **Icon curation error** → cmap CI test + one-time render-verify fixture.
- **Perceptual-hash near-dupes within a language** → unchanged dedupe still
  applies; languages *increase* cross-page variance, lowering collision risk.

## 12. Open questions

- Final glyph curation list (~150–200) — done during implementation with the
  render-verify fixture as the arbiter.
- Exact designScore threshold — set from the calibration batch, not guessed.
- Whether `luxe` and `editorial` need distinct dark-panel treatments or share
  one — decide when writing the language data.

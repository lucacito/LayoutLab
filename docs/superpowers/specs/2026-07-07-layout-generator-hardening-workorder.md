# Layout Generator Hardening — Work Order

> **This is an executable work order for Claude Code.** It grounds every task in the
> real code with `file:line` references, states acceptance criteria, and lists tests to
> write first. Work top-to-bottom by tier. Each task is self-contained enough to be
> picked up in isolation.
>
> **Author's intent:** raise the quality, diversity, and reliability of AI-generated
> Divi 5 layouts to the maximum achievable **without changing the inference transport**.
> We stay on the `claude` CLI. See "Hard constraints" and "Explicitly out of scope."

---

## 0. Hard constraints — do not violate

These override any instinct you have from general best practice.

1. **STAY ON THE `claude` CLI.** Generation goes through
   [`pipeline/llm/claude-cli.ts`](../../../pipeline/llm/claude-cli.ts) which shells out to
   `claude -p --output-format json --append-system-prompt`. **Do NOT** port to the
   Anthropic SDK/API, do NOT add `@anthropic-ai/sdk`, do NOT introduce direct HTTP calls
   to the Anthropic API. Every LLM improvement below must be expressible through the CLI
   invocation. This is a firm product decision, not a technical gap to fix.
2. **Never reimplement the deterministic validator in JS.** It is called over the CLI in
   [`pipeline/validate.ts`](../../../pipeline/validate.ts). Same input → same verdict is the
   trust model. New quality gates are *additive*; they never replace the validator.
3. **The validator is the hard structural gate.** Nothing structurally invalid ships. New
   gates (visual, perceptual-dupe, copy) may *flag* or *drop*, never *auto-approve* past
   the validator.
4. **Ingest auto-publishes; there is no human review queue** (see
   [`lib/ingest/status.ts`](../../../lib/ingest/status.ts) — every ingested layout lands
   `published`). This is deliberate. **Therefore every new quality gate must run INSIDE the
   pipeline and drop/flag BEFORE ingest.** Do not build anything that assumes a human will
   catch problems downstream — there is no such human.
5. **No `header` layout type.** Headers were dropped on purpose (fake nav, wrong fit). Do
   not add header generation. Generated modules must be *real and functional* for buyers,
   never decorative stand-ins.
6. **No invented Divi schema.** All structure comes from the validator repo's grounding
   (`SCHEMA.md`, `STYLE.md`, `section-recipes.json`) and the real exemplar corpus. Never
   hand-author block/attribute shapes from memory.
7. **Idempotent + resumable.** Re-running must not duplicate work or double-charge LLM
   calls already done (dedupe by content hash; `vary`/coverage skip already covered combos).

## 1. How to work

Follow the project's Superpowers workflow (`CLAUDE.md` §0):

- **`test-driven-development`** for every non-trivial change here. Write the failing test
  first; most tasks below list the tests to write.
- **`systematic-debugging`** for anything that misbehaves.
- **`verification-before-completion`** — never mark a task done without running the
  verification command and showing output. Commands: `npm run test`, `npm run typecheck`,
  `npm run lint`.
- **`requesting-code-review`** before merging a tier.
- Prefer small, reviewable commits per task ID.

**Definition of done (per task):** tests written first and passing; typecheck + lint clean;
constraint checklist above respected; behavior verified with real output shown, not asserted.

---

## 2. Orientation — how generation works today

Read these before touching anything. The pipeline has **two generation paths** feeding one
downstream flow.

| Concern | File | Notes |
|---|---|---|
| CLI transport (the constraint) | [`pipeline/llm/claude-cli.ts`](../../../pipeline/llm/claude-cli.ts) | `claude -p`, `--append-system-prompt`, `--model $PIPELINE_MODEL`, `--max-budget-usd`. No temp/max_tokens. |
| Single-section generate | [`pipeline/generate.ts`](../../../pipeline/generate.ts) | one call → one section; parse-retry loop. |
| Full-landing compose | [`pipeline/compose/index.ts`](../../../pipeline/compose/index.ts) | brief + per-section calls, assembled. |
| Section role/cohesion | [`pipeline/compose/section-prompt.ts`](../../../pipeline/compose/section-prompt.ts) | `ROLE_DESIGN`, palette, background rhythm. |
| Page flow spines | [`pipeline/compose/flow.ts`](../../../pipeline/compose/flow.ts) | 5 hardcoded `FLOWS`. |
| Brief | [`pipeline/compose/brief.ts`](../../../pipeline/compose/brief.ts) | brand JSON; `defaultPalette` (hardcoded slate). |
| Prompt builder + grounding injection | [`pipeline/recipes/prompts.ts`](../../../pipeline/recipes/prompts.ts) | `buildGenerationPrompt`, `directives`, repair prompts. |
| Grounding loader | [`pipeline/recipes/grounding.ts`](../../../pipeline/recipes/grounding.ts) | reads validator repo `STYLE.md`/`SCHEMA.md`/`section-recipes.json`. |
| Targets/variants | [`pipeline/recipes/matrix.ts`](../../../pipeline/recipes/matrix.ts) | `MATRIX`, `buildVariants`, `LAYOUTS_BY_TYPE`. |
| **Library exemplars (OFF by default)** | [`pipeline/library/exemplars.ts`](../../../pipeline/library/exemplars.ts) | 337 real sections; gated by `USE_LIBRARY_EXEMPLARS`, k=1, keyword retrieval. |
| Orchestrator (the real gate logic) | [`pipeline/run.ts`](../../../pipeline/run.ts) | validate→images→lint→mobile→dedupe→seo→upload→render→ingest. |
| **Second orchestrator (duplicate)** | [`pipeline/theme.ts`](../../../pipeline/theme.ts) | multi-page themes; copies run.ts gate logic. |
| Structural validation | [`pipeline/validate.ts`](../../../pipeline/validate.ts) | CLI to PHP validator; parses `[CODE]` lines. |
| Content lint | [`pipeline/content-lint.ts`](../../../pipeline/content-lint.ts) | regex bans (placeholder/lorem/fake contacts). |
| Images | [`pipeline/images.ts`](../../../pipeline/images.ts) | swap loremflickr/pravatar placeholders → Pexels. |
| Mobile stacking | [`pipeline/stack-mobile.ts`](../../../pipeline/stack-mobile.ts) | deterministic phone single-column. |
| Dedupe | [`pipeline/dedupe.ts`](../../../pipeline/dedupe.ts) | exact `contentHash` only. |
| Render + screenshots | [`pipeline/render.ts`](../../../pipeline/render.ts) | desktop/mobile shots; computes perceptual hash **(never compared)**. |
| SEO/axes | [`pipeline/seo.ts`](../../../pipeline/seo.ts) | metadata + taxonomy; silent clamps. |
| Ingest | [`pipeline/ingest.ts`](../../../pipeline/ingest.ts), [`app/api/ingest/route.ts`](../../../app/api/ingest/route.ts) | token-gated; exact-hash idempotent; auto-publish. |

Grounding assets in the sibling validator repo (`../Divi 5 Deterministic Validator`):
`docs/STYLE.md`, `docs/SCHEMA.md`, `wp-plugin/data/section-recipes.json` (16 recipes), and
**untapped**: `wp-plugin/src/LandingGuide.php`, `SiteGuide.php`, `ImageGuide.php`.

---

# TIER 1 — Highest leverage, uses assets you already have

These three most directly raise catalog quality with data/plumbing that already exists.

## T1.1 — Turn on the library exemplar corpus and make it earn its keep

**Problem.** You converted 122 DiviFlash pages → 73 validated D5 pages → **337
kind-classified real section exemplars** ([`pipeline/library/index.json`](../../../pipeline/library/index.json)),
wired retrieval into the prompt ([`pipeline/recipes/prompts.ts:133-140`](../../../pipeline/recipes/prompts.ts#L133-L140)),
then shipped it **disabled** behind `USE_LIBRARY_EXEMPLARS=1` with `k=1` and keyword-only
retrieval ([`pipeline/library/exemplars.ts:42-63`](../../../pipeline/library/exemplars.ts#L42-L63)).
In the default path the generator uses only the 16 curated recipes. This is free quality
sitting idle.

**Goal.** Library exemplars ON by default, k≥2, with all classified kinds reachable, and
measured against the old path.

**Implementation.**
1. Flip the default: `libraryExemplarsEnabled()` should default to **on** unless
   `USE_LIBRARY_EXEMPLARS=0`. Keep the env override so it can be A/B'd and disabled.
2. Raise default `k` to `2` (env `LIBRARY_EXEMPLAR_K`). Because grounding lives in the
   prompt, watch token size — pair with T1.4 (move grounding into the cached system prompt)
   so extra exemplars are affordable.
3. Extend `KIND_BY_TYPE` ([`exemplars.ts:28-39`](../../../pipeline/library/exemplars.ts#L28-L39))
   to map every classified kind that has exemplars: currently unused kinds include
   `stats` (standalone), `slider`, `media`, `content`, `feature_detail`. Map:
   `stats→['stats','features']`, `gallery→['gallery','media','slider']`, and add a
   `full_landing` blend that includes `stats` and `contact`.
4. **Fix the empty categories.** The classifier produced **0 testimonials, 0 faq, 2
   pricing** (see `scripts/index-library.ts` classifier at lines ~40-73). Either improve
   the heuristic classifier and re-run `scripts/index-library.sh`, or hand-label a handful
   of testimonial/faq/pricing sections from the 73 D5 pages in `pipeline/library/d5/`. Aim
   for ≥3 exemplars per generatable type. Until then, log when a type falls back to zero
   exemplars so the gap is visible.

**Acceptance criteria.**
- With no env vars set, a `hero`/`saas`/`minimal` generation prompt contains at least one
  `Real-world example` block.
- `getLibraryExemplars` returns ≥1 exemplar for every type in `MATRIX` including
  `testimonials`, `faq`, `pricing` (after the corpus gap is filled).
- A run summary or log line reports how many exemplars were injected per target.

**Tests first.**
- `exemplars.test.ts`: default-on behavior; `USE_LIBRARY_EXEMPLARS=0` disables; k respected;
  every `MATRIX` type resolves ≥1 exemplar; unmapped-kind regression guard.

## T1.2 — Wire up the perceptual hash (it's computed and thrown away)

**Problem.** [`render.ts:40-53`](../../../pipeline/render.ts#L40-L53) computes a 16×16
average-hash, stores it in the payload ([`run.ts:150-173`](../../../pipeline/run.ts#L150-L173))
and DB column ([`db/schema.ts`](../../../db/schema.ts)) — and **nothing ever compares it**.
Dedupe is exact-`contentHash` only ([`dedupe.ts:16-19`](../../../pipeline/dedupe.ts#L16-L19),
[`app/api/ingest/route.ts:40-47`](../../../app/api/ingest/route.ts#L40-L47)), so two
near-identical layouts with reworded copy both publish. `vary` mode
([`pipeline/index.ts:55-57`](../../../pipeline/index.ts#L55-L57)) intentionally bypasses the
coverage skip and relies only on exact-hash dedup — so it *will* mint near-dupes at scale.

**Goal.** Near-duplicate detection using the perceptual hash, enforced in-pipeline before
ingest.

**Implementation.**
1. Add a `hammingDistance(a, b)` helper and a `isNearDuplicate(newHash, existingHashes, threshold)`
   in `pipeline/dedupe.ts`. Threshold tunable via env (`PERCEPTUAL_DUPE_MAX_DISTANCE`),
   default chosen from real pairs (start ~5/64 bits, tune).
2. In [`run.ts`](../../../pipeline/run.ts), after render produces `perceptualHash`, query
   existing perceptual hashes (add a `deps.nearDuplicateHashes()` or extend `isDuplicate`)
   and, on a near-dupe hit, increment a new `summary.nearDuped` counter, `log` it, and
   `continue` (drop) — *before* ingest.
3. Upgrade the hash from aHash to **dHash** (difference hash) for better discrimination;
   keep it 64-bit hex so the DB column and existing rows stay compatible (note: existing
   rows were aHashed — either backfill or gate comparison to same-algorithm rows; document
   the choice).
4. Because the perceptual hash only exists *after* render, and render is currently
   best-effort (T2.1), ensure the near-dupe check is skipped gracefully when no hash exists,
   and never blocks ingest of a layout that simply failed to render.

**Acceptance criteria.**
- Two layouts differing only in copy but visually identical produce hashes within threshold
  and the second is dropped with a `nearDuped` log.
- Genuinely different layouts are not falsely dropped (test with dissimilar fixtures).
- `RunSummary` gains a `nearDuped` field.

**Tests first.**
- `dedupe.test.ts`: hamming distance correctness; near-dupe detection at/over threshold;
  dHash stability (same image → same hash; 1px change → small distance).

## T1.3 — Add a visual QA gate (CLI-native vision critic)

**Problem.** There is **no visual quality scoring** anywhere. Render only checks
content-wrapper height > 150px (fallback > 40px) ([`render.ts:150-176`](../../../pipeline/render.ts#L150-L176)).
Render *failures are swallowed* ([`pipeline/index.ts:112-115`](../../../pipeline/index.ts#L112-L115))
→ the layout keeps **placeholder** previews and still auto-publishes
([`run.ts:155`](../../../pipeline/run.ts#L155)). Blank/near-empty renders still screenshot
via the `fullPage` fallback and ship. Nothing detects overlapping text, content spilling
past sections, 1-char-wide columns, low contrast, or "this doesn't look premium." **Because
there is no human review (constraint #4), this critic IS your QA.**

**Goal.** After render, score the screenshots and drop/flag layouts below a quality bar,
in-pipeline, before ingest — **using the `claude` CLI** (constraint #1).

**Implementation (CLI-native, no SDK).**
1. In headless mode the `claude -p` agent still has file tools. The critic passes the
   **screenshot file path(s)** and asks the agent to Read + score them. Add
   `pipeline/vision-critic.ts` exposing `scoreScreenshots(paths, context): Promise<{score:number; issues:string[]}>`.
2. Prompt the critic with a concrete rubric: spacing/padding, no text overlap, no content
   clipping/overflow, column widths sane on mobile, contrast/legibility, image relevance to
   the section subject, and an overall "would this pass as a premium paid layout?" 1–5.
   Require JSON out (`{ score, issues: string[] }`), parsed with the existing
   [`extractJson`](../../../pipeline/llm/parse.ts) helper.
3. Reuse the CLI client ([`claude-cli.ts`](../../../pipeline/llm/claude-cli.ts)); the critic
   is just another `deps.llm`-style call with an image-reading prompt. It respects the same
   `--max-budget-usd` cap. Consider a cheaper model via a `VISION_CRITIC_MODEL` env.
4. In [`run.ts`](../../../pipeline/run.ts), after `deps.render(...)` returns real previews:
   call the critic on the desktop + mobile shots. Below `VISION_CRITIC_MIN_SCORE`
   (default 3) → `summary.dropped++`, `log` the issues, `continue`. At or above → proceed to
   ingest. Make the critic **optional/injected** (`deps.visionCritic?`) so unit tests and
   dry-runs skip it, mirroring how `deps.render`/`deps.resolveImages` are optional.
5. **Close the swallowed-render hole:** when render returns no real previews
   ([`pipeline/index.ts:112-115`](../../../pipeline/index.ts#L112-L115)), do **not** ingest a
   layout carrying only placeholder previews silently. Either treat a render miss as a
   drop (counted separately as `renderFailed`), or explicitly flag it. Decide and document;
   default recommendation: **drop** — a paid catalog should not contain layouts we never
   confirmed render.

**Acceptance criteria.**
- A deliberately broken layout fixture (overlapping/blank) scores below threshold and is
  dropped; a known-good fixture passes.
- Critic is fully injectable; `run.ts` unit tests pass with it stubbed.
- Render-miss no longer results in a placeholder-preview layout being ingested; it's dropped
  or flagged with a distinct counter.
- Critic honors `--max-budget-usd` and a configurable model/threshold.

**Tests first.**
- `vision-critic.test.ts`: JSON parsing, threshold logic, budget passthrough (stub the CLI
  runner à la existing `RunCommand` stubs in the codebase).
- `run.test.ts`: below-threshold drop path; render-miss drop path; stubbed critic no-op path.

## T1.4 — CLI-compatible prompt hygiene (the only inference wins available to us)

**Problem.** We can't set temperature/max_tokens or use the SDK's caching API. But two
things are wasteful and fixable *on the CLI*:
- Grounding (`SCHEMA.md` ~8KB + `STYLE.md` ~12KB + recipes) is injected into the **user
  prompt** on every call ([`prompts.ts:143-149`](../../../pipeline/recipes/prompts.ts#L143-L149)),
  and re-sent per section of every page. Because it's in the user prompt (which varies), it
  can't benefit from the automatic prompt caching the CLI applies to a **stable system
  prompt**.
- `--append-system-prompt` stacks our prompt on top of the entire Claude Code agentic system
  prompt, so every call carries harness/tool baggage for a pure-JSON task.

**Goal.** Reduce token cost and improve caching **without leaving the CLI**, by making the
stable grounding a stable system prompt so the CLI's automatic caching can hit it.

**Implementation.**
1. Move the *stable* grounding (schema + style guide + the selected recipe examples that
   don't vary per target) out of the per-call user prompt and into the **appended system
   prompt** string, which is identical across many calls in a run → eligible for the CLI's
   automatic prompt caching. Keep only the **target-specific** ask (type/niche/style,
   directives, the retrieved exemplars) in the user prompt.
2. Verify empirically that moving grounding to the system prompt does not degrade adherence
   (the model sometimes weights the user turn more heavily) — use the eval harness (T4.1) to
   compare validator pass-rate and repair counts before/after.
3. Trim redundancy: the content-ban list is duplicated in the generation directives
   ([`prompts.ts:68-73`](../../../pipeline/recipes/prompts.ts#L68-L73)), the lint regexes
   ([`content-lint.ts:29-78`](../../../pipeline/content-lint.ts#L29-L78)), and the
   content-repair prompt ([`prompts.ts:173-176`](../../../pipeline/recipes/prompts.ts#L173-L176)).
   Single-source the human-readable ban text and derive both prompt copies from it, so it
   can't drift from the enforced regexes.

**Acceptance criteria.**
- Grounding is sent as a stable system prompt; user prompt shrinks to target-specific
  content. Snapshot tests confirm the split.
- No regression in validator pass-rate / repair count on the eval set (T4.1).
- The content-ban list has exactly one source of truth.

**Tests first.**
- `prompts.test.ts`: system prompt contains schema/style/recipes; user prompt contains
  target + exemplars + directives and does **not** re-embed the full schema; ban-list
  single-source snapshot.

> **Explicitly NOT in this task:** adding `--temperature`, `max_tokens`, SDK caching, or
> tool-use JSON mode. Those require leaving the CLI and are out of scope (see §Out of scope).

---

# TIER 2 — Close the silent-acceptance holes

Places where bad output ships without anyone noticing.

## T2.1 — Make render a real gate, not best-effort

**Problem.** Render failures return `{ previewImageKeys: [] }`
([`pipeline/index.ts:112-115`](../../../pipeline/index.ts#L112-L115)); `run.ts` then keeps
placeholder previews and ingests anyway ([`run.ts:151-160`](../../../pipeline/run.ts#L151-L160)).
Blank renders still screenshot via the `fullPage` fallback
([`render.ts:167-176`](../../../pipeline/render.ts#L167-L176)).

**Goal.** A layout that did not confirmably render does not enter the paid catalog.

**Implementation.** Coordinate with T1.3 #5. Distinguish three render outcomes: **ok**
(real previews), **blank** (wrapper never exceeded the height threshold), **failed**
(exception). Blank and failed → drop with distinct counters (`renderFailed`, `renderBlank`)
rather than silent placeholder ingest. Keep the blank-detection reload loop
([`render.ts:150-166`](../../../pipeline/render.ts#L150-L166)) — it's good — but surface its
final verdict to `run.ts` instead of falling back to a full-viewport screenshot of an empty
page.

**Acceptance criteria.** Render exception → `renderFailed++`, no ingest. Persistently blank
render → `renderBlank++`, no ingest. Healthy render → ingested. `RunSummary` gains the two
counters.

**Tests first.** `run.test.ts` with a render stub returning ok/blank/failed each drives the
right branch.

## T2.2 — Separate infra errors from quality drops; add retry/backoff

**Problem.** The orchestrator's broad `catch` ([`run.ts:185-188`](../../../pipeline/run.ts#L185-L188))
increments `dropped` for *everything* — a network blip, a budget error, an upload failure,
and a genuinely bad layout are indistinguishable. No retry. Good targets are silently lost
to transient failures.

**Goal.** Transient infra failures are retried; the summary tells quality drops apart from
errors.

**Implementation.** Classify caught errors (LLM/network/upload/budget vs quality). Add
bounded retry-with-backoff for transient classes (respect the usage-limit non-retryable case
already handled in [`generate.ts:24`](../../../pipeline/generate.ts#L24)). Split
`RunSummary` into `qualityDropped` vs `errored`. Log the class on each failure.

**Acceptance criteria.** A stubbed transient failure retries then succeeds; a stubbed
permanent failure is counted as `errored`, not `qualityDropped`; a validator/lint failure is
`qualityDropped`. Usage-limit still fails fast.

**Tests first.** `run.test.ts` error-classification + retry cases.

## T2.3 — Harden validator verdict parsing

**Problem.** "Valid" requires exit 0 **and** a `PASS:` line
([`validate.ts:29`](../../../pipeline/validate.ts#L29)). If the validator exits 0 but prints
nothing matching `PASS:`, the layout is treated as invalid with **zero violations** — so the
repair prompt has nothing to act on, burns 2 retries, then drops a possibly-fine layout.

**Goal.** No layout is dropped due to an ambiguous validator output shape.

**Implementation.** Make the parse explicit about the three cases: PASS, FAIL-with-codes,
and unexpected/empty. On unexpected output, do not fabricate an empty-violation "invalid" —
surface it as an infra error (feeds T2.2 retry), or re-run the validator once. Add a guard
test against the current silent-failure path.

**Acceptance criteria.** Exit 0 + no `PASS:` line → treated as an infra/unexpected result
(retry/error), not a zero-violation drop. Real FAIL output still parses codes.

**Tests first.** `validate.test.ts`: the ambiguous-output case; normal PASS; normal FAIL.

## T2.4 — Quality floor + visibility for SEO/metadata

**Problem.** Empty `metaDescription` / missing `keywords` publish silently
([`seo.ts:54-55`](../../../pipeline/seo.ts#L54-L55); schema fields optional). Axis
mismatches silently revert to the target's value ([`seo.ts:57-60`](../../../pipeline/seo.ts#L57-L60)),
and off-enum colors are silently filtered — hiding a signal that the layout drifted from its
target.

**Goal.** Minimum metadata quality enforced; silent clamps become visible.

**Implementation.** Enforce a minimum `metaDescription` length and ≥N keywords (retry the
SEO call once if unmet). When `clampOne`/`clampMany` change a value, `log` it (a model
disagreeing with the assigned taxonomy often means the render doesn't match the target — a
useful QA signal, possibly a soft flag).

**Acceptance criteria.** A layout with empty meta description triggers one SEO retry; still
empty → logged/flagged. Axis clamps are logged.

**Tests first.** `seo.test.ts`: floor enforcement + retry; clamp logging.

---

# TIER 3 — Diversity & depth (why the catalog looks same-y)

## T3.1 — Diversify the design system beyond one slate palette

**Problem.** `defaultPalette` hardcodes tint `#F8FAFC`, dark `#0F172A`, heading/body fixed
([`brief.ts:36-45`](../../../pipeline/compose/brief.ts#L36-L45)). Every non-theme landing
gets the identical palette; only the accent hex varies. At catalog scale this reads as one
template recolored.

**Goal.** Palettes that genuinely vary by niche/style so pages look distinct.

**Implementation.** Replace the single `defaultPalette` with a **curated palette library**
keyed by style (and optionally niche): each entry a coherent {primary, secondary, tint,
dark, heading, body} set (dark themes, warm, cool, high-contrast, muted, etc.). Select
deterministically from the target (index-seeded, like `buildVariants` in
[`matrix.ts:133-151`](../../../pipeline/recipes/matrix.ts#L133-L151), no RNG so runs stay
resumable). Keep `accentColorHex` from the brief as an override hook. Theme packs
([`theme.ts`](../../../pipeline/theme.ts)) already pin palettes — leave those untouched.

**Acceptance criteria.** Two different styles produce visibly different tint/dark/text
colors, not just accent. Selection is deterministic for a given target. Theme-pinned briefs
still win.

**Tests first.** `brief.test.ts` / `palette.test.ts`: deterministic selection; style→palette
variety; pinned-brief override.

## T3.2 — Multiple treatments per section role, and more flow variety

**Problem.** `ROLE_DESIGN` is one fixed treatment per role
([`section-prompt.ts:18-49`](../../../pipeline/compose/section-prompt.ts#L18-L49)) — every
hero is "bold two-column," every FAQ an accordion. And flows are 5 hardcoded spines
([`flow.ts:27-33`](../../../pipeline/compose/flow.ts#L27-L33)) with keyword normalization
that silently funnels unknown business types to service/agency
([`flow.ts:36-44`](../../../pipeline/compose/flow.ts#L36-L44)). Structural monotony across
the catalog.

**Goal.** Structural variety per role and per page.

**Implementation.**
1. Give each role 2–3 treatment variants in `ROLE_DESIGN` (e.g. hero: split, centered
   full-bleed, offset-image). Select by style deterministically.
2. Add flow variants per business type, or let the Brief step propose the section flow
   (grounded by the untapped `LandingGuide.php`, see T3.3). Keep `hero` and `final_cta`
   required ([`compose/index.ts:43`](../../../pipeline/compose/index.ts#L43)).
3. Make the business-type normalization fall through to a *sensible default per detected
   signal* rather than always service/agency, and log unmatched types so the mapping can
   grow.

**Acceptance criteria.** Two same-type layouts of different styles differ in at least one
section treatment. Unmatched business types are logged. `hero`/`final_cta` still required.

**Tests first.** `section-prompt.test.ts`: variant selection deterministic per style;
`flow.test.ts`: variant flows; unmatched-type logging.

## T3.3 — Feed the untapped validator grounding (LandingGuide / ImageGuide)

**Problem.** [`grounding.ts:9-20`](../../../pipeline/recipes/grounding.ts#L9-L20) only loads
`STYLE.md`, `SCHEMA.md`, `section-recipes.json`. The validator repo also ships
`LandingGuide.php` (per-business-type page blueprints), `SiteGuide.php` (multi-page wiring),
and `ImageGuide.php` (image strategy) — the richest strategic grounding, currently unused.

**Goal.** Use the landing blueprint to inform flow/section selection and the image guide to
improve image directives.

**Implementation.** Extend `loadGrounding` to also read the landing/image guidance (from the
PHP-served content or a doc export — pick whichever the validator repo exposes cleanly;
don't parse PHP if a markdown/JSON export exists). Feed landing blueprints into T3.2's flow
selection, and image guidance into the image directives
([`prompts.ts:120-126`](../../../pipeline/recipes/prompts.ts#L120-L126)).

**Acceptance criteria.** Grounding object carries landing + image guidance; flow selection
and image directives reference them; falls back gracefully if the files are absent.

**Tests first.** `grounding.test.ts`: loads new guides; graceful absence fallback.

## T3.4 — Semantic exemplar retrieval + corpus growth

**Problem.** Retrieval is keyword/substring (type→kind map + industry `includes()`)
([`exemplars.ts:42-57`](../../../pipeline/library/exemplars.ts#L42-L57)), k=1. A "dental
clinic hero" retrieves by string match, not by semantic similarity. Corpus is 73 pages.

**Goal.** More relevant exemplars and a bigger corpus.

**Implementation.**
1. Precompute embeddings for the 337 exemplars **offline** (a build/index script — this is
   not the generation transport, so an embeddings call here does not violate constraint #1;
   but if you prefer zero external deps, a strong lexical scheme like BM25 over the section's
   industry+kind+module-palette is an acceptable no-network alternative — pick one and
   document it). Store vectors/scores alongside `index.json`. At generation time, retrieve
   top-k by similarity to the target descriptor.
2. Grow the corpus: run the existing `scripts/convert-library.sh` pipeline against more
   marketplace packs → more validated D5 pages → re-run `scripts/index-library.sh`.

**Acceptance criteria.** Retrieval returns semantically closer exemplars than the current
substring match on a labeled test set. Corpus regeneration is documented and repeatable.

**Tests first.** `exemplars.test.ts`: ranking prefers the semantically-closest fixture over
a mere string match.

---

# TIER 4 — Measurement & maintainability (do #4.1 early — it de-risks everything)

## T4.1 — Build a generation eval harness (build this FIRST in practice)

**Problem.** The only feedback today is `RunSummary` counters
([`run.ts:52`](../../../pipeline/run.ts#L52)). You cannot tell whether a prompt or grounding
change made layouts *better* — every change above is otherwise a vibes-based gamble.

**Goal.** A repeatable scoreboard so every task in this document is A/B-measurable.

**Implementation.** A script (`scripts/eval-generator.ts`) that runs the pipeline over a
fixed target set and reports, per config: validator pass-rate, mean repair attempts,
content-lint hit-rate, near-dupe rate (T1.2), vision-critic score distribution (T1.3),
tokens/cost per *accepted* layout, and drop reasons by class (T2.2). Support an A/B flag
(e.g. `USE_LIBRARY_EXEMPLARS` on/off) and print a comparison table. Deterministic target set
so runs are comparable.

**Acceptance criteria.** Running the harness on two configs prints a side-by-side table of
the metrics above. Wired to the same deps as `run.ts` so it measures the real path.

**Tests first.** `eval-generator.test.ts`: metric aggregation correctness on stubbed runs.

> **Practical note:** implement T4.1 before T1.4 and Tier 3 so those changes are validated,
> not guessed. It's listed in Tier 4 only because it's infrastructure, not a quality gate.

## T4.2 — Unify the two orchestrators

**Problem.** [`run.ts`](../../../pipeline/run.ts) and [`theme.ts`](../../../pipeline/theme.ts)
duplicate the entire gate sequence (validate→images→lint→mobile→dedupe→seo→upload→render→
ingest). Every gate added in Tiers 1–2 must be applied twice or they silently drift.

**Goal.** One orchestrator; themes are a thin config over it.

**Implementation.** Extract the per-layout gate pipeline into a single function that both the
matrix/vary path and the theme path call, parameterized by brief/flow/pinning. Migrate
`theme.ts` to call it. Do this **after** Tier 1–2 gates exist so you unify the final shape
once (or do it first and add gates once — your call, but do not maintain two copies of the
new gates).

**Acceptance criteria.** Both `run` and `theme` paths go through the same gate function; a
gate added in one place applies to both; existing theme tests pass.

**Tests first.** Shared-orchestrator test covering both entry configs.

## T4.3 — Consolidate the hand-synced per-type maps

**Problem.** Adding one section type requires editing five hand-maintained maps that must
stay in sync: `RECIPE_BY_TYPE` ([`prompts.ts:21-35`](../../../pipeline/recipes/prompts.ts#L21-L35)),
`KIND_BY_TYPE` ([`exemplars.ts:28-39`](../../../pipeline/library/exemplars.ts#L28-L39)),
`LAYOUTS_BY_TYPE` ([`matrix.ts:111-123`](../../../pipeline/recipes/matrix.ts#L111-L123)),
`ROLE_DESIGN` ([`section-prompt.ts:18-49`](../../../pipeline/compose/section-prompt.ts#L18-L49)),
`FLOWS` ([`flow.ts:27-33`](../../../pipeline/compose/flow.ts#L27-L33)).

**Goal.** One per-type registry so a new type is defined once.

**Implementation.** A single `SECTION_TYPES` registry keyed by type, each entry carrying its
recipe names, library kinds, layout variants, role design, and flow role. Derive the five
existing maps from it (or refactor call sites to read the registry). Add a test that every
`MATRIX`/`vary` type has a complete registry entry.

**Acceptance criteria.** Adding a type in one place makes it fully generatable. A
completeness test fails if any type is missing a field.

**Tests first.** `section-types.test.ts`: registry completeness for all generatable types.

---

# TIER 5 — Copy & image relevance (quality polish)

## T5.1 — LLM copy critic (beyond regex bans)

**Problem.** `content-lint` catches placeholder *tokens* but not *quality*
([`content-lint.ts`](../../../pipeline/content-lint.ts)) — it can't see generic, incoherent,
or cross-layout-duplicated boilerplate copy.

**Goal.** Catch weak/duplicated copy before ingest.

**Implementation.** Fold a copy-quality check into the vision critic call (T1.3) — the same
CLI invocation can also read the section text and rate specificity/tone/repetition — or add a
sibling CLI critic. Flag (not necessarily drop) low-specificity copy; drop obvious
cross-layout boilerplate. Keep it CLI-native.

**Acceptance criteria.** A generic "we deliver quality solutions" layout scores low; a
specific, benefit-led one passes. Cross-run repeated boilerplate is detectable.

**Tests first.** `copy-critic.test.ts`: scoring + threshold on fixtures.

## T5.2 — Image relevance enforcement

**Problem.** Pexels swap ([`images.ts`](../../../pipeline/images.ts)) takes the first result
for a keyword — can be off-topic — and `PLACEHOLDER_IMAGE` misses are downgraded to warnings
that still ship ([`run.ts:111,125,130`](../../../pipeline/run.ts#L111)). The prompt worries
about "hero image unrelated to the product" but can't enforce it.

**Goal.** Images actually match the section subject.

**Implementation.** Let the vision critic (T1.3) explicitly assess image relevance (it can
see the rendered photo). On a relevance fail, either re-resolve with a refined keyword or
flag. Surface placeholder-miss rate as a metric (T4.1) so you know how often Pexels misses.

**Acceptance criteria.** An off-topic hero image is flagged by the critic. Placeholder-miss
rate appears in the eval harness output.

**Tests first.** covered under `vision-critic.test.ts` (relevance branch).

---

## Explicitly out of scope (do NOT do these)

- **Porting to the Anthropic SDK/API.** No `@anthropic-ai/sdk`, no direct Anthropic HTTP.
  Stay on the `claude` CLI ([`claude-cli.ts`](../../../pipeline/llm/claude-cli.ts)).
- **`--temperature`, `max_tokens`, `top_p`, tool-use JSON output, `cache_control` API.**
  These require the SDK. The only inference-layer work permitted is CLI-compatible prompt
  hygiene (T1.4).
- **A human admin review queue.** Removed on purpose; ingest auto-publishes. All QA is
  in-pipeline (constraint #4).
- **`header` section type.** Dropped on purpose (constraint #5).
- **Reimplementing the validator in JS** (constraint #2).

## Suggested execution order

1. **T4.1 (eval harness)** — build the scoreboard first so everything else is measurable.
2. **T1.1, T1.2, T1.3** — the three highest-leverage quality wins from existing assets.
3. **T2.1–T2.4** — close the silent-acceptance holes.
4. **T1.4** — CLI prompt hygiene, validated against the eval harness.
5. **T3.1–T3.4** — diversity & depth.
6. **T4.2, T4.3** — unify orchestrators and maps (once, after the new gates exist).
7. **T5.1, T5.2** — copy/image relevance polish.

Work one task per branch/commit. Write the test first. Show verification output before
claiming done. Request code review at each tier boundary.

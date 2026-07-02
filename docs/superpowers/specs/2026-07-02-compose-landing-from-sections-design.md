# Compose full landing pages from sections — design

**Date:** 2026-07-02
**Status:** Approved (design), pending implementation
**Area:** `pipeline/` (generation)

## Problem

`full_landing` layouts are one Divi document of ~8 sections (~50–80KB of JSON).
That exceeds the reliable single-response output size of both Fable and Opus 4.8:
the model truncates mid-document, over-escapes the giant `post_content` string, or
narrates about "delivering it as a file rather than inline." The retry loop can't
help because the failure is deterministic (output too large), not intermittent.

Every individual *section* (hero, pricing, FAQ, …) generates reliably — the 20
section layouts in the catalog all succeeded first-or-second try. The fix is to
build a landing from many small, reliable section calls instead of one oversized
call.

## Approach (decided)

- **Cohesion:** a shared **brief**, generated once, injected into every section
  prompt (same business name, accent color, primary CTA, voice).
- **Section source:** generate **fresh** sections per landing (not reuse of
  catalog sections, which belong to different businesses/palettes).
- **Section flow:** the plugin landing guide's per-business-type persuasion spine
  (attention → problem → solution → benefits → proof → how-it-works → features →
  FAQ → final CTA), adapted by business type.

## Architecture

New module `pipeline/compose-landing.ts` exposing `composeLanding(target, deps)`
that returns `{ json }` shaped exactly like `generateLayout` — a stringified
`{ post_title, post_content }`. Everything downstream in `run.ts` (dedupe,
`resolveImages`, `stackLayoutJsonMobile`, `contentHash`, SEO, upload, render,
ingest) is unchanged; it just receives an assembled document.

`run.ts` routes `target.type === 'full_landing'` to `composeLanding`; all other
types keep calling `generateLayout`.

### Step 1 — Brief (1 LLM call)

Grounded on `{ niche, style, color? }` + the landing guide's "Step 0", the model
returns a structured JSON brief:

```
{
  businessType,        // e.g. "course/coaching" — chosen from the guide's set
  businessName,        // concrete, on-brand
  tagline,
  audience,            // who the page speaks to
  conversionGoal,      // the ONE action
  primaryCta,          // exact button label, reused across the page
  accentColorHex,      // one accent, e.g. "#E4572E"
  voice                // short style/tone note
}
```

Parsed with the existing robust `extractJson`. A brief failure (after retries)
drops the landing.

### Step 2 — Sections (~8 LLM calls)

Select the section flow from a `businessType → steps[]` map derived from the
landing guide (SaaS / service-agency / local / product / course-coaching), keyed
off the target niche with a sensible default. Each step has: a role id, the
section `type` used for recipe grounding, and a role instruction.

For each step, build a **section-role prompt** = the existing generation grounding
(schema, style guide, matching recipe via `RECIPE_BY_TYPE`) + the **brief injected
verbatim** (`accentColorHex`, `businessName`, `primaryCta`, `voice`) + the role's
job (from the guide). Generate via the same LLM path as `generateLayout`, so
`maxParseRetries` applies per section. Each output is a single small section
document — reliable.

CTA placement per the guide: primary CTA (same label) only at hero, after
benefits, after proof, and the final section — not every section.

### Step 3 — Assemble (pure function, no LLM)

A valid Divi page `post_content` is exactly one
`<!-- wp:divi/placeholder --> …sections… <!-- /wp:divi/placeholder -->` wrapper
containing N `<!-- wp:divi/section --> … <!-- /wp:divi/section -->` blocks.
Assembly:

1. From each generated section's `post_content`, extract the inner section
   block(s) (strip the per-section placeholder wrapper).
2. Concatenate them in flow order.
3. Wrap once in a single placeholder.

Produce `{ post_title, post_content }`. `post_title` comes from the brief
(business name + a landing descriptor).

**Empirically verified (2026-07-02):** three distinct section recipes
(`hero-cta`, `card-grid-3`, `testimonial`), placeholder-wrappers stripped and
concatenated under one wrapper, pass the deterministic validator with zero
violations. There is **no module-ID uniqueness constraint** — Divi 5 section
blocks carry no colliding IDs, so no ID regeneration is needed.

### Step 4 — Validate (hard gate)

**Per-section validation (added after Task 7 e2e).** Each section is validated —
and repaired at the section level (small, reliable) — *inside* `composeLanding`,
before assembly. `composeLanding` takes a `validate` dep and a `maxRepairs`; for
each section it generates → validates → repairs up to `maxRepairs` → and if still
invalid, drops the landing (required role) or skips the section (optional). Because
concatenation is validity-preserving, the assembled document is then valid by
construction.

`run.ts` still validates the assembled document as the hard gate, but **skips the
whole-document repair loop for `full_landing`** (`repairsAllowed = 0`). This is the
critical fix: a single bad section made the assembled ~50KB landing fail
validation, and the whole-document repair then tried to regenerate the entire
document in one call — hitting the model's output ceiling
(`error_max_budget_usd` / `stop_reason: max_tokens`), the exact wall the compose
approach exists to avoid. Repairing per-section keeps every repair small.

## Error handling

- Brief call fails after retries → drop landing, log.
- A **required** section (hero, final CTA) fails after retries → drop the whole
  landing, log which.
- An **optional** middle section fails → skip it and continue (a shorter but
  coherent page beats no page).
- Assembled document fails validation → drop, log codes.

## Integration points

- `run.ts`: branch on `target.type === 'full_landing'` → `composeLanding`.
- Reuse `buildGenerationPrompt` grounding pieces and `loadGrounding`.
- Reuse `extractJson`, `LlmError`, `maxParseRetries` behavior.

## Testing (TDD, write tests first)

Unit:
- **Brief prompt builder** — includes niche/style and asks for the structured
  fields; system prompt mandates JSON-only.
- **Section-role prompt builder** — injects the brief verbatim (accent hex,
  business name, CTA label) and the correct recipe for the role's section type.
- **Flow selection** — `businessType → steps[]` map returns the expected spine
  per type and a default for unknown.
- **Assembler** (pure) — given N section docs, returns one document with exactly
  one placeholder wrapper and N section blocks in flow order;
  string-literal-aware (braces inside Divi attribute strings).
- **composeLanding orchestration** — stub LLM returns a brief then N sections;
  asserts assembled `post_content` has N sections under one wrapper and the shared
  accent hex appears; required-section failure drops the landing.

Integration:
- `run.ts` routes `full_landing` to `composeLanding` and other types to
  `generateLayout` (stubbed).

## Non-goals (YAGNI)

- No reuse of existing catalog sections.
- No whole-document repair loop in v1 (sections retry; landing drops on hard
  failure).
- No UI/config surface for editing flows — the `businessType → steps` map is
  code-level.
- No change to the section pipeline for non-landing types.

## Cost

~1 brief + ~8 section calls per landing (small, reliable) instead of 1 oversized
call. Similar or lower total tokens; no output-ceiling risk. Runs on Opus 4.8.

# Layout Generator Hardening — final-review follow-ups

Source: final whole-branch review of `feat/generator-hardening` (17 tasks, T4.1→T5.2),
2026-07-07. The task-by-task ledger this rolls up lives in the gitignored
`.superpowers/sdd/progress.md` and will eventually be pruned/rotated — this file
exists so the follow-up tickets below survive that. Plan/workorder:
`docs/superpowers/specs/2026-07-07-layout-generator-hardening-workorder.md`.

None of these blocked merging the branch (all are Minor-severity carry-forwards
from individual task reviews, or operational/data follow-ups that need a real
generation run to act on). Listed roughly in priority order.

---

## 1. `buildThemeDeps` factory for `scripts/create-*.ts` theme scripts

`pipeline/theme.ts`'s `ThemeDeps` (T4.2) already extends `RunDeps` so every gate
`run.ts` grows — `visionCritic`, `nearDuplicateHashes`, `onEvent`, retry knobs,
the T2.1 render-outcome contract (`ok`/`blank`/error) — is *available* to theme
runs. But the `scripts/create-*-pack.ts` / `create-*-landing.ts` entry points
(`create-restaurant-pack.ts`, `create-blackline-pack.ts`,
`create-steakhouse-landing.ts`, `create-radiology-landing.ts`,
`create-test-pack.ts`) each hand-assemble their own deps object rather than
going through a shared factory analogous to `pipeline/deps.ts`'s
`buildRunDeps` — so today none of them actually wire `visionCritic` or
`nearDuplicateHashes`, and any new script copy-pastes the gap forward.

**Ask:** extract a `buildThemeDeps(opts)` in `pipeline/deps.ts` (or a sibling
file) mirroring `buildRunDeps`, so theme scripts get the same real gates
`npm run pipeline` gets, by construction, instead of by remembering to wire
each one by hand.

**Warning (T4.2's own carry-forward, restated so it isn't lost):** the
near-dupe pool exclusion for "don't drop a layout as a near-dupe of another
page in the *same* pack" is currently incoherent across a **resumed** theme
run — if `nearDuplicateHashes` gets wired into a theme run without also
teaching it to seed the in-run pool from what a previous (interrupted) run of
the *same* pack already ingested, a resume can either (a) miss real within-pack
near-dupes from the earlier partial run, or (b) never resume at all because
`nearDuplicateHashes`'s DB-backed pool now includes the pack's own
already-ingested pages and starts flagging siblings that were fine last time.
Whoever wires this must design the pool-seeding semantics first — don't just
flip it on. See `pipeline/theme.ts:114` (`growNearDupePool: false` / the
TODO(T4.2) comment) for where this plugs in.

---

## 2. Optional-section catch in `pipeline/compose/index.ts` should rethrow usage-limit/auth errors

`composeLandingSections` (`pipeline/compose/index.ts:141-145`) wraps each
optional section's `generateValidSection` call in a try/catch and, for any
non-required role, swallows the error into a `log(...)` + skip:

```ts
} catch (e) {
  if (REQUIRED_ROLES.has(step.role)) throw e;
  log(`skip optional section ${step.role}: ${(e as Error).message}`);
}
```

This is correct for a transient/content-lint failure on a "nice to have"
section — but it also silently swallows a **permanent** failure class (Claude
CLI usage-limit exhausted, auth failure) that T2.2 elsewhere treats as
run-aborting, not per-target-recoverable. A landing page with an
already-exhausted budget/auth will happily keep calling the CLI for every
remaining optional section, each failing the same way, before finally emitting
a landing page missing several sections — instead of aborting the run the way
`run.ts`'s Phase A/B split does for every other call site.

**Ask:** classify the caught error the same way `run.ts`/`validate.ts` do
(`usage_limit` / `auth` = permanent, rethrow through unconditionally even for
optional roles; everything else = today's swallow-and-skip behavior).

---

## 3. `criticPaths` blob-key fallback in `run.ts` should skip the critic when no local screenshot paths exist

`pipeline/run.ts:884`:

```ts
const criticPaths = renderMemo.screenshotPaths.length ? renderMemo.screenshotPaths : previewImageKeys;
```

`previewImageKeys` are Vercel Blob storage keys, not filesystem paths (see the
comment at `run.ts:213-215`). The vision critic runs through the `claude` CLI
with `--allowedTools Read` and needs real local file paths it can open — a
blob key isn't readable that way. Today, if `renderMemo.screenshotPaths` is
ever empty (e.g. a dry-run-adjacent path, or a future caller that doesn't wire
local temp files), the code falls through to calling the critic with blob
keys, which will silently fail to read anything useful rather than being
skipped outright.

**Ask:** when `renderMemo.screenshotPaths` is empty, skip the `visionCritic`
call entirely (treat it the same as `visionCritic` being undefined/unwired)
instead of substituting blob keys that the CLI can't read.

---

## 4. Phase A transient-failure regression test

T2.2's ledger entry already flagged this as untested: the Phase A (generation/
validation, pre-render) transient-infra retry path has no regression test
exercising "Phase A throws a `transient_infra`-classified error → bounded
retry-with-backoff → eventual success (or exhaustion → `errored`)" the way
Phase B's retry path is covered. Add one alongside the existing T2.2 tests in
`tests/pipeline-run*.test.ts` (or wherever the Phase B retry tests live) so a
future refactor of the Phase A/B split can't silently regress this without a
failing test.

---

## 5. Operational tuning pass — needs a real generation run

Several thresholds shipped with a documented, honest "not yet tuned against
real data" caveat and env-var escape hatches specifically so they can be tuned
later without a code change:

- **Near-dupe distance** — `PERCEPTUAL_DUPE_MAX_DISTANCE` (default 20/256
  bits, `pipeline/dedupe.ts`). Scaled analytically from the workorder's
  intended ~8% selectivity; never validated against real near-dupe pairs.
- **Copy-boilerplate shingle threshold** — `COPY_BOILERPLATE_MAX_OVERLAP`
  (default 0.5, `pipeline/copy-critic.ts`). 5-word shingle overlap; both the
  shingle size and the 0.5 cutoff are untuned against real generated copy.
- **T1.4 prompt-grounding A/B** — `PROMPT_GROUNDING_IN_SYSTEM` (default on).
  Run `scripts/eval-generator.ts` with the flag on vs. off across a real batch
  and compare validator pass-rate / cost before fully trusting the
  system-prompt-grounding layout as the sole path (the escape hatch exists
  precisely so this comparison can still happen after the fact).
- **Pricing exemplar cap** — `LIBRARY_EXEMPLAR_MAXCHARS` (default 6000,
  `pipeline/library/exemplars.ts`). Pricing-table exemplars run ~11-12k chars
  and currently bypass the cap by design (falls back to "smallest real
  instance" rather than injecting nothing) — re-tighten this once the corpus
  (§6 below) grows enough that a compact pricing exemplar actually exists.

None of these need code changes to act on — just data from a real
`ANTHROPIC_API_KEY` + Docker-render batch and a `.env.local` edit.

---

## 6. Corpus growth — testimonials/faq exemplar gap

Confirmed (T3.4, re-verified for this doc) across all 122 current source pages
in `pipeline/library/d5/*.json`: **zero** `divi/testimonial` modules and
**zero** `divi/toggle`/`divi/accordion` modules anywhere in the corpus. The few
sections whose source page is literally titled "Testimonial Page" or carries
an "FAQ" heading are empty shells (eyebrow + heading + generic filler, no real
quote or Q&A content in the per-card columns) — deliberately excluded from
`KIND_BY_TYPE` (`pipeline/library/exemplars.ts`) rather than shipped as
"real structure to imitate," since teaching the generator to imitate empty
cards is worse than falling back to the curated recipes already grounding
these two types (`RECIPE_BY_TYPE` in `pipeline/recipes/prompts.ts`).

**Ask:** source (buy/license or otherwise legitimately obtain) new premium Divi
5 page packs that actually contain testimonial carousels and FAQ
toggle/accordion sections, then run the existing, already-repeatable
conversion pipeline against them:

1. `scripts/convert-library.sh` (and/or `scripts/convert-poc.sh`) — converts a
   new source pack's raw export into `pipeline/library/d5/*.json`.
2. `scripts/index-library.ts` (invoked via `scripts/index-library.sh`) —
   rebuilds `pipeline/library/index.json` (the exemplar pool
   `getLibraryExemplars` filters/reads) and `pipeline/library/index-bm25.json`
   (the BM25 corpus statistics `rankByBm25` scores against).

No code changes needed — the gap is purely "this content doesn't exist in the
corpus yet," and the procedure to close it once new source packs are in hand
is already documented and scripted.

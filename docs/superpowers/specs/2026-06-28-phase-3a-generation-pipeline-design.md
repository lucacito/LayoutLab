# Phase 3a — Generation Pipeline (no render) — Design

**Status:** Approved (brainstorm) — 2026-06-28
**Roadmap:** CLAUDE.md §19, Phase 3 (split: 3a = generate→validate→SEO→ingest; 3b = render+screenshots)
**Predecessor:** Phase 2 (ingest API + admin queue) — complete, tagged `phase-2-complete`

---

## Goal

Stand up the standalone generation pipeline that produces **validated** Divi 5
layouts and feeds them into the catalog as `pending` — without the Docker render
environment. A run generates layout JSON with Claude (grounded in the real
validator style guide), gates each layout through the deterministic validator,
dedupes, generates SEO + taxonomy, stores the JSON, and POSTs to the Phase 2
ingest API. Render + real screenshots are Phase 3b; 3a uses placeholder previews.

Definition of done (CLAUDE.md §20): tests written first, validator gate intact,
idempotent + resumable, no invented schema, no secrets in any client bundle
(pipeline is server/local only), verification output shown.

---

## Key decisions (resolved in brainstorm)

1. **Validator wiring: CLI.** The pipeline shells out to the validator's PHP CLI
   `php scripts/validate.php <file>` (exit 0 valid / 1 invalid; prints
   `[CODE] message at: path`). Deterministic, fast, needs only local PHP +
   Composer — no Docker/WP. Configured via `VALIDATOR_CMD`. (Resolves the
   CLAUDE.md §9 open question; documented in `pipeline/validate.ts`.)
2. **Scope split: 3a (no render) now, 3b (render) later.** 3a delivers
   generate → validate → dedupe → SEO → upload → ingest with **placeholder
   preview URLs**. 3b adds the Docker WP+Divi render env, real Playwright
   screenshots, and perceptual-hash near-duplicate flagging.
3. **Generation backend: the Claude Code subscription CLI, behind a swappable
   adapter.** The pipeline shells out to `claude -p --output-format json`
   (headless), which authenticates with the user's existing Claude Code
   subscription — **no separate Anthropic API key**. A `LlmClient` interface
   keeps an API-key client as a future drop-in for unmetered big batches. This
   is a deliberate, minor deviation from CLAUDE.md §3 (which assumed the API
   SDK), justified by the user's preference; the adapter preserves both paths.
   Default backend: the subscription CLI. Cost is capped per call via
   `--max-budget-usd`.
4. **No invented schema.** Generation prompts are grounded in the validator
   repo's `docs/STYLE.md`, `docs/SCHEMA.md`, and real `fixtures/valid` examples.
   (CLAUDE.md §2.3.)
5. **Repair loop.** On a validation failure, the violation codes are fed back to
   Claude for up to `K` repair attempts; if still invalid, the layout is dropped
   and logged — never ingested. (CLAUDE.md §2.2, §10.3.)

### Scope boundaries (deferred, by design)

- **Docker WP+Divi render env, real Playwright screenshots, perceptual hash** →
  Phase 3b. 3a previews are placeholder URLs (same shape as the seed).
- **Pack auto-assembly** → admin curates packs manually (Phase 2 admin tools
  exist); pipeline-assisted assembly is later.
- **API-key generation backend** → adapter stub only; not wired until needed.
- **Big-batch generation at scale** → `drip --count=N` is the default first run
  so quality/cost are eyeballed before any large `batch`.

---

## Architecture & data flow

The pipeline is a standalone TypeScript CLI (`pipeline/`, run via `tsx`). It is
**server/local only** — never imported by the Next.js client bundle. It talks to
the web app only through `POST /api/ingest` (the single seam, CLAUDE.md §0).

```
pipeline/index.ts  (CLI: `batch` | `drip --count=N` | `--dry-run`)
   │
   ▼  per target {type, niche, style}, idempotent + resumable
plan (recipes/) ── coverage matrix; skip targets already covered
   │
   ▼
generate.ts ── LlmClient (claude -p) grounded in validator docs/STYLE.md,
   │            docs/SCHEMA.md, fixtures/valid → Divi 5 layout JSON
   ▼
validate.ts ── shell `VALIDATOR_CMD <file>` → { valid, violations[] }   ← HARD GATE
   │            └ invalid → feed codes back to generate (≤ K repairs), else drop+log
   ▼
dedupe.ts ── contentHash(json); skip if hash already ingested
   │
   ▼
seo.ts ── LlmClient → { title, slug, metaDescription, keywords, axes }
   │
   ▼
upload.ts ── JSON → Vercel Blob (if BLOB_READ_WRITE_TOKEN) else pipeline/out/;
   │          previewImageKeys = placeholder URLs (3b swaps real screenshots)
   ▼
ingest.ts ── POST /api/ingest  (Bearer INGEST_API_TOKEN)  → layout lands `pending`
```

**Idempotency & resumability:** the plan step skips `{type,niche,style}` combos
already present; `dedupe` skips exact content-hash matches; ingest is itself
idempotent on `content_hash` (Phase 2). Re-running never duplicates or
re-spends on already-completed work.

**Secrets:** `ANTHROPIC_API_KEY` (only if the API-key backend is ever used),
`INGEST_API_TOKEN`, `BLOB_READ_WRITE_TOKEN` are read from the pipeline's local
env, never shipped to any client. The subscription CLI uses the user's own
`claude` auth (no key in the repo).

---

## Components / units (each independently testable)

### 1. LLM adapter — `pipeline/llm/`
- **`LlmClient` interface:** `complete(input: { prompt: string; system?: string;
  maxBudgetUsd?: number }): Promise<string>`.
- **`claudeCliClient`:** shells `claude -p --output-format json
  --max-budget-usd <n>` (+ system via prompt), reads the JSON envelope, returns
  the assistant text. Errors (non-zero exit, budget cap, malformed envelope)
  throw a typed `LlmError`.
- **`extractJson(text): unknown`** — pure helper to pull a JSON object/array out
  of model output (handles fenced ```json blocks and surrounding prose).
- Future: `anthropicApiClient` (same interface) — stubbed, not wired.

### 2. Grounding + recipes — `pipeline/recipes/`
- **Coverage matrix:** the `{type, niche, style}` targets to cover (a typed
  array), aligned with the §7 taxonomy axis values already in
  `lib/catalog/filters.ts` (`AXIS_VALUES`).
- **`planTargets(covered, opts): Target[]`** — pure; returns the next targets to
  generate, excluding `covered` combos; honors `drip --count=N`.
- **Prompt builders:** `buildGenerationPrompt(target, guide)` and
  `buildRepairPrompt(prevJson, violations)` — pure; assemble the prompt from the
  validator grounding (`docs/STYLE.md` + `docs/SCHEMA.md` + a few `fixtures/valid`
  examples loaded at runtime) so no schema is invented.

### 3. Generate — `pipeline/generate.ts`
- **`generateLayout(target, deps): Promise<{ json: string }>`** — calls the
  `LlmClient` with the generation prompt, extracts JSON. The orchestrator wraps
  this with the validate+repair loop (so generate stays single-purpose).

### 4. Validate — `pipeline/validate.ts`
- **`validateLayout(file: string): Promise<ValidationResult>`** where
  `ValidationResult = { valid: boolean; violations: { code: string; message:
  string; path: string }[] }`. Shells `VALIDATOR_CMD` (default
  `php <validator>/scripts/validate.php`).
- **`parseValidatorOutput(stdout, exitCode): ValidationResult`** — pure; parses
  `PASS`/`FAIL` + `[CODE] message at: path` lines. Unit-tested against captured
  output; the shell path is integration-tested against real fixtures.

### 5. Dedupe — `pipeline/dedupe.ts`
- **`contentHash(json: string): string`** — sha256 over canonicalized JSON
  (stable key order, whitespace-insensitive). Pure, unit-tested. (Perceptual
  hash → 3b.)

### 6. SEO — `pipeline/seo.ts`
- **`generateSeo(json, target, deps): Promise<LayoutSeo>`** where `LayoutSeo =
  { title, slug, metaDescription, keywords[], axes: { type, niche, style,
  colors[] } }`. Uses the `LlmClient`; `slug` is slugified + uniqueness-suffixed
  by the orchestrator. The axis values are validated against `AXIS_VALUES`.

### 7. Upload — `pipeline/upload.ts`
- **`uploadLayout(hash, json, deps): Promise<{ diviJsonBlobKey: string;
  previewImageKeys: string[] }>`** — if `BLOB_READ_WRITE_TOKEN` is set, uploads
  the JSON via the existing `lib/blob` helper and returns its key; else writes
  `pipeline/out/<hash>.json` and returns a local key. `previewImageKeys` are
  deterministic placeholder URLs (3b replaces these with real screenshots).

### 8. Ingest — `pipeline/ingest.ts`
- **`postIngest(payload, deps): Promise<{ id: string; status: string; deduped:
  boolean }>`** — POSTs to `${SITE}/api/ingest` with
  `Authorization: Bearer ${INGEST_API_TOKEN}`. Maps non-2xx to typed errors
  (401 → auth, 422 → validation/not_validated). Payload matches the Phase 2
  `IngestPayload` (incl. `validatorPassed: true`, `contentHash`, blob keys,
  `seo`, `tags`).

### 9. Orchestrator — `pipeline/index.ts`
- CLI arg parsing (`batch` | `drip --count=N` | `--dry-run`). For each planned
  target: generate → validate (+repair loop, ≤ K) → dedupe (skip) → seo →
  upload → ingest; structured per-step logging; a run summary
  (generated / repaired / dropped / deduped / ingested). `--dry-run` uses a stub
  `LlmClient` and skips ingest, proving the orchestration with no spend.

---

## Error handling

- **Validation failure:** up to `K` repair attempts feeding violation codes back
  to Claude; still invalid → drop + log (with the codes) and continue. **Never
  ingest an invalid layout.**
- **Generation/SEO failure** (CLI non-zero, budget cap hit, unparseable JSON):
  drop that target, log, continue the run.
- **Dedup hit:** skip silently with a log line (not an error).
- **Ingest 401:** abort the run (misconfigured token). **Ingest 422:** log and
  drop that layout (should not happen if the validator gate held — flags a bug).
- **Resumability:** a crashed/interrupted run, re-run, skips covered combos and
  content-hash dupes; no duplicates, no double-spend.

---

## Testing strategy (TDD — test first)

- **Unit (no external deps):** `contentHash` (determinism + key-order
  canonicalization), `parseValidatorOutput` (PASS / FAIL-with-codes / usage),
  `planTargets` (skip-covered + count), `extractJson` (fenced + prose),
  prompt builders (grounding present, no invented block types), the ingest
  payload shape, SEO axis validation against `AXIS_VALUES`.
- **Integration (gated):** `validate.ts` against the real validator on
  `fixtures/valid` (PASS) and `fixtures/invalid` (FAIL) — gated on local `php` +
  the validator path; `ingest.ts` against the running local API — gated on a
  reachable `SITE` + `INGEST_API_TOKEN`.
- **Orchestrator dry-run:** `--dry-run` with a stub `LlmClient` runs the full
  flow (minus real generation + ingest) and asserts the summary counts — proves
  wiring with zero spend.
- **Real-generation smoke:** a single `drip --count=1` against the live `claude`
  CLI + local validator + local ingest is the manual acceptance walkthrough (one
  layout generated → validated → visible in `/admin/queue`). Opt-in, not in CI.
- CI: pure unit tests run everywhere; PHP/CLI/DB-gated tests skip when their
  dependency is absent.

---

## Out of scope for Phase 3a

The Docker WP+Divi render env, real Playwright screenshots, perceptual-hash
near-duplicate flagging (all Phase 3b), pipeline-assisted pack assembly,
Stripe/commerce, and the API-key generation backend (adapter stub only). Each
has its phase.

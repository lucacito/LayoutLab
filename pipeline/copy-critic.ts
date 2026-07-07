// pipeline/copy-critic.ts — T5.1 copy-quality gate.
//
// content-lint.ts (regex bans) catches placeholder TOKENS ("[Replace: …]", lorem
// ipsum, "$XX/mo") but has no opinion on whether finished, non-placeholder copy is
// any GOOD — generic filler ("we deliver quality solutions to help your business
// grow") sails straight through it. This module adds two independent, additive
// gates on top of that:
//
//  1. LLM-scored specificity/tone/repetition (`copyScore`/`copyIssues`) — FOLDED
//     into the vision critic's existing `claude -p` screenshot-scoring call
//     (pipeline/vision-critic.ts) rather than a second CLI round-trip per target,
//     per the brief's preferred option. This module supplies the extracted text +
//     rubric fragment vision-critic.ts appends to its prompt, plus the pure
//     threshold check (`meetsCopyBar`). Policy: FLAG ONLY — pipeline/run.ts logs +
//     emits a `copy_critic` RunEvent on a below-threshold score, but NEVER drops
//     for it alone (per the brief: "low-specificity copy → FLAG, do NOT drop").
//  2. Deterministic cross-layout boilerplate detection via word n-gram ("shingle")
//     overlap — NOT an LLM job: a single-shot critic call only ever sees ONE
//     layout, so it structurally cannot compare "is this the same boilerplate as
//     some other layout I scored an hour ago" — that requires a persisted pool to
//     compare against, which is exactly what dedupe.ts's perceptual-hash near-dupe
//     gate already does for RENDERED pixels. This mirrors that design for TEXT.
//     Policy: DROP — "obvious" (high-overlap) reuse is a distinct quality failure
//     from "generic but original" copy, so it gets its own drop reason
//     ('copy_boilerplate' — see pipeline/run.ts), never routed through the LLM
//     copyScore flag path.
//
// Scope note (T5.1 controller resolution: "if adding a DB text/shingle-hash query
// is heavy, in-run-only is acceptable — document"): unlike `nearDuplicateHashes`
// (RunDeps), there is no `priorCopyTexts` DB-backed pool here. The `layouts` table
// (db/schema.ts) stores no extracted-text/shingle column, and the layout JSON
// itself lives in Blob storage, not Postgres — a "cheap" cross-run query would
// mean either a schema migration (out of scope for this task) or fetching every
// candidate's Blob JSON per check (not cheap at all). pipeline/run.ts's in-run pool
// (grown only from THIS run's own accepted layouts, exactly like the near-dupe
// pool before T1.2 wired the DB seed) still catches the common case this task
// targets: a `vary`/matrix batch minting many near-identical layouts in one run.
// Cross-run detection is a documented follow-up, not a silent gap.

import { extractJson } from './llm';

/** The additive fields this module contributes to `VisionCriticResult`
 * (pipeline/vision-critic.ts) — both optional so a critic response that omits
 * them (an older prompt, or a model that ignored the copy rubric) never breaks
 * existing `{score, issues}` parsing/consumers. */
export interface CopyCriticResult {
  copyScore?: number;
  copyIssues?: string[];
}

// ---------------------------------------------------------------------------
// 1. Text extraction — shared by the folded critic prompt AND the shingle gate.
// ---------------------------------------------------------------------------

/**
 * Pulls the layout's visible prose out of its `post_content` — read from the SAME
 * JSON envelope content-lint.ts's `lintLayoutJson` reads (`JSON.parse(json).post_content`),
 * reused here rather than re-parsing the envelope differently.
 *
 * Divi 5 stores content as Gutenberg block comments with per-module JSON attrs
 * (see the validator repo's SCHEMA.md) — visible text lives in various nested
 * string VALUES depending on the module: a flat `{"content":"…"}` in this repo's
 * own simplified test fixtures, or the real nested shape
 * `{"content":{"innerContent":{"desktop":{"value":"<p>…</p>"}}}}` /
 * `{"button":{"innerContent":{"desktop":{"value":{"text":"…"}}}}}` in a real
 * render. Rather than hand-write a schema-aware walker for every module/attribute
 * shape (real risk of drifting from the grammar SCHEMA.md documents, and this
 * gate only needs "roughly the visible copy", not a byte-perfect extraction), this
 * harvests EVERY quoted JSON string VALUE in `post_content` (attribute KEYS are
 * excluded by requiring an immediately preceding `:`) and keeps only the ones that
 * look like prose once HTML tags are stripped — multi-word, mostly alphabetic, not
 * a color/URL/bare-number-with-unit.
 *
 * Known limitation (documented, not silently papered over): this can pull in
 * incidental multi-word string attributes that aren't visible copy (rare in
 * practice — most non-text Divi attributes are single tokens, colors, or numbers,
 * all filtered by `looksLikeProse`), and it can miss single-word labels/eyebrows
 * (filtered by the 2+-word rule, needed so the shingle gate below isn't fed noise
 * words as if they were sentences). Good enough for "does this read like real,
 * specific marketing copy" — not a general-purpose Divi content parser.
 */
export function extractLayoutText(json: string): string {
  let obj: { post_content?: unknown };
  try {
    obj = JSON.parse(json);
  } catch {
    return '';
  }
  const postContent = obj.post_content;
  if (typeof postContent !== 'string') return '';
  return extractProseFromMarkup(postContent);
}

// Captures JSON string VALUES (not keys) anywhere in the markup: a `:` followed
// by a double-quoted, escape-aware string. Reset `lastIndex` before each use since
// the regex carries `/g` state across calls on a shared module-level instance.
const VALUE_RE = /:\s*"((?:[^"\\]|\\.)*)"/g;

function extractProseFromMarkup(postContent: string): string {
  const values: string[] = [];
  VALUE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VALUE_RE.exec(postContent))) {
    values.push(m[1]);
  }
  const prose = values
    .map(decodeJsonEscapes)
    .map((v) =>
      v
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[a-zA-Z]+;|&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(looksLikeProse);
  return prose.join(' ').replace(/\s+/g, ' ').trim();
}

function decodeJsonEscapes(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw; // malformed escape — fall back to the raw capture rather than throw
  }
}

function looksLikeProse(s: string): boolean {
  if (s.length < 4) return false;
  if (/^#?[0-9a-fA-F]{3,8}$/.test(s)) return false; // hex color
  if (/^https?:\/\//i.test(s)) return false; // URL
  if (/^-?\d+(\.\d+)?(px|em|rem|%|vh|vw|deg|s|ms)?$/.test(s)) return false; // bare number/unit
  if (/^-?\d+(\.\d+)?(px|em|rem|%|vh|vw)?(\|-?\d+(\.\d+)?(px|em|rem|%|vh|vw)?){1,3}$/.test(s)) return false; // Divi "40px|20px|…" spacing shorthand
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const alphaChars = (s.match(/[a-zA-Z]/g) || []).length;
  return alphaChars / s.length > 0.5;
}

// ---------------------------------------------------------------------------
// 2. Deterministic cross-layout boilerplate detection (word n-gram overlap).
// ---------------------------------------------------------------------------

/**
 * Word-shingle size. 5 (not the more conventional-for-documents 8-10): these are
 * short marketing sections, not long-form documents, and a single word swapped in
 * an otherwise-copied sentence should still register as heavy overlap rather than
 * quietly falling below threshold — a smaller window survives more paraphrasing
 * per word changed relative to the sentence's total shingle count. Not tuned
 * against a real corpus of boilerplate/paraphrase pairs (none exists yet); revisit
 * once real `vary`-mode output is available, exactly like dedupe.ts's perceptual-
 * hash threshold note.
 */
export const SHINGLE_SIZE = 5;

/** Lowercased, whitespace-tokenized word n-grams of `text`. */
export function shingles(text: string, n: number = SHINGLE_SIZE): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) {
    out.add(words.slice(i, i + n).join(' '));
  }
  return out;
}

/**
 * Fraction of `text`'s shingles that also appear in `other`'s. Deliberately
 * asymmetric (denominator is `text`'s own shingle count, not the union/Jaccard
 * denominator) — the question this answers is "how much of THIS layout's copy is
 * boilerplate lifted from `other`", not general document similarity.
 */
export function shingleOverlap(text: string, other: string, n: number = SHINGLE_SIZE): number {
  const a = shingles(text, n);
  if (a.size === 0) return 0;
  const b = shingles(other, n);
  let hits = 0;
  for (const s of a) if (b.has(s)) hits++;
  return hits / a.size;
}

/** Highest overlap ratio between `text` and any entry in `priorTexts` — mirrors
 * dedupe.ts's `nearestDistance` shape (best match across a pool). */
export function highestShingleOverlap(text: string, priorTexts: string[], n: number = SHINGLE_SIZE): number {
  let max = 0;
  for (const other of priorTexts) {
    const o = shingleOverlap(text, other, n);
    if (o > max) max = o;
  }
  return max;
}

/** Default drop threshold: overlap STRICTLY ABOVE this fraction of a layout's own
 * shingles matching some prior layout's is "obvious" reused boilerplate, not just
 * two sections independently using similar common phrasing. Not tuned against a
 * real corpus — see the `SHINGLE_SIZE` note above. */
export const DEFAULT_COPY_BOILERPLATE_MAX_OVERLAP = 0.5;

/** Tunable via env `COPY_BOILERPLATE_MAX_OVERLAP` (0-1). Falls back to the
 * default on a missing/non-numeric/out-of-range value rather than throwing — a
 * misconfigured env var must not crash the pipeline (mirrors
 * `dedupe.ts#perceptualDupeMaxDistance`). */
export function copyBoilerplateMaxOverlap(): number {
  const raw = process.env.COPY_BOILERPLATE_MAX_OVERLAP;
  if (raw === undefined) return DEFAULT_COPY_BOILERPLATE_MAX_OVERLAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_COPY_BOILERPLATE_MAX_OVERLAP;
}

/**
 * True when `text` is an "obvious" boilerplate duplicate of something in
 * `priorTexts` — overlap strictly above `maxOverlap`. Text shorter than
 * `SHINGLE_SIZE` words never has any shingles at all, so it's treated as "too
 * short to meaningfully compare" (never flagged) rather than trivially matching
 * everything via an empty-set edge case. Pure/sync — independently unit-testable
 * without any real pool/fixture plumbing.
 */
export function isCopyBoilerplate(
  text: string,
  priorTexts: string[],
  maxOverlap: number = copyBoilerplateMaxOverlap(),
): boolean {
  if (!text || text.split(/\s+/).filter(Boolean).length < SHINGLE_SIZE) return false;
  return highestShingleOverlap(text, priorTexts) > maxOverlap;
}

// ---------------------------------------------------------------------------
// 3. LLM copyScore policy — flag-only, never a drop signal by itself.
// ---------------------------------------------------------------------------

/**
 * Mirrors vision-critic.ts's `meetsQualityBar`, but deliberately a DISTINCT
 * function (not a shared generic) since a `false` here carries different policy
 * weight: the vision gate's `meetsQualityBar` failing is a DROP; this one failing
 * is a FLAG (pipeline/run.ts never drops solely because `meetsCopyBar` is false —
 * see the `copy_critic` RunEvent). `copyScore === undefined` (the model didn't
 * return the additive field — an older prompt, or it ignored the rubric) is
 * treated as passing: no signal is not a bad signal.
 */
export function meetsCopyBar(copyScore: number | undefined, minScore: number): boolean {
  if (copyScore === undefined) return true;
  return copyScore >= minScore;
}

/**
 * The rubric fragment + additive JSON-contract line vision-critic.ts's
 * `buildVisionCriticPrompt` appends to its own prompt when it has extracted copy
 * text to judge. Kept here (not inlined in vision-critic.ts) so the copy rubric's
 * exact wording is independently reviewable/testable alongside the rest of this
 * module, and so vision-critic.ts doesn't need to know anything about copy
 * quality beyond "here's a text blob and a prompt fragment to splice in".
 */
export function buildCopyRubricSection(text: string): string {
  return `

Section copy (the actual text content, extracted from the layout JSON):
"""
${text}
"""

Also rate this copy 1-5 on SPECIFICITY, TONE, and non-repetition. Generic filler
("we deliver quality solutions", "your one-stop shop for X", "committed to
excellence") scores low even when grammatically correct; specific, benefit-led
copy that names a concrete audience, outcome, or detail scores high. Include this
as "copyScore" (1-5 integer) with "copyIssues" (short strings, e.g. "generic
tagline", "no concrete benefit named", "repeats the same phrase twice").`;
}

/** The additive JSON-contract fragment for the folded prompt's trailing
 * "Respond with ONLY JSON: …" line, used only when copy text was supplied. */
export const COPY_JSON_CONTRACT_FIELDS = '"copyScore": <1-5 integer>, "copyIssues": [<string>, ...]';

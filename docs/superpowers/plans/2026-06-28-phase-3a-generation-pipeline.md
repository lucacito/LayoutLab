# Phase 3a — Generation Pipeline (no render) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone `tsx` pipeline that generates Divi 5 layouts with the Claude CLI, gates them through the real PHP validator, dedupes, generates SEO + taxonomy, and POSTs them to the Phase 2 ingest API as `pending` — with placeholder previews (render is Phase 3b).

**Architecture:** Per-target flow (`plan → generate → validate(+repair) → dedupe → seo → upload → ingest`) composed from small, dependency-injected units under `pipeline/`. Generation uses a swappable `LlmClient` defaulting to the Claude Code subscription CLI (`claude -p`). Validation shells the validator's PHP CLI. The pipeline is server/local only and talks to the web app solely through `POST /api/ingest`.

**Tech Stack:** TypeScript + `tsx`, Node `child_process` (Claude CLI + PHP validator), `node:crypto` (content hash), the Phase 2 `IngestPayload` contract, Vitest. No new runtime dependencies.

## Global Constraints

- **Validator is the hard gate; never ingest an invalid layout.** Shell the real PHP CLI; on failure feed `[CODE]` violations back for ≤ `K` repairs, else drop+log. (§2.2, §10.3)
- **No invented schema.** Generation is grounded in the validator repo's `docs/STYLE.md`, `docs/SCHEMA.md`, and real `fixtures/valid` examples. (§2.3)
- **Idempotent + resumable.** Skip `{type,niche,style}` combos already covered; skip exact `content_hash` dupes; re-running never duplicates or double-spends. (§2.7)
- **Validator wiring = CLI:** `VALIDATOR_CMD` invokes `php scripts/validate.php`; exit 0 valid / 1 invalid / 2 usage; stdout has `PASS`/`FAIL` and `[CODE] message at: path`. (§9, decision 1)
- **Generation backend = Claude CLI** (`claude -p --output-format json --max-budget-usd`), reading the user's subscription auth — no `ANTHROPIC_API_KEY` required. Behind an `LlmClient` interface (API-key client deferred). (decision 3)
- **Pipeline is server/local only.** It reads `process.env` directly (NOT the Next `lib/env` singleton) and is never imported by the client bundle. Secrets stay local. (§2.6)
- **Placeholder previews in 3a.** `previewImageKeys` are deterministic placeholder URLs; real screenshots are Phase 3b. (decision 2)
- **Commit after every task** with a conventional-commit message ending in the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **DB/PHP/CLI-gated tests skip** when their dependency is absent (matches the Phase 1/2 convention).

---

### Task 1: LLM adapter (Claude CLI + pure parsers)

**Files:**
- Create: `pipeline/llm/types.ts`, `pipeline/llm/parse.ts`, `pipeline/llm/claude-cli.ts`, `pipeline/llm/index.ts`
- Test: `tests/pipeline-llm.test.ts`

**Interfaces:**
- Produces:
  - `interface LlmClient { complete(input: { prompt: string; system?: string; maxBudgetUsd?: number }): Promise<string> }`
  - `class LlmError extends Error`
  - `type RunCommand = (cmd: string, args: string[], input?: string) => Promise<{ stdout: string; stderr: string; code: number }>`
  - `extractJson(text: string): unknown` — pulls a JSON object/array out of model text (handles ```json fences + surrounding prose).
  - `parseClaudeEnvelope(stdout: string): string` — returns `.result` from the `claude -p --output-format json` envelope; throws `LlmError` if `is_error` / non-`success` subtype / unparseable.
  - `claudeCliClient(opts?: { run?: RunCommand; model?: string }): LlmClient`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-llm.test.ts
import { describe, it, expect, vi } from 'vitest';
import { extractJson, parseClaudeEnvelope, claudeCliClient, LlmError } from '@/pipeline/llm';

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses JSON inside a ```json fence with prose around it', () => {
    const t = 'Here you go:\n```json\n{"b":[1,2]}\n```\nDone.';
    expect(extractJson(t)).toEqual({ b: [1, 2] });
  });
  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('parseClaudeEnvelope', () => {
  it('returns the result text on success', () => {
    const env = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'hello' });
    expect(parseClaudeEnvelope(env)).toBe('hello');
  });
  it('throws on is_error true', () => {
    const env = JSON.stringify({ type: 'result', subtype: 'error_max_budget', is_error: true, result: '' });
    expect(() => parseClaudeEnvelope(env)).toThrow(LlmError);
  });
  it('throws on unparseable stdout', () => {
    expect(() => parseClaudeEnvelope('not json')).toThrow(LlmError);
  });
});

describe('claudeCliClient', () => {
  it('passes the prompt via stdin and returns parsed result text', async () => {
    const run = vi.fn(async (_cmd: string, _args: string[], input?: string) => ({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: `echo:${input}` }),
      stderr: '',
      code: 0,
    }));
    const client = claudeCliClient({ run });
    const out = await client.complete({ prompt: 'make a hero', maxBudgetUsd: 1 });
    expect(out).toBe('echo:make a hero');
    const [cmd, args] = run.mock.calls[0];
    expect(cmd).toBe('claude');
    expect(args).toContain('-p');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--max-budget-usd');
  });

  it('throws LlmError on a non-zero exit', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: 'boom', code: 1 }));
    const client = claudeCliClient({ run });
    await expect(client.complete({ prompt: 'x' })).rejects.toBeInstanceOf(LlmError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-llm.test.ts`
Expected: FAIL — cannot find `@/pipeline/llm`.

- [ ] **Step 3: Implement the adapter**

```ts
// pipeline/llm/types.ts
export interface LlmClient {
  complete(input: { prompt: string; system?: string; maxBudgetUsd?: number }): Promise<string>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

export type RunCommand = (
  cmd: string,
  args: string[],
  input?: string,
) => Promise<{ stdout: string; stderr: string; code: number }>;
```

```ts
// pipeline/llm/parse.ts
import { LlmError } from './types';

// Pull a JSON value out of model text: a ```json fence if present, else the
// first balanced {...} or [...] span.
export function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fence ? fence[1] : sliceBalanced(text);
  if (candidate == null) throw new Error('no JSON found in text');
  return JSON.parse(candidate.trim());
}

function sliceBalanced(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function parseClaudeEnvelope(stdout: string): string {
  let env: { subtype?: string; is_error?: boolean; result?: string };
  try {
    env = JSON.parse(stdout);
  } catch {
    throw new LlmError(`claude CLI returned non-JSON output: ${stdout.slice(0, 200)}`);
  }
  if (env.is_error || env.subtype !== 'success' || typeof env.result !== 'string') {
    throw new LlmError(`claude CLI error (subtype=${env.subtype}): ${env.result ?? ''}`);
  }
  return env.result;
}
```

```ts
// pipeline/llm/claude-cli.ts
import { spawn } from 'node:child_process';
import type { LlmClient, RunCommand } from './types';
import { LlmError } from './types';
import { parseClaudeEnvelope } from './parse';

const defaultRun: RunCommand = (cmd, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });

export function claudeCliClient(opts: { run?: RunCommand; model?: string } = {}): LlmClient {
  const run = opts.run ?? defaultRun;
  return {
    async complete({ prompt, system, maxBudgetUsd }) {
      const args = ['-p', '--output-format', 'json'];
      if (maxBudgetUsd != null) args.push('--max-budget-usd', String(maxBudgetUsd));
      if (system) args.push('--append-system-prompt', system);
      if (opts.model) args.push('--model', opts.model);
      const { stdout, stderr, code } = await run('claude', args, prompt);
      if (code !== 0) throw new LlmError(`claude CLI exited ${code}: ${stderr.slice(0, 200)}`);
      return parseClaudeEnvelope(stdout);
    },
  };
}
```

```ts
// pipeline/llm/index.ts
export * from './types';
export { extractJson, parseClaudeEnvelope } from './parse';
export { claudeCliClient } from './claude-cli';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-llm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/llm tests/pipeline-llm.test.ts
git commit -m "feat: pipeline LLM adapter (Claude CLI) + pure parsers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Validator wiring (PHP CLI)

**Files:**
- Create: `pipeline/validate.ts`
- Modify: `.env.example` (document `VALIDATOR_CMD`)
- Test: `tests/pipeline-validate.test.ts`

**Interfaces:**
- Consumes: `RunCommand` (Task 1).
- Produces:
  - `interface Violation { code: string; message: string; path: string }`
  - `interface ValidationResult { valid: boolean; violations: Violation[] }`
  - `parseValidatorOutput(stdout: string, code: number): ValidationResult` — pure.
  - `validateLayout(file: string, opts?: { run?: RunCommand; validatorCmd?: string }): Promise<ValidationResult>` — shells `VALIDATOR_CMD <file>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-validate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseValidatorOutput, validateLayout } from '@/pipeline/validate';

const PASS = 'PASS: x.json\n  Layout is valid. No violations found.\n';
const FAIL =
  'FAIL: x.json\n  2 violation(s):\n\n' +
  '  [E_MODULE_UNKNOWN] Unknown module type\n        at: content.0.children.1\n' +
  '  [E_ATTR_MISSING] Missing required attribute\n        at: content.0\n';

describe('parseValidatorOutput', () => {
  it('marks valid on exit 0 / PASS', () => {
    const r = parseValidatorOutput(PASS, 0);
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
  it('parses violation codes/messages/paths on exit 1 / FAIL', () => {
    const r = parseValidatorOutput(FAIL, 1);
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(2);
    expect(r.violations[0]).toEqual({ code: 'E_MODULE_UNKNOWN', message: 'Unknown module type', path: 'content.0.children.1' });
    expect(r.violations[1].code).toBe('E_ATTR_MISSING');
  });
});

describe('validateLayout', () => {
  it('invokes VALIDATOR_CMD with the file and returns the parsed result', async () => {
    const run = vi.fn(async () => ({ stdout: PASS, stderr: '', code: 0 }));
    const r = await validateLayout('/tmp/x.json', { run, validatorCmd: 'php /v/validate.php' });
    expect(r.valid).toBe(true);
    const [cmd, args] = run.mock.calls[0];
    expect(cmd).toBe('php');
    expect(args).toEqual(['/v/validate.php', '/tmp/x.json']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-validate.test.ts`
Expected: FAIL — cannot find `@/pipeline/validate`.

- [ ] **Step 3: Implement the validator wiring**

```ts
// pipeline/validate.ts
//
// Validator wiring decision (CLAUDE.md §9): OPTION A — CLI.
// We shell out to the validator repo's PHP entry point. Set VALIDATOR_CMD to the
// invocation, e.g.  VALIDATOR_CMD='php "/abs/path/Divi 5 Deterministic Validator/scripts/validate.php"'
// validateLayout appends the file path. Exit 0 = valid, 1 = invalid, 2 = usage.
import { spawn } from 'node:child_process';
import type { RunCommand } from './llm/types';

export interface Violation {
  code: string;
  message: string;
  path: string;
}
export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

const defaultRun: RunCommand = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });

export function parseValidatorOutput(stdout: string, code: number): ValidationResult {
  if (code === 0 && /^PASS:/m.test(stdout)) return { valid: true, violations: [] };

  const violations: Violation[] = [];
  const lines = stdout.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\[([A-Z0-9_]+)\]\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const atLine = lines[i + 1] ?? '';
    const at = /^\s*at:\s*(.*)$/.exec(atLine);
    violations.push({ code: m[1], message: m[2].trim(), path: at ? at[1].trim() : '' });
  }
  return { valid: false, violations };
}

// Split a VALIDATOR_CMD string into argv, honoring simple "double quotes".
function splitCmd(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2]);
  return out;
}

export async function validateLayout(
  file: string,
  opts: { run?: RunCommand; validatorCmd?: string } = {},
): Promise<ValidationResult> {
  const run = opts.run ?? defaultRun;
  const cmd = opts.validatorCmd ?? process.env.VALIDATOR_CMD;
  if (!cmd) throw new Error('VALIDATOR_CMD is not set (e.g. `php /path/validate.php`)');
  const parts = splitCmd(cmd);
  const { stdout, code } = await run(parts[0], [...parts.slice(1), file]);
  return parseValidatorOutput(stdout, code);
}
```

In `.env.example`, under the pipeline section, add:

```
# How the pipeline invokes the deterministic validator (CLAUDE.md §9, Option A: CLI).
# Points at the sibling validator repo's PHP entry; the file path is appended.
VALIDATOR_CMD=php "../Divi 5 Deterministic Validator/scripts/validate.php"
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/validate.ts tests/pipeline-validate.test.ts .env.example
git commit -m "feat: pipeline validator wiring (PHP CLI) + output parser

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Content-hash dedupe

**Files:**
- Create: `pipeline/dedupe.ts`
- Test: `tests/pipeline-dedupe.test.ts`

**Interfaces:**
- Produces: `contentHash(json: string): string` — sha256 over canonicalized JSON (stable key order, whitespace-insensitive). Same logical layout → same hash regardless of key order/formatting.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-dedupe.test.ts
import { describe, it, expect } from 'vitest';
import { contentHash } from '@/pipeline/dedupe';

describe('contentHash', () => {
  it('is stable across key order and whitespace', () => {
    const a = '{"x":1,"y":[1,2],"z":{"b":2,"a":1}}';
    const b = '{\n  "y": [1, 2],\n  "z": { "a": 1, "b": 2 },\n  "x": 1\n}';
    expect(contentHash(a)).toBe(contentHash(b));
  });
  it('differs when content differs', () => {
    expect(contentHash('{"x":1}')).not.toBe(contentHash('{"x":2}'));
  });
  it('returns a 64-char hex sha256', () => {
    expect(contentHash('{"x":1}')).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-dedupe.test.ts`
Expected: FAIL — cannot find `@/pipeline/dedupe`.

- [ ] **Step 3: Implement**

```ts
// pipeline/dedupe.ts
import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canonicalize((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return value;
}

export function contentHash(json: string): string {
  const canonical = JSON.stringify(canonicalize(JSON.parse(json)));
  return createHash('sha256').update(canonical).digest('hex');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-dedupe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/dedupe.ts tests/pipeline-dedupe.test.ts
git commit -m "feat: pipeline content-hash dedupe (canonicalized sha256)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Recipes — coverage matrix, plan, prompt builders

**Files:**
- Create: `pipeline/recipes/matrix.ts`, `pipeline/recipes/prompts.ts`, `pipeline/recipes/grounding.ts`, `pipeline/recipes/index.ts`
- Test: `tests/pipeline-recipes.test.ts`

**Interfaces:**
- Consumes: `AXIS_VALUES` (`@/lib/catalog/filters`), `Violation` (`@/pipeline/validate`).
- Produces:
  - `interface Target { type: string; niche: string; style: string }`
  - `MATRIX: Target[]` — curated coverage targets (axis values drawn from `AXIS_VALUES`).
  - `targetKey(t: Target): string` (`"type|niche|style"`).
  - `planTargets(matrix: Target[], covered: Set<string>, count?: number): Target[]`.
  - `interface Guide { style: string; schema: string; examples: string[] }`
  - `buildGenerationPrompt(target: Target, guide: Guide): { system: string; prompt: string }`
  - `buildRepairPrompt(prevJson: string, violations: Violation[]): { system: string; prompt: string }`
  - `loadGrounding(validatorDir: string): Guide` — reads `docs/STYLE.md`, `docs/SCHEMA.md`, and up to 2 `fixtures/valid/*.json` examples.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-recipes.test.ts
import { describe, it, expect } from 'vitest';
import { MATRIX, targetKey, planTargets, buildGenerationPrompt, buildRepairPrompt } from '@/pipeline/recipes';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('coverage matrix + plan', () => {
  it('every MATRIX target uses known axis values', () => {
    expect(MATRIX.length).toBeGreaterThan(0);
    for (const t of MATRIX) {
      expect(AXIS_VALUES.type).toContain(t.type);
      expect(AXIS_VALUES.niche).toContain(t.niche);
      expect(AXIS_VALUES.style).toContain(t.style);
    }
  });
  it('planTargets skips covered combos and honors count', () => {
    const covered = new Set([targetKey(MATRIX[0])]);
    const planned = planTargets(MATRIX, covered);
    expect(planned.map(targetKey)).not.toContain(targetKey(MATRIX[0]));
    expect(planTargets(MATRIX, new Set(), 2)).toHaveLength(2);
  });
});

describe('prompt builders', () => {
  const guide = { style: 'STYLE GUIDE TEXT', schema: 'SCHEMA TEXT', examples: ['{"ex":1}'] };
  it('generation prompt embeds the grounding and the target', () => {
    const { system, prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(system + prompt).toContain('STYLE GUIDE TEXT');
    expect(system + prompt).toContain('SCHEMA TEXT');
    expect(prompt).toContain('hero');
    expect(prompt).toContain('saas');
  });
  it('repair prompt includes the prior JSON and the violation codes', () => {
    const { prompt } = buildRepairPrompt('{"bad":1}', [{ code: 'E_X', message: 'bad thing', path: 'a.b' }]);
    expect(prompt).toContain('E_X');
    expect(prompt).toContain('bad thing');
    expect(prompt).toContain('{"bad":1}');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-recipes.test.ts`
Expected: FAIL — cannot find `@/pipeline/recipes`.

- [ ] **Step 3: Implement the recipes**

```ts
// pipeline/recipes/matrix.ts
export interface Target {
  type: string;
  niche: string;
  style: string;
}

// Curated starter coverage. Axis values must exist in AXIS_VALUES
// (lib/catalog/filters.ts). Expand over time; planTargets skips covered combos.
export const MATRIX: Target[] = [
  { type: 'hero', niche: 'saas', style: 'minimal' },
  { type: 'hero', niche: 'agency', style: 'bold' },
  { type: 'pricing', niche: 'saas', style: 'dark' },
  { type: 'features', niche: 'saas', style: 'minimal' },
  { type: 'testimonials', niche: 'coaching', style: 'elegant' },
  { type: 'cta', niche: 'fitness', style: 'bold' },
  { type: 'faq', niche: 'nonprofit', style: 'minimal' },
  { type: 'footer', niche: 'agency', style: 'dark' },
  { type: 'contact', niche: 'real_estate', style: 'corporate' },
  { type: 'gallery', niche: 'portfolio', style: 'playful' },
];

export function targetKey(t: Target): string {
  return `${t.type}|${t.niche}|${t.style}`;
}

export function planTargets(matrix: Target[], covered: Set<string>, count?: number): Target[] {
  const remaining = matrix.filter((t) => !covered.has(targetKey(t)));
  return count != null ? remaining.slice(0, count) : remaining;
}
```

```ts
// pipeline/recipes/prompts.ts
import type { Target } from './matrix';
import type { Violation } from '@/pipeline/validate';

export interface Guide {
  style: string;
  schema: string;
  examples: string[];
}

const SYSTEM =
  'You generate Divi 5 page layouts as a single JSON document. ' +
  'You MUST follow the provided Divi 5 schema and style guide exactly and use ONLY ' +
  'block/module types shown in the examples — never invent block types or attributes. ' +
  'Respond with ONLY the JSON document, no prose.';

export function buildGenerationPrompt(target: Target, guide: Guide): { system: string; prompt: string } {
  const examples = guide.examples.map((e, i) => `Example ${i + 1}:\n${e}`).join('\n\n');
  const prompt = [
    `Generate a Divi 5 "${target.type}" section for a ${target.style} ${target.niche} website.`,
    '',
    '=== DIVI 5 SCHEMA ===',
    guide.schema,
    '',
    '=== STYLE GUIDE ===',
    guide.style,
    '',
    '=== VALID EXAMPLES (structure to imitate; do not copy content) ===',
    examples,
    '',
    'Output ONLY the JSON for the new layout.',
  ].join('\n');
  return { system: SYSTEM, prompt };
}

export function buildRepairPrompt(prevJson: string, violations: Violation[]): { system: string; prompt: string } {
  const list = violations.map((v) => `- [${v.code}] ${v.message}${v.path ? ` (at ${v.path})` : ''}`).join('\n');
  const prompt = [
    'The Divi 5 layout you produced failed deterministic validation with these violations:',
    list,
    '',
    'Here is the layout you produced:',
    prevJson,
    '',
    'Fix ONLY what the violations require, keeping the design intent. Output ONLY the corrected JSON.',
  ].join('\n');
  return { system: SYSTEM, prompt };
}
```

```ts
// pipeline/recipes/grounding.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Guide } from './prompts';

// Loads generation grounding from the sibling validator repo: the schema + style
// guide docs and a couple of real valid-layout fixtures. No invented schema.
export function loadGrounding(validatorDir: string): Guide {
  const style = readFileSync(join(validatorDir, 'docs', 'STYLE.md'), 'utf8');
  const schema = readFileSync(join(validatorDir, 'docs', 'SCHEMA.md'), 'utf8');
  const validDir = join(validatorDir, 'fixtures', 'valid');
  const examples = readdirSync(validDir)
    .filter((f) => f.endsWith('.json'))
    .slice(0, 2)
    .map((f) => readFileSync(join(validDir, f), 'utf8'));
  return { style, schema, examples };
}
```

```ts
// pipeline/recipes/index.ts
export type { Target } from './matrix';
export { MATRIX, targetKey, planTargets } from './matrix';
export type { Guide } from './prompts';
export { buildGenerationPrompt, buildRepairPrompt } from './prompts';
export { loadGrounding } from './grounding';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-recipes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/recipes tests/pipeline-recipes.test.ts
git commit -m "feat: pipeline recipes — coverage matrix, plan, grounded prompts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Generate step

**Files:**
- Create: `pipeline/generate.ts`
- Test: `tests/pipeline-generate.test.ts`

**Interfaces:**
- Consumes: `LlmClient` (Task 1), `extractJson` (Task 1), `Target`/`Guide`/`buildGenerationPrompt` (Task 4).
- Produces: `generateLayout(target: Target, deps: { llm: LlmClient; guide: Guide; maxBudgetUsd?: number }): Promise<{ json: string }>` — one generation; the validate+repair loop lives in the orchestrator (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-generate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateLayout } from '@/pipeline/generate';

const guide = { style: 's', schema: 'sc', examples: ['{"e":1}'] };

describe('generateLayout', () => {
  it('prompts the LLM and returns the extracted JSON string', async () => {
    const llm = { complete: vi.fn(async () => '```json\n{"content":[]}\n```') };
    const { json } = await generateLayout({ type: 'hero', niche: 'saas', style: 'minimal' }, { llm, guide });
    expect(JSON.parse(json)).toEqual({ content: [] });
    expect(llm.complete).toHaveBeenCalledOnce();
    const arg = llm.complete.mock.calls[0][0];
    expect(arg.prompt).toContain('hero');
  });

  it('throws when the model returns no JSON', async () => {
    const llm = { complete: vi.fn(async () => 'sorry, no') };
    await expect(generateLayout({ type: 'hero', niche: 'saas', style: 'minimal' }, { llm, guide })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-generate.test.ts`
Expected: FAIL — cannot find `@/pipeline/generate`.

- [ ] **Step 3: Implement**

```ts
// pipeline/generate.ts
import type { LlmClient } from './llm';
import { extractJson } from './llm';
import type { Target, Guide } from './recipes';
import { buildGenerationPrompt } from './recipes';

export async function generateLayout(
  target: Target,
  deps: { llm: LlmClient; guide: Guide; maxBudgetUsd?: number },
): Promise<{ json: string }> {
  const { system, prompt } = buildGenerationPrompt(target, deps.guide);
  const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
  const obj = extractJson(text); // throws if no JSON
  return { json: JSON.stringify(obj) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/generate.ts tests/pipeline-generate.test.ts
git commit -m "feat: pipeline generate step (grounded LLM → layout JSON)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: SEO + taxonomy step

**Files:**
- Create: `pipeline/seo.ts`
- Test: `tests/pipeline-seo.test.ts`

**Interfaces:**
- Consumes: `LlmClient`/`extractJson` (Task 1), `Target` (Task 4), `AXIS_VALUES` (`@/lib/catalog/filters`).
- Produces:
  - `slugify(s: string): string` — pure.
  - `interface LayoutSeo { title: string; slug: string; metaDescription: string; keywords: string[]; axes: { type: string; niche: string; style: string; colors: string[] } }`
  - `generateSeo(json: string, target: Target, deps: { llm: LlmClient; maxBudgetUsd?: number }): Promise<LayoutSeo>` — LLM proposes title/meta/keywords/axes; axis values are clamped to `AXIS_VALUES`, falling back to the `target` when the model returns an unknown value; `slug` is `slugify(title)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-seo.test.ts
import { describe, it, expect, vi } from 'vitest';
import { slugify, generateSeo } from '@/pipeline/seo';

describe('slugify', () => {
  it('lowercases, strips punctuation, and hyphenates', () => {
    expect(slugify('Bold SaaS Hero!')).toBe('bold-saas-hero');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
  });
});

describe('generateSeo', () => {
  const target = { type: 'hero', niche: 'saas', style: 'minimal' };
  it('returns SEO with clamped axes and a slug derived from the title', async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({
          title: 'Minimal SaaS Hero',
          metaDescription: 'A clean hero.',
          keywords: ['hero', 'saas'],
          axes: { type: 'hero', niche: 'saas', style: 'minimal', colors: ['blue', 'not-a-real-color'] },
        }),
      ),
    };
    const seo = await generateSeo('{"content":[]}', target, { llm });
    expect(seo.slug).toBe('minimal-saas-hero');
    expect(seo.axes.colors).toContain('blue');
    expect(seo.axes.colors).not.toContain('not-a-real-color'); // clamped to AXIS_VALUES.color
    expect(seo.axes.type).toBe('hero');
  });

  it('falls back to the target axes when the model returns unknown axis values', async () => {
    const llm = {
      complete: vi.fn(async () =>
        JSON.stringify({ title: 'X', metaDescription: 'y', keywords: [], axes: { type: 'bogus', niche: 'bogus', style: 'bogus', colors: [] } }),
      ),
    };
    const seo = await generateSeo('{}', target, { llm });
    expect(seo.axes.type).toBe('hero');
    expect(seo.axes.niche).toBe('saas');
    expect(seo.axes.style).toBe('minimal');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-seo.test.ts`
Expected: FAIL — cannot find `@/pipeline/seo`.

- [ ] **Step 3: Implement**

```ts
// pipeline/seo.ts
import type { LlmClient } from './llm';
import { extractJson } from './llm';
import type { Target } from './recipes';
import { AXIS_VALUES } from '@/lib/catalog/filters';

export interface LayoutSeo {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  axes: { type: string; niche: string; style: string; colors: string[] };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampOne(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}
function clampMany(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && allowed.includes(v));
}

const SYSTEM =
  'You write SEO metadata for a Divi 5 layout. Respond with ONLY a JSON object: ' +
  '{ "title", "metaDescription", "keywords": string[], "axes": { "type","niche","style","colors": string[] } }.';

export async function generateSeo(
  json: string,
  target: Target,
  deps: { llm: LlmClient; maxBudgetUsd?: number },
): Promise<LayoutSeo> {
  const prompt = [
    `Write SEO metadata for this Divi 5 ${target.type} layout (niche: ${target.niche}, style: ${target.style}).`,
    `Allowed axis values — type: ${AXIS_VALUES.type.join(', ')}; niche: ${AXIS_VALUES.niche.join(', ')}; style: ${AXIS_VALUES.style.join(', ')}; colors: ${AXIS_VALUES.color.join(', ')}.`,
    'Layout JSON:',
    json,
  ].join('\n');

  const text = await deps.llm.complete({ prompt, system: SYSTEM, maxBudgetUsd: deps.maxBudgetUsd });
  const raw = extractJson(text) as Record<string, unknown>;
  const axes = (raw.axes ?? {}) as Record<string, unknown>;

  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : `${target.style} ${target.niche} ${target.type}`;
  return {
    title,
    slug: slugify(title),
    metaDescription: typeof raw.metaDescription === 'string' ? raw.metaDescription : '',
    keywords: Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === 'string') : [],
    axes: {
      type: clampOne(axes.type, AXIS_VALUES.type, target.type),
      niche: clampOne(axes.niche, AXIS_VALUES.niche, target.niche),
      style: clampOne(axes.style, AXIS_VALUES.style, target.style),
      colors: clampMany(axes.colors, AXIS_VALUES.color),
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/seo.ts tests/pipeline-seo.test.ts
git commit -m "feat: pipeline SEO + taxonomy step (axis-clamped, slugified)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Upload step (Blob or local) + placeholder previews

**Files:**
- Create: `pipeline/upload.ts`
- Test: `tests/pipeline-upload.test.ts`

**Interfaces:**
- Consumes: `uploadAsset` (`@/lib/blob`).
- Produces:
  - `previewUrls(hash: string, n?: number): string[]` — deterministic placeholder URLs.
  - `interface UploadResult { diviJsonBlobKey: string; previewImageKeys: string[] }`
  - `uploadLayout(hash: string, json: string, deps: { hasBlobToken: boolean; outDir: string; upload?: (key: string, data: Buffer, ct: string) => Promise<{ url: string }>; writeFile?: (path: string, data: string) => void }): Promise<UploadResult>` — uploads JSON to Blob when `hasBlobToken`, else writes it under `outDir`; previews are placeholder URLs (3b replaces these).

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-upload.test.ts
import { describe, it, expect, vi } from 'vitest';
import { previewUrls, uploadLayout } from '@/pipeline/upload';

describe('previewUrls', () => {
  it('is deterministic per hash and returns 3 by default', () => {
    const a = previewUrls('abc');
    expect(a).toHaveLength(3);
    expect(previewUrls('abc')).toEqual(a);
    expect(a[0]).toContain('abc');
  });
});

describe('uploadLayout', () => {
  it('uploads JSON to Blob when a token is present', async () => {
    const upload = vi.fn(async (key: string) => ({ url: `https://blob/${key}` }));
    const r = await uploadLayout('h1', '{"x":1}', { hasBlobToken: true, outDir: '/tmp/out', upload });
    expect(upload).toHaveBeenCalledOnce();
    expect(r.diviJsonBlobKey).toBe('layouts/h1.json');
    expect(r.previewImageKeys).toHaveLength(3);
  });

  it('writes JSON locally when no token', async () => {
    const writeFile = vi.fn();
    const r = await uploadLayout('h2', '{"x":1}', { hasBlobToken: false, outDir: '/tmp/out', writeFile });
    expect(writeFile).toHaveBeenCalledWith('/tmp/out/h2.json', '{"x":1}');
    expect(r.diviJsonBlobKey).toBe('/tmp/out/h2.json');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-upload.test.ts`
Expected: FAIL — cannot find `@/pipeline/upload`.

- [ ] **Step 3: Implement**

```ts
// pipeline/upload.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { uploadAsset } from '@/lib/blob';

export interface UploadResult {
  diviJsonBlobKey: string;
  previewImageKeys: string[];
}

// Phase 3a previews are placeholders (same shape as the seed). Phase 3b replaces
// these with real Playwright screenshots uploaded to Blob.
export function previewUrls(hash: string, n = 3): string[] {
  return Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/${hash}-${i}/1200/900`);
}

export async function uploadLayout(
  hash: string,
  json: string,
  deps: {
    hasBlobToken: boolean;
    outDir: string;
    upload?: (key: string, data: Buffer, ct: string) => Promise<{ url: string }>;
    writeFile?: (path: string, data: string) => void;
  },
): Promise<UploadResult> {
  const previewImageKeys = previewUrls(hash);
  if (deps.hasBlobToken) {
    const key = `layouts/${hash}.json`;
    const upload = deps.upload ?? ((k, d, ct) => uploadAsset(k, d, ct));
    await upload(key, Buffer.from(json), 'application/json');
    return { diviJsonBlobKey: key, previewImageKeys };
  }
  const path = `${deps.outDir}/${hash}.json`;
  const write = deps.writeFile ?? ((p, d) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, d); });
  write(path, json);
  return { diviJsonBlobKey: path, previewImageKeys };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/upload.ts tests/pipeline-upload.test.ts
git commit -m "feat: pipeline upload step (Blob or local) + placeholder previews

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Ingest client

**Files:**
- Create: `pipeline/ingest.ts`
- Test: `tests/pipeline-ingest.test.ts`

**Interfaces:**
- Consumes: `IngestPayload` (type from `@/lib/ingest/schema`).
- Produces: `postIngest(payload: IngestPayload, deps: { url: string; token: string; fetchFn?: typeof fetch }): Promise<{ id: string; status: string; deduped: boolean }>` — POSTs to `${url}/api/ingest` with a Bearer token; throws on 401 (auth) and 422 (validation); returns the body on 200/201.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-ingest.test.ts
import { describe, it, expect, vi } from 'vitest';
import { postIngest } from '@/pipeline/ingest';

const payload: any = { slug: 's', title: 't', type: 'hero', colors: [], diviJsonBlobKey: 'k', previewImageKeys: [], contentHash: 'h', validatorPassed: true };

function res(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

describe('postIngest', () => {
  it('sends a Bearer token to <url>/api/ingest and returns the body', async () => {
    const fetchFn = vi.fn(async () => res(201, { id: 'l1', status: 'pending', deduped: false }));
    const out = await postIngest(payload, { url: 'http://localhost:3000', token: 'tok', fetchFn });
    expect(out).toEqual({ id: 'l1', status: 'pending', deduped: false });
    const [u, init] = fetchFn.mock.calls[0];
    expect(u).toBe('http://localhost:3000/api/ingest');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('throws on 401 and 422', async () => {
    await expect(postIngest(payload, { url: 'x', token: 't', fetchFn: vi.fn(async () => res(401, {})) })).rejects.toThrow(/401|auth/i);
    await expect(postIngest(payload, { url: 'x', token: 't', fetchFn: vi.fn(async () => res(422, { error: 'not_validated' })) })).rejects.toThrow(/422|not_validated/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-ingest.test.ts`
Expected: FAIL — cannot find `@/pipeline/ingest`.

- [ ] **Step 3: Implement**

```ts
// pipeline/ingest.ts
import type { IngestPayload } from '@/lib/ingest/schema';

export async function postIngest(
  payload: IngestPayload,
  deps: { url: string; token: string; fetchFn?: typeof fetch },
): Promise<{ id: string; status: string; deduped: boolean }> {
  const doFetch = deps.fetchFn ?? fetch;
  const r = await doFetch(`${deps.url}/api/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${deps.token}` },
    body: JSON.stringify(payload),
  });
  if (r.status === 401) throw new Error('ingest auth failed (401) — check INGEST_API_TOKEN');
  if (r.status === 422) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(`ingest rejected (422): ${body.error ?? 'invalid'}`);
  }
  if (!r.ok) throw new Error(`ingest failed (${r.status})`);
  return (await r.json()) as { id: string; status: string; deduped: boolean };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-ingest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pipeline/ingest.ts tests/pipeline-ingest.test.ts
git commit -m "feat: pipeline ingest client (Bearer POST /api/ingest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Orchestrator (run loop + repair + summary)

**Files:**
- Create: `pipeline/run.ts`
- Test: `tests/pipeline-run.test.ts`

**Interfaces:**
- Consumes: every prior unit, by injection (so the loop is testable with no real LLM/validator/network).
- Produces:
  - `interface RunSummary { generated: number; repaired: number; dropped: number; deduped: number; ingested: number }`
  - `interface RunDeps {`
    `  targets: Target[];`
    `  guide: Guide;`
    `  llm: LlmClient;`
    `  validate: (json: string) => Promise<ValidationResult>;`
    `  isDuplicate: (hash: string) => Promise<boolean>;`
    `  upload: (hash: string, json: string) => Promise<UploadResult>;`
    `  ingest: (payload: IngestPayload) => Promise<{ deduped: boolean }>;`
    `  maxRepairs: number;`
    `  log?: (msg: string) => void;`
    `}`
  - `runPipeline(deps: RunDeps): Promise<RunSummary>` — for each target: generate → validate (≤ `maxRepairs` repair attempts feeding violations back) → on still-invalid drop+count; dedupe-skip; seo; upload; ingest. Returns the summary.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pipeline-run.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from '@/pipeline/run';

const guide = { style: 's', schema: 'sc', examples: [] };
const target = { type: 'hero', niche: 'saas', style: 'minimal' };
const ok = { valid: true, violations: [] };
const bad = { valid: false, violations: [{ code: 'E_X', message: 'm', path: 'p' }] };

function baseDeps(over: Partial<any> = {}) {
  return {
    targets: [target],
    guide,
    llm: { complete: vi.fn(async () => '{"content":[]}') },
    validate: vi.fn(async () => ok),
    isDuplicate: vi.fn(async () => false),
    upload: vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['p'] })),
    ingest: vi.fn(async () => ({ deduped: false })),
    maxRepairs: 2,
    ...over,
  };
}

describe('runPipeline', () => {
  it('happy path: generate → validate → upload → ingest, summary counts 1 ingested', async () => {
    const deps = baseDeps();
    const s = await runPipeline(deps as any);
    expect(s).toMatchObject({ generated: 1, dropped: 0, deduped: 0, ingested: 1 });
    expect(deps.ingest).toHaveBeenCalledOnce();
  });

  it('repairs once when first validation fails then passes', async () => {
    const validate = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(ok);
    const llm = { complete: vi.fn(async () => '{"content":[]}') };
    const s = await runPipeline(baseDeps({ validate, llm }) as any);
    expect(s.repaired).toBe(1);
    expect(s.ingested).toBe(1);
    expect(llm.complete).toHaveBeenCalledTimes(3); // generate + repair + seo
  });

  it('drops a layout that never validates and never ingests it', async () => {
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ validate: vi.fn(async () => bad), ingest }) as any);
    expect(s.dropped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('skips a duplicate before SEO/upload/ingest', async () => {
    const upload = vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: [] }));
    const ingest = vi.fn(async () => ({ deduped: false }));
    const s = await runPipeline(baseDeps({ isDuplicate: vi.fn(async () => true), upload, ingest }) as any);
    expect(s.deduped).toBe(1);
    expect(s.ingested).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/pipeline-run.test.ts`
Expected: FAIL — cannot find `@/pipeline/run`.

- [ ] **Step 3: Implement the orchestrator**

```ts
// pipeline/run.ts
import type { LlmClient } from './llm';
import type { Target, Guide } from './recipes';
import { buildRepairPrompt } from './recipes';
import { extractJson } from './llm';
import { generateLayout } from './generate';
import { generateSeo } from './seo';
import { contentHash } from './dedupe';
import type { ValidationResult } from './validate';
import type { UploadResult } from './upload';
import type { IngestPayload } from '@/lib/ingest/schema';

export interface RunSummary {
  generated: number;
  repaired: number;
  dropped: number;
  deduped: number;
  ingested: number;
}

export interface RunDeps {
  targets: Target[];
  guide: Guide;
  llm: LlmClient;
  validate: (json: string) => Promise<ValidationResult>;
  isDuplicate: (hash: string) => Promise<boolean>;
  upload: (hash: string, json: string) => Promise<UploadResult>;
  ingest: (payload: IngestPayload) => Promise<{ deduped: boolean }>;
  maxRepairs: number;
  maxBudgetUsd?: number;
  log?: (msg: string) => void;
}

export async function runPipeline(deps: RunDeps): Promise<RunSummary> {
  const log = deps.log ?? (() => {});
  const summary: RunSummary = { generated: 0, repaired: 0, dropped: 0, deduped: 0, ingested: 0 };

  for (const target of deps.targets) {
    try {
      let { json } = await generateLayout(target, { llm: deps.llm, guide: deps.guide, maxBudgetUsd: deps.maxBudgetUsd });
      summary.generated++;

      // Validate + repair loop (hard gate).
      let result = await deps.validate(json);
      let attempts = 0;
      while (!result.valid && attempts < deps.maxRepairs) {
        attempts++;
        summary.repaired++;
        const { system, prompt } = buildRepairPrompt(json, result.violations);
        const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
        json = JSON.stringify(extractJson(text));
        result = await deps.validate(json);
      }
      if (!result.valid) {
        summary.dropped++;
        log(`drop ${target.type}/${target.niche}/${target.style}: ${result.violations.map((v) => v.code).join(',')}`);
        continue;
      }

      const hash = contentHash(json);
      if (await deps.isDuplicate(hash)) {
        summary.deduped++;
        log(`dedupe ${hash.slice(0, 12)}`);
        continue;
      }

      const seo = await generateSeo(json, target, { llm: deps.llm, maxBudgetUsd: deps.maxBudgetUsd });
      const { diviJsonBlobKey, previewImageKeys } = await deps.upload(hash, json);

      const payload: IngestPayload = {
        slug: seo.slug,
        title: seo.title,
        description: seo.metaDescription,
        type: seo.axes.type,
        niche: seo.axes.niche,
        style: seo.axes.style,
        colors: seo.axes.colors,
        diviJsonBlobKey,
        previewImageKeys,
        contentHash: hash,
        validatorPassed: true,
        seo: { metaTitle: seo.title, metaDescription: seo.metaDescription, keywords: seo.keywords },
        tags: [
          { axis: 'type', slug: seo.axes.type },
          { axis: 'niche', slug: seo.axes.niche },
          { axis: 'style', slug: seo.axes.style },
        ],
      };
      await deps.ingest(payload);
      summary.ingested++;
      log(`ingested ${seo.slug}`);
    } catch (err) {
      summary.dropped++;
      log(`error on ${target.type}/${target.niche}/${target.style}: ${(err as Error).message}`);
    }
  }
  return summary;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/pipeline-run.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add pipeline/run.ts tests/pipeline-run.test.ts
git commit -m "feat: pipeline orchestrator (validate+repair loop, dedupe, summary)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: CLI entry + integration smoke + acceptance

**Files:**
- Modify: `pipeline/index.ts` (replace the stub with the real CLI), `.env.example` (pipeline section)
- Create: `tests/pipeline-validate-integration.test.ts`
- Test: as above

**Interfaces:**
- Consumes: everything. Wires `process.env` (`VALIDATOR_CMD`, `INGEST_API_TOKEN`, `INGEST_URL`, `BLOB_READ_WRITE_TOKEN`, optional `PIPELINE_MAX_BUDGET_USD`) to `runPipeline`.
- Produces: `npm run pipeline -- drip --count=N` and `npm run pipeline -- batch` and `npm run pipeline -- drip --count=1 --dry-run`.

- [ ] **Step 1: Write the gated validator integration test (real PHP + fixtures)**

```ts
// tests/pipeline-validate-integration.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateLayout } from '@/pipeline/validate';

const VALIDATOR_DIR = join(process.cwd(), '..', 'Divi 5 Deterministic Validator');
const hasValidator = existsSync(join(VALIDATOR_DIR, 'scripts', 'validate.php'));
const cmd = `php "${join(VALIDATOR_DIR, 'scripts', 'validate.php')}"`;

describe.skipIf(!hasValidator)('validateLayout against the real validator', () => {
  it('PASSes a known-good fixture', async () => {
    const dir = join(VALIDATOR_DIR, 'fixtures', 'valid');
    const { readdirSync } = await import('node:fs');
    const file = join(dir, readdirSync(dir).find((f) => f.endsWith('.json'))!);
    const r = await validateLayout(file, { validatorCmd: cmd });
    expect(r.valid).toBe(true);
  });

  it('FAILs a known-bad fixture with violation codes', async () => {
    const dir = join(VALIDATOR_DIR, 'fixtures', 'invalid');
    const { readdirSync } = await import('node:fs');
    const file = join(dir, readdirSync(dir).find((f) => f.endsWith('.json'))!);
    const r = await validateLayout(file, { validatorCmd: cmd });
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations[0].code).toMatch(/^[A-Z0-9_]+$/);
  });
});
```

- [ ] **Step 2: Run the integration test (passes locally with PHP + validator present; skips otherwise)**

Run: `npm run test -- tests/pipeline-validate-integration.test.ts`
Expected: PASS where the validator repo + `php` exist; PASS-as-skipped otherwise.

- [ ] **Step 3: Replace the CLI entry**

```ts
// pipeline/index.ts
// Divi5Lab generation pipeline — CLI entry (Phase 3a, no render).
//   npm run pipeline -- drip --count=N [--dry-run]
//   npm run pipeline -- batch [--dry-run]
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { layouts } from '@/db/schema';
import { claudeCliClient } from './llm';
import { MATRIX, planTargets, loadGrounding } from './recipes';
import { validateLayout } from './validate';
import { uploadLayout } from './upload';
import { postIngest } from './ingest';
import { runPipeline, type RunDeps } from './run';

async function withTempFile<T>(json: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'layout-'));
  const file = join(dir, 'layout.json');
  await writeFile(file, json);
  try {
    return await fn(file);
  } finally {
    await unlink(file).catch(() => {});
  }
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function coveredKeys(): Promise<Set<string>> {
  const rows = await db.select({ type: layouts.type, niche: layouts.niche, style: layouts.style }).from(layouts);
  return new Set(rows.map((r) => `${r.type}|${r.niche ?? ''}|${r.style ?? ''}`));
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'batch' && mode !== 'drip') {
    console.log('Usage: npm run pipeline -- <batch|drip [--count=N]> [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const dryRun = hasFlag('dry-run');
  const count = mode === 'drip' ? Number(arg('count') ?? '1') : undefined;

  const validatorDir = process.env.VALIDATOR_DIR ?? '../Divi 5 Deterministic Validator';
  const guide = loadGrounding(validatorDir);
  const covered = dryRun ? new Set<string>() : await coveredKeys();
  const targets = planTargets(MATRIX, covered, count);

  const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:3000';
  const ingestToken = process.env.INGEST_API_TOKEN ?? '';
  const maxBudget = process.env.PIPELINE_MAX_BUDGET_USD ? Number(process.env.PIPELINE_MAX_BUDGET_USD) : 1;

  const stubLlm = { complete: async () => '{"content":[]}' };
  const deps: RunDeps = {
    targets,
    guide,
    llm: dryRun ? stubLlm : claudeCliClient(),
    validate: dryRun ? async () => ({ valid: true, violations: [] }) : (json) => withTempFile(json, (f) => validateLayout(f)),
    isDuplicate: async (hash) => {
      if (dryRun) return false;
      const hit = await db.select({ id: layouts.id }).from(layouts).where(eq(layouts.contentHash, hash)).limit(1);
      return hit.length > 0;
    },
    upload: (hash, json) => uploadLayout(hash, json, { hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN, outDir: 'pipeline/out' }),
    ingest: dryRun ? async () => ({ deduped: false }) : (payload) => postIngest(payload, { url: ingestUrl, token: ingestToken }),
    maxRepairs: 2,
    maxBudgetUsd: maxBudget,
    log: (m) => console.log(`[pipeline] ${m}`),
  };

  console.log(`[pipeline] ${mode}${count ? ` count=${count}` : ''}${dryRun ? ' (dry-run)' : ''} — ${targets.length} target(s)`);
  const summary = await runPipeline(deps);
  console.log('[pipeline] summary:', summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

In `.env.example`, ensure the pipeline section documents (add any missing):

```
# Pipeline (local/CI only — NOT in the web app's Vercel runtime)
VALIDATOR_DIR=../Divi 5 Deterministic Validator
INGEST_URL=http://localhost:3000
PIPELINE_MAX_BUDGET_USD=1
```

- [ ] **Step 4: Typecheck + lint + full unit suite**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS — pipeline unit suites green; validator-integration + any DB/CLI-gated tests skip when their dependency is absent; all Phase 1/2 suites still green.

- [ ] **Step 5: Dry-run smoke (no spend, no DB writes)**

Run: `npm run pipeline -- drip --count=2 --dry-run`
Expected: prints a summary with `ingested: 0` and no errors (stub LLM, no ingest) — proves the wiring end-to-end.

- [ ] **Step 6: Manual real-generation acceptance (opt-in — uses your Claude subscription + local DB)**

With the local DB + dev server running and `.env.local` set (`VALIDATOR_DIR`, `INGEST_API_TOKEN`, `INGEST_URL=http://localhost:3000`):

```bash
# generate ONE real layout end-to-end
npm run pipeline -- drip --count=1
# → generates via claude CLI, validates via PHP, ingests one pending layout
```
Then sign in as admin and confirm the new layout appears in `/admin/queue`; approve it → it shows on `/browse`. (This is the manual acceptance; it is not run in CI.)

- [ ] **Step 7: Commit + tag**

```bash
git add pipeline/index.ts .env.example tests/pipeline-validate-integration.test.ts
git commit -m "feat: pipeline CLI entry (drip/batch/dry-run) + validator integration test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git tag phase-3a-complete
```

---

## Notes / external prerequisites (user-provided)

- **Local PHP + the sibling validator repo** (`../Divi 5 Deterministic Validator`,
  `composer install` already done) are needed for real validation and the
  integration test. `VALIDATOR_DIR`/`VALIDATOR_CMD` point at them.
- **The `claude` CLI** (already installed, authenticated via the Claude Code
  subscription) is the default generation backend — no `ANTHROPIC_API_KEY`.
- **A running web app + local DB** (Phase-2 ingest) are needed for a real run;
  the dry-run and unit tests need neither.
- No new third-party services or runtime dependencies are introduced in Phase 3a.

# Compose Landing From Sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `full_landing` layouts by generating each section with its own small LLM call under a shared brief, then deterministically assembling them — removing the single-response output-size ceiling that makes one-shot landings fail.

**Architecture:** New `pipeline/compose/` module. `composeLanding(target, deps)` generates a structured brief once, generates each section of the landing-guide flow with the brief injected (reusing `generateLayout`), assembles the section documents under one Divi placeholder wrapper, and returns `{ json }` shaped exactly like `generateLayout`. `run.ts` routes `full_landing` targets to it; everything downstream is unchanged.

**Tech Stack:** TypeScript, Vitest. Reuses `pipeline/llm` (`LlmClient`, `LlmError`, `extractJson`), `pipeline/recipes` (`buildGenerationPrompt`, `loadGrounding`, `Target`, `Guide`), `pipeline/generate` (`generateLayout`).

## Global Constraints

- **Never invent Divi schema.** Section generation reuses `buildGenerationPrompt`, which grounds on the validator's real section recipes. (CLAUDE.md §2.3)
- **Validation is the hard gate.** The assembled document is validated by the existing validator path in `run.ts`; assembly is validity-preserving (empirically verified — three concatenated recipes pass with zero violations).
- **Idempotent + resumable.** No new dedupe logic — the assembled JSON flows through the existing `contentHash` dedupe.
- **No randomness in scripts.** Flow selection and assembly are deterministic (no `Date`/`Math.random`).
- **Parser reuse.** All model output is parsed with the existing robust `extractJson`; never raw-string-match generated JSON.
- Return shape of `composeLanding` MUST be `{ json: string }` (stringified `{ post_title, post_content }`) to be a drop-in for `generateLayout` in `run.ts`.

## File Structure

- `pipeline/compose/brief.ts` — `Brief` type, `buildBriefPrompt(target)`, `parseBrief(text)`.
- `pipeline/compose/flow.ts` — `Step` type, `FLOWS` map, `flowForBusinessType(bt)`.
- `pipeline/compose/section-prompt.ts` — `buildSectionRolePrompt(step, brief)` → composition string injected into a synthesized section `Target`.
- `pipeline/compose/assemble.ts` — `assembleSections(postContents)` → one combined `post_content`.
- `pipeline/compose/index.ts` — `composeLanding(target, deps)` orchestration; re-exports the pieces.
- Modify `pipeline/run.ts` — route `full_landing` → `composeLanding`.
- Modify `pipeline/index.ts` — pass `maxParseRetries`/`log` through (already wired for retries; confirm `log` reaches compose).
- Tests: `tests/compose-brief.test.ts`, `tests/compose-flow.test.ts`, `tests/compose-section-prompt.test.ts`, `tests/compose-assemble.test.ts`, `tests/compose-landing.test.ts`, extend `tests/pipeline-run.test.ts`.

---

### Task 1: Brief — type, prompt builder, parser

**Files:**
- Create: `pipeline/compose/brief.ts`
- Test: `tests/compose-brief.test.ts`

**Interfaces:**
- Consumes: `Target` from `@/pipeline/recipes`; `extractJson`, `LlmError` from `@/pipeline/llm`.
- Produces:
  - `interface Brief { businessType: string; businessName: string; tagline: string; audience: string; conversionGoal: string; primaryCta: string; accentColorHex: string; voice: string }`
  - `buildBriefPrompt(target: Target): { system: string; prompt: string }`
  - `parseBrief(text: string): Brief`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/compose-brief.test.ts
import { describe, it, expect } from 'vitest';
import { buildBriefPrompt, parseBrief } from '@/pipeline/compose/brief';

describe('buildBriefPrompt', () => {
  it('grounds on the target niche/style and asks for the structured brief fields', () => {
    const { system, prompt } = buildBriefPrompt({ type: 'full_landing', niche: 'coaching', style: 'elegant' });
    expect(system.toLowerCase()).toContain('json');
    expect(prompt).toContain('coaching');
    expect(prompt).toContain('elegant');
    for (const f of ['businessType', 'businessName', 'primaryCta', 'accentColorHex', 'conversionGoal', 'voice']) {
      expect(prompt).toContain(f);
    }
  });
});

describe('parseBrief', () => {
  const full = {
    businessType: 'course/coaching', businessName: 'Meridian Coaching', tagline: 'Lead with clarity',
    audience: 'new managers', conversionGoal: 'book a call', primaryCta: 'Book a Call',
    accentColorHex: '#E4572E', voice: 'warm, direct',
  };
  it('parses a valid brief (tolerating a prose preamble via extractJson)', () => {
    expect(parseBrief(`Here is the brief:\n${JSON.stringify(full)}`)).toEqual(full);
  });
  it('throws when a required field is missing', () => {
    const { primaryCta, ...missing } = full;
    expect(() => parseBrief(JSON.stringify(missing))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose-brief.test.ts`
Expected: FAIL — cannot find module `@/pipeline/compose/brief`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// pipeline/compose/brief.ts
import type { Target } from '@/pipeline/recipes';
import { extractJson, LlmError } from '@/pipeline/llm';

export interface Brief {
  businessType: string;
  businessName: string;
  tagline: string;
  audience: string;
  conversionGoal: string;
  primaryCta: string;
  accentColorHex: string;
  voice: string;
}

const FIELDS: (keyof Brief)[] = [
  'businessType', 'businessName', 'tagline', 'audience',
  'conversionGoal', 'primaryCta', 'accentColorHex', 'voice',
];

const SYSTEM =
  'You are a senior conversion copywriter and brand strategist. ' +
  'Respond with ONLY a single JSON object, no prose.';

export function buildBriefPrompt(target: Target): { system: string; prompt: string } {
  const prompt = [
    `Create a landing-page brief for a ${target.style} ${target.niche} business.`,
    'Decide the business type, audience, and the ONE conversion goal, then a concrete',
    'brand identity to carry across the whole page. Return a JSON object with EXACTLY',
    'these fields (all strings):',
    '- businessType: one of SaaS, service/agency, local business, product/e-commerce, course/coaching, event, portfolio, non-profit',
    '- businessName: a concrete, on-brand name (not a placeholder)',
    '- tagline: one short benefit-led line',
    '- audience: who the page speaks to',
    '- conversionGoal: the single primary action',
    '- primaryCta: the exact button label, reused across the page (e.g. "Book a Call")',
    '- accentColorHex: one accent color as a hex string (e.g. "#E4572E")',
    '- voice: a short tone/style note',
    'Output ONLY the JSON object.',
  ].join('\n');
  return { system: SYSTEM, prompt };
}

export function parseBrief(text: string): Brief {
  const obj = extractJson(text) as Record<string, unknown>;
  for (const f of FIELDS) {
    if (typeof obj?.[f] !== 'string' || (obj[f] as string).trim() === '') {
      throw new LlmError(`brief missing required field: ${f}`);
    }
  }
  return Object.fromEntries(FIELDS.map((f) => [f, obj[f]])) as unknown as Brief;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/compose-brief.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compose/brief.ts tests/compose-brief.test.ts
git commit -m "feat(compose): landing brief prompt + parser"
```

---

### Task 2: Flow — per-business-type section spine

**Files:**
- Create: `pipeline/compose/flow.ts`
- Test: `tests/compose-flow.test.ts`

**Interfaces:**
- Produces:
  - `interface Step { role: string; sectionType: string; job: string; cta: boolean }` — `sectionType` is a value in `RECIPE_BY_TYPE` (hero, features, cards, testimonials, pricing, faq, cta, gallery, contact); `cta: true` marks sections that carry the primary CTA; `role` ids `hero` and `final_cta` are the required sections.
  - `flowForBusinessType(businessType: string): Step[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/compose-flow.test.ts
import { describe, it, expect } from 'vitest';
import { flowForBusinessType } from '@/pipeline/compose/flow';
import { RECIPE_BY_TYPE_KEYS } from '@/pipeline/compose/flow';

describe('flowForBusinessType', () => {
  it('course/coaching returns the transformation spine ending in a final CTA', () => {
    const steps = flowForBusinessType('course/coaching');
    expect(steps[0].role).toBe('hero');
    expect(steps.at(-1)!.role).toBe('final_cta');
    expect(steps.some((s) => s.role === 'social_proof')).toBe(true);
  });
  it('every step uses a known section type and marks the hero + final CTA as cta sections', () => {
    for (const bt of ['SaaS', 'service/agency', 'local business', 'product/e-commerce', 'course/coaching']) {
      const steps = flowForBusinessType(bt);
      expect(steps.length).toBeGreaterThanOrEqual(6);
      for (const s of steps) expect(RECIPE_BY_TYPE_KEYS).toContain(s.sectionType);
      expect(steps.find((s) => s.role === 'hero')!.cta).toBe(true);
      expect(steps.find((s) => s.role === 'final_cta')!.cta).toBe(true);
    }
  });
  it('falls back to a default spine for an unknown business type', () => {
    const steps = flowForBusinessType('something-weird');
    expect(steps[0].role).toBe('hero');
    expect(steps.at(-1)!.role).toBe('final_cta');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose-flow.test.ts`
Expected: FAIL — cannot find module `@/pipeline/compose/flow`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// pipeline/compose/flow.ts
export interface Step {
  role: string;
  sectionType: string;
  job: string;
  cta: boolean;
}

// Section types that pipeline/recipes/prompts.ts can ground (RECIPE_BY_TYPE keys).
export const RECIPE_BY_TYPE_KEYS = [
  'hero', 'cta', 'features', 'cards', 'pricing', 'testimonials', 'faq', 'gallery', 'contact',
] as const;

const S = (role: string, sectionType: string, job: string, cta = false): Step => ({ role, sectionType, job, cta });

// Persuasion spines from the landing guide, mapped to groundable section types.
const HERO = S('hero', 'hero', 'Say what is offered, who it is for, why it matters, and the ONE primary action, with a relevant visual.', true);
const PROBLEM = S('problem', 'features', 'Name 3 sharp pains the visitor feels today (before-state). No pitch yet.');
const SOLUTION = S('solution', 'features', 'Frame the better way: old-way-vs-new-way, sell the mechanism in plain language.');
const BENEFITS = S('benefits', 'cards', 'Outcome-led benefit cards (icon + title + one line). Write outcomes, not features.', true);
const PROOF = S('social_proof', 'testimonials', 'Reduce risk with 2-3 testimonials (bracketed placeholders, never fabricated as real).', true);
const HOWITWORKS = S('how_it_works', 'cards', '3-4 numbered steps that make the process feel easy.');
const FEATURES = S('features', 'features', 'Feature detail: what it does, why it matters, what changes for the customer.');
const FAQ = S('faq', 'faq', 'Answer the real objections: is it hard, how long, who is it for, cost/guarantee.');
const PRICING = S('pricing', 'pricing', '2-3 plans in columns with the middle plan highlighted and feature checklists.');
const FINAL = S('final_cta', 'cta', 'Restate the promise and the ONE action. Minimal distractions.', true);

const FLOWS: Record<string, Step[]> = {
  saas: [HERO, PROBLEM, SOLUTION, BENEFITS, PROOF, HOWITWORKS, PRICING, FAQ, FINAL],
  'service/agency': [HERO, PROBLEM, BENEFITS, HOWITWORKS, PROOF, FAQ, FINAL],
  'local business': [HERO, BENEFITS, FEATURES, PROOF, FAQ, FINAL],
  'product/e-commerce': [HERO, PROBLEM, BENEFITS, FEATURES, PROOF, PRICING, FAQ, FINAL],
  'course/coaching': [HERO, PROBLEM, SOLUTION, BENEFITS, PROOF, HOWITWORKS, PRICING, FAQ, FINAL],
};
const DEFAULT_FLOW = FLOWS['service/agency'];

function normalize(bt: string): string {
  const s = bt.toLowerCase();
  if (s.includes('saas')) return 'saas';
  if (s.includes('agency') || s.includes('service')) return 'service/agency';
  if (s.includes('local') || s.includes('restaurant') || s.includes('gym') || s.includes('clinic')) return 'local business';
  if (s.includes('commerce') || s.includes('product') || s.includes('shop')) return 'product/e-commerce';
  if (s.includes('course') || s.includes('coaching')) return 'course/coaching';
  return '';
}

export function flowForBusinessType(businessType: string): Step[] {
  return FLOWS[normalize(businessType)] ?? DEFAULT_FLOW;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/compose-flow.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compose/flow.ts tests/compose-flow.test.ts
git commit -m "feat(compose): per-business-type section flow"
```

---

### Task 3: Section-role prompt — inject the brief

**Files:**
- Create: `pipeline/compose/section-prompt.ts`
- Test: `tests/compose-section-prompt.test.ts`

**Interfaces:**
- Consumes: `Brief` from `./brief`, `Step` from `./flow`.
- Produces: `buildSectionRolePrompt(step: Step, brief: Brief): string` — the composition text to place in a synthesized section `Target`'s `layout` field.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/compose-section-prompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildSectionRolePrompt } from '@/pipeline/compose/section-prompt';

const brief = {
  businessType: 'course/coaching', businessName: 'Meridian Coaching', tagline: 'Lead with clarity',
  audience: 'new managers', conversionGoal: 'book a call', primaryCta: 'Book a Call',
  accentColorHex: '#E4572E', voice: 'warm, direct',
};

describe('buildSectionRolePrompt', () => {
  it('injects the shared brief so every section is cohesive', () => {
    const p = buildSectionRolePrompt({ role: 'hero', sectionType: 'hero', job: 'Say what is offered.', cta: true }, brief);
    expect(p).toContain('Meridian Coaching');
    expect(p).toContain('#E4572E');
    expect(p).toContain('Book a Call');
    expect(p).toContain('Say what is offered.');
  });
  it('only tells cta:true sections to place the primary CTA button', () => {
    const withCta = buildSectionRolePrompt({ role: 'hero', sectionType: 'hero', job: 'j', cta: true }, brief);
    const noCta = buildSectionRolePrompt({ role: 'problem', sectionType: 'features', job: 'j', cta: false }, brief);
    expect(withCta).toMatch(/primary CTA/i);
    expect(noCta).not.toMatch(/primary CTA button/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose-section-prompt.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
// pipeline/compose/section-prompt.ts
import type { Brief } from './brief';
import type { Step } from './flow';

// Composition text placed into a synthesized section Target's `layout`, so
// buildGenerationPrompt grounds the section on its recipe while every section
// shares the same brand (name, accent, CTA, voice) — the cohesion mechanism.
export function buildSectionRolePrompt(step: Step, brief: Brief): string {
  const lines = [
    `This section is part of ONE cohesive landing page for "${brief.businessName}" (${brief.businessType}).`,
    `Audience: ${brief.audience}. Voice: ${brief.voice}.`,
    `Use the accent color ${brief.accentColorHex} for the primary button, icons, and highlights — the SAME accent across the whole page.`,
    `Section role: ${step.job}`,
    'Write specific, benefit-led copy in second person; no lorem ipsum; bracket any placeholder facts like "[Replace: client name]".',
  ];
  if (step.cta) {
    lines.push(`Include the primary CTA button labelled exactly "${brief.primaryCta}" (the one action for the whole page).`);
  } else {
    lines.push('Do not add a competing call-to-action button in this section.');
  }
  return lines.join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/compose-section-prompt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compose/section-prompt.ts tests/compose-section-prompt.test.ts
git commit -m "feat(compose): section-role prompt injecting the shared brief"
```

---

### Task 4: Assembler — sections → one document

**Files:**
- Create: `pipeline/compose/assemble.ts`
- Test: `tests/compose-assemble.test.ts`

**Interfaces:**
- Produces: `assembleSections(postContents: string[]): string` — strips each section's placeholder wrapper, concatenates the inner section blocks in order, wraps once in a single placeholder wrapper.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/compose-assemble.test.ts
import { describe, it, expect } from 'vitest';
import { assembleSections } from '@/pipeline/compose/assemble';

const PH_OPEN = '<!-- wp:divi/placeholder -->';
const PH_CLOSE = '<!-- /wp:divi/placeholder -->';
const sec = (n: number) => `<!-- wp:divi/section {"a":{"b":${n}}} -->S${n}<!-- /wp:divi/section -->`;

describe('assembleSections', () => {
  it('wraps N sections in exactly one placeholder wrapper, in order', () => {
    const inputs = [PH_OPEN + sec(1) + PH_CLOSE, PH_OPEN + sec(2) + PH_CLOSE, PH_OPEN + sec(3) + PH_CLOSE];
    const out = assembleSections(inputs);
    expect(out.match(/wp:divi\/placeholder -->/g)!.length).toBe(2); // one open + one close
    expect(out.startsWith(PH_OPEN)).toBe(true);
    expect(out.endsWith(PH_CLOSE)).toBe(true);
    expect(out.indexOf('S1')).toBeLessThan(out.indexOf('S2'));
    expect(out.indexOf('S2')).toBeLessThan(out.indexOf('S3'));
    expect((out.match(/wp:divi\/section {/g) || []).length).toBe(3);
  });
  it('handles sections that arrive without a placeholder wrapper', () => {
    const out = assembleSections([sec(1), PH_OPEN + sec(2) + PH_CLOSE]);
    expect(out).toBe(PH_OPEN + sec(1) + sec(2) + PH_CLOSE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose-assemble.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
// pipeline/compose/assemble.ts
const PH_OPEN = '<!-- wp:divi/placeholder -->';
const PH_CLOSE = '<!-- /wp:divi/placeholder -->';

// A valid Divi page post_content is exactly one placeholder wrapper around N
// section blocks. Each generated section arrives wrapped in its own placeholder;
// strip those and re-wrap the concatenation once. (Validity-preserving — verified
// against the deterministic validator.)
export function assembleSections(postContents: string[]): string {
  const inner = postContents
    .map((pc) => pc.split(PH_OPEN).join('').split(PH_CLOSE).join('').trim())
    .filter((pc) => pc.length > 0)
    .join('');
  return PH_OPEN + inner + PH_CLOSE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/compose-assemble.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/compose/assemble.ts tests/compose-assemble.test.ts
git commit -m "feat(compose): deterministic section assembler"
```

---

### Task 5: composeLanding — orchestration

**Files:**
- Create: `pipeline/compose/index.ts`
- Test: `tests/compose-landing.test.ts`

**Interfaces:**
- Consumes: `buildBriefPrompt`, `parseBrief`, `Brief` (`./brief`); `flowForBusinessType`, `Step` (`./flow`); `buildSectionRolePrompt` (`./section-prompt`); `assembleSections` (`./assemble`); `generateLayout` (`@/pipeline/generate`); `Target`, `Guide` (`@/pipeline/recipes`); `LlmClient`, `LlmError` (`@/pipeline/llm`).
- Produces:
  - `interface ComposeDeps { llm: LlmClient; guide: Guide; maxBudgetUsd?: number; maxParseRetries?: number; flow?: Step[]; log?: (m: string) => void }`
  - `composeLanding(target: Target, deps: ComposeDeps): Promise<{ json: string }>`
  - Re-exports: `Brief`, `Step`, `buildBriefPrompt`, `parseBrief`, `flowForBusinessType`, `buildSectionRolePrompt`, `assembleSections`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/compose-landing.test.ts
import { describe, it, expect, vi } from 'vitest';
import { composeLanding } from '@/pipeline/compose';

const guide = { style: 's', schema: 'sc', examples: ['{"e":1}'] };
const target = { type: 'full_landing', niche: 'coaching', style: 'elegant' };
const brief = {
  businessType: 'course/coaching', businessName: 'Meridian Coaching', tagline: 'Lead with clarity',
  audience: 'new managers', conversionGoal: 'book a call', primaryCta: 'Book a Call',
  accentColorHex: '#E4572E', voice: 'warm, direct',
};
const section = (n: number) =>
  JSON.stringify({ post_title: `S${n}`, post_content: `<!-- wp:divi/placeholder --><!-- wp:divi/section {"i":${n}} -->x<!-- /wp:divi/section --><!-- /wp:divi/placeholder -->` });
const twoStep = [
  { role: 'hero', sectionType: 'hero', job: 'hero job', cta: true },
  { role: 'final_cta', sectionType: 'cta', job: 'cta job', cta: true },
];

// Stub LLM: first call → brief; each later call → a distinct section doc.
function stubLlm() {
  let n = 0;
  return { complete: vi.fn(async () => (n === 0 ? (n++, JSON.stringify(brief)) : section(n++))) };
}

describe('composeLanding', () => {
  it('generates the brief then each section and assembles one document', async () => {
    const llm = stubLlm();
    const { json } = await composeLanding(target as any, { llm, guide, flow: twoStep });
    const doc = JSON.parse(json);
    expect(doc.post_title).toContain('Meridian Coaching');
    expect((doc.post_content.match(/wp:divi\/placeholder -->/g) || []).length).toBe(2); // one wrapper
    expect((doc.post_content.match(/wp:divi\/section {/g) || []).length).toBe(2); // both sections
    expect(llm.complete).toHaveBeenCalledTimes(3); // 1 brief + 2 sections
  });

  it('drops (throws) when a required section fails to generate', async () => {
    let n = 0;
    const llm = {
      complete: vi.fn(async () => {
        if (n++ === 0) return JSON.stringify(brief);
        return 'no json here'; // every section fails to parse
      }),
    };
    await expect(composeLanding(target as any, { llm, guide, flow: twoStep, maxParseRetries: 0 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/compose-landing.test.ts`
Expected: FAIL — cannot find module `@/pipeline/compose`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// pipeline/compose/index.ts
import type { Target, Guide } from '@/pipeline/recipes';
import type { LlmClient } from '@/pipeline/llm';
import { LlmError } from '@/pipeline/llm';
import { generateLayout } from '@/pipeline/generate';
import { buildBriefPrompt, parseBrief, type Brief } from './brief';
import { flowForBusinessType, type Step } from './flow';
import { buildSectionRolePrompt } from './section-prompt';
import { assembleSections } from './assemble';

export type { Brief } from './brief';
export type { Step } from './flow';
export { buildBriefPrompt, parseBrief } from './brief';
export { flowForBusinessType } from './flow';
export { buildSectionRolePrompt } from './section-prompt';
export { assembleSections } from './assemble';

export interface ComposeDeps {
  llm: LlmClient;
  guide: Guide;
  maxBudgetUsd?: number;
  maxParseRetries?: number;
  flow?: Step[];
  log?: (msg: string) => void;
}

const REQUIRED_ROLES = new Set(['hero', 'final_cta']);

export async function composeLanding(target: Target, deps: ComposeDeps): Promise<{ json: string }> {
  const log = deps.log ?? (() => {});

  // 1. Brief (one call) — the cohesion source.
  const briefPrompt = buildBriefPrompt(target);
  const briefText = await deps.llm.complete({ prompt: briefPrompt.prompt, system: briefPrompt.system, maxBudgetUsd: deps.maxBudgetUsd });
  const brief: Brief = parseBrief(briefText);

  // 2. Sections (one small call each) via the existing generation path.
  const flow = deps.flow ?? flowForBusinessType(brief.businessType);
  const sections: string[] = [];
  for (const step of flow) {
    const sectionTarget: Target = {
      type: step.sectionType,
      niche: target.niche,
      style: target.style,
      color: target.color,
      layout: buildSectionRolePrompt(step, brief),
    };
    try {
      const { json } = await generateLayout(sectionTarget, {
        llm: deps.llm,
        guide: deps.guide,
        maxBudgetUsd: deps.maxBudgetUsd,
        maxParseRetries: deps.maxParseRetries,
      });
      const pc = (JSON.parse(json) as { post_content?: string }).post_content;
      if (typeof pc === 'string' && pc.trim()) sections.push(pc);
      else if (REQUIRED_ROLES.has(step.role)) throw new LlmError(`required section ${step.role} produced no post_content`);
    } catch (e) {
      if (REQUIRED_ROLES.has(step.role)) throw e;
      log(`skip optional section ${step.role}: ${(e as Error).message}`);
    }
  }
  if (sections.length === 0) throw new LlmError('no sections generated for landing');

  // 3. Assemble into one document.
  const post_content = assembleSections(sections);
  const post_title = `${brief.businessName} — ${target.style} ${target.niche} landing page`;
  return { json: JSON.stringify({ post_title, post_content }) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/compose-landing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors. (`sectionTarget.type` is `string`; `Target.type` is `string` — OK.)

- [ ] **Step 6: Commit**

```bash
git add pipeline/compose/index.ts tests/compose-landing.test.ts
git commit -m "feat(compose): composeLanding orchestration (brief -> sections -> assemble)"
```

---

### Task 6: Route full_landing through composeLanding

**Files:**
- Modify: `pipeline/run.ts` (import + the generate call around line 54)
- Modify: `tests/pipeline-run.test.ts` (add a full_landing routing case)

**Interfaces:**
- Consumes: `composeLanding` from `@/pipeline/compose`; existing `RunDeps` (already carries `llm`, `guide`, `maxBudgetUsd`, `maxParseRetries`, `log`).

- [ ] **Step 1: Write the failing test**

Add to `tests/pipeline-run.test.ts`:

```typescript
it('routes a full_landing target through composeLanding (assembles many sections, not one-shot)', async () => {
  const brief = { businessType: 'course/coaching', businessName: 'Acme Coaching', tagline: 't', audience: 'a', conversionGoal: 'book a call', primaryCta: 'Book a Call', accentColorHex: '#E4572E', voice: 'warm' };
  const section = (n: number) => JSON.stringify({ post_title: `S${n}`, post_content: `<!-- wp:divi/placeholder --><!-- wp:divi/section {"i":${n}} -->x<!-- /wp:divi/section --><!-- /wp:divi/placeholder -->` });
  let n = 0;
  // brief, then a section per generateLayout call, then SEO — sniff by prompt content.
  const llm = { complete: vi.fn(async ({ prompt }: { prompt: string }) => {
    if (prompt.includes('landing-page brief')) return JSON.stringify(brief);
    if (prompt.startsWith('Generate a Divi 5')) return section(n++);
    return JSON.stringify({ title: 'T', slug: 's', metaDescription: 'd', keywords: [], axes: { type: 'full_landing', niche: 'coaching', style: 'elegant', colors: [] } });
  }) };
  // Capture the JSON handed to upload — that's the assembled document.
  const upload = vi.fn(async () => ({ diviJsonBlobKey: 'k', previewImageKeys: ['p'] }));
  const s = await runPipeline(baseDeps({
    targets: [{ type: 'full_landing', niche: 'coaching', style: 'elegant' }],
    llm, upload,
  }) as any);
  expect(s.ingested).toBe(1);
  const uploadedJson = (upload.mock.calls[0] as any)[1] as string;
  const post = JSON.parse(uploadedJson).post_content as string;
  // Composed → the full course/coaching flow (>=6 steps) assembled under ONE wrapper.
  // A one-shot path would upload a single-section document (this assertion would fail).
  expect((post.match(/wp:divi\/placeholder -->/g) || []).length).toBe(2);
  expect((post.match(/wp:divi\/section {/g) || []).length).toBeGreaterThanOrEqual(6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline-run.test.ts`
Expected: FAIL — before wiring, the full_landing target still goes through `generateLayout`, which uploads a **single-section** document (the stub's one section per "Generate a Divi 5" call). The new assertion `section blocks >= 6` fails because assembly never happened.

- [ ] **Step 3: Ensure the brief prompt contains the sniff marker**

In `pipeline/compose/brief.ts`, confirm `buildBriefPrompt`'s prompt first line reads `Create a landing-page brief ...` (it does — contains `landing-page brief`). No change needed if already present; otherwise adjust the wording to include `landing-page brief`.

- [ ] **Step 4: Wire the route in `pipeline/run.ts`**

Add the import near the other pipeline imports:

```typescript
import { composeLanding } from '@/pipeline/compose';
```

Replace the single generate call (around line 54):

```typescript
      let { json } =
        target.type === 'full_landing'
          ? await composeLanding(target, {
              llm: deps.llm,
              guide: deps.guide,
              maxBudgetUsd: deps.maxBudgetUsd,
              maxParseRetries: deps.maxParseRetries,
              log,
            })
          : await generateLayout(target, {
              llm: deps.llm,
              guide: deps.guide,
              maxBudgetUsd: deps.maxBudgetUsd,
              maxParseRetries: deps.maxParseRetries,
            });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/pipeline-run.test.ts`
Expected: PASS (all cases, including the new full_landing route).

- [ ] **Step 6: Full suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add pipeline/run.ts tests/pipeline-run.test.ts
git commit -m "feat(pipeline): route full_landing through composeLanding"
```

---

### Task 7: End-to-end verification against the real validator

**Files:** none (verification only).

- [ ] **Step 1: Dry-run smoke (no LLM/DB) confirms wiring**

Run: `npm run pipeline -- batch --dry-run 2>&1 | tail -5`
Expected: prints target count and a summary without throwing (dry-run stubs the LLM, so landings won't truly assemble, but the routing/import must not error).

- [ ] **Step 2: Real single landing on Opus 4.8**

Run (env sourced, validator + WP up):
```bash
set -a && . ./.env.local && set +a
export VALIDATOR_CMD='php "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/scripts/validate.php"'
export PIPELINE_MODEL=claude-opus-4-8
npm run pipeline -- batch 2>&1 | grep -E "ingested|error on|summary:"
```
Expected: the remaining `full_landing` targets ingest (auto-approve publishes them); the validator passes the assembled documents. If a landing drops, read the logged reason.

- [ ] **Step 3: Confirm in DB**

Run: `docker exec layoutlab-db psql -U layoutlab -d layoutlab -tc "SELECT niche, style FROM layouts WHERE type='full_landing' AND status='published' ORDER BY published_at DESC LIMIT 8;"`
Expected: the newly composed landings present.

---

## Self-Review

**Spec coverage:**
- Brief (shared cohesion) → Task 1. ✓
- Fresh per-section generation → Task 5 (uses `generateLayout` per step). ✓
- Landing-guide flow → Task 2. ✓
- Assembly under one wrapper → Task 4. ✓
- Validation hard gate → unchanged `run.ts` path; Task 6 routes into it; Task 7 verifies. ✓
- Error handling (brief fail → drop; required section fail → drop; optional → skip) → Task 5. ✓
- Integration in `run.ts` → Task 6. ✓
- Testing (brief, section-prompt, flow, assembler, orchestration, routing) → Tasks 1-6. ✓
- Cost note / Opus 4.8 → Task 7 run command. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `Brief`, `Step`, `ComposeDeps`, `composeLanding` signatures match across Tasks 1-6; `assembleSections(postContents: string[]): string` and `buildSectionRolePrompt(step, brief): string` are used consistently; `composeLanding` returns `{ json: string }` matching `generateLayout`.

**Note on dead code:** the one-shot `full_landing` branch in `pipeline/recipes/prompts.ts` `directives()` becomes unused once Task 6 lands (full_landing no longer calls `buildGenerationPrompt`). It remains covered by `tests/landing-prompt.test.ts` and is harmless; removing it is out of scope for this plan.

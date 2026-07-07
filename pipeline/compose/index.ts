import type { Target, Guide } from '@/pipeline/recipes';
import { buildRepairPrompt } from '@/pipeline/recipes';
import type { LlmClient } from '@/pipeline/llm';
import { LlmError, extractJson } from '@/pipeline/llm';
import type { ValidationResult } from '@/pipeline/validate';
import { generateLayout } from '@/pipeline/generate';
import { buildContentRepairPrompt } from '@/pipeline/recipes';
import { lintLayoutJson, IMAGE_RULE_CODES } from '@/pipeline/content-lint';
import { buildBriefPrompt, parseBrief, type Brief } from './brief';
import { flowForBusinessType, type Step } from './flow';
import { buildSectionRolePrompt } from './section-prompt';
import { assembleSections } from './assemble';

export type { Brief, Palette } from './brief';
export type { Step } from './flow';
export { buildBriefPrompt, parseBrief, defaultPalette } from './brief';
export { flowForBusinessType } from './flow';
export { buildSectionRolePrompt } from './section-prompt';
export { assembleSections } from './assemble';

export interface ComposeDeps {
  llm: LlmClient;
  guide: Guide;
  maxBudgetUsd?: number;
  maxParseRetries?: number;
  /** Validate a single section; when provided, each section is validated (and
   * repaired up to maxRepairs) BEFORE assembly. This is what keeps validity a
   * per-section, small-and-reliable concern — the assembled landing is valid by
   * construction, so the whole-document repair (which would blow the model's
   * output ceiling) never runs. */
  validate?: (json: string) => Promise<ValidationResult>;
  maxRepairs?: number;
  flow?: Step[];
  /** Pin the brand instead of generating one — the cohesion source for a
   * multi-page theme (every page shares name, accent, CTA, voice). */
  brief?: Brief;
  /** Canonical brand facts (email, phone, address, hours, …) appended to every
   * section prompt so contact details stay identical across sections/pages. */
  brandFacts?: string;
  log?: (msg: string) => void;
}

const REQUIRED_ROLES = new Set(['hero', 'final_cta']);

// Generate one section, then (if a validator is wired) validate it and repair at
// the SECTION level — a small document, so repair is reliable. Throws if the
// section can't be made valid; the caller drops the landing (required) or skips
// the section (optional).
async function generateValidSection(sectionTarget: Target, deps: ComposeDeps): Promise<string> {
  let { json } = await generateLayout(sectionTarget, {
    llm: deps.llm,
    guide: deps.guide,
    maxBudgetUsd: deps.maxBudgetUsd,
    maxParseRetries: deps.maxParseRetries,
  });
  const maxRepairs = deps.maxRepairs ?? 0;
  if (deps.validate) {
    let result = await deps.validate(json);
    let attempts = 0;
    while (!result.valid && attempts < maxRepairs) {
      attempts++;
      const { system, prompt } = buildRepairPrompt(json, result.violations, sectionTarget, deps.guide);
      const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
      json = JSON.stringify(extractJson(text));
      result = await deps.validate(json);
    }
    if (!result.valid) throw new LlmError(`section failed validation: ${result.violations.map((v) => v.code).join(',')}`);
  }

  // Per-section content gate: keep placeholder tokens / lorem ipsum / demo filler out
  // of the assembled landing. Images are resolved later at the document level, so skip
  // the image rules here. If a copy repair can't clear it, ship the last version anyway
  // (structure is valid) rather than fail the whole landing over a copy nit.
  let lint = lintLayoutJson(json, { skip: IMAGE_RULE_CODES });
  let lintAttempts = 0;
  while (lint.length && lintAttempts < maxRepairs) {
    lintAttempts++;
    const { system, prompt } = buildContentRepairPrompt(json, lint, sectionTarget, deps.guide);
    const text = await deps.llm.complete({ prompt, system, maxBudgetUsd: deps.maxBudgetUsd });
    const repaired = JSON.stringify(extractJson(text));
    // A copy rewrite must not break structure; if it does, keep the prior valid JSON.
    if (deps.validate && !(await deps.validate(repaired)).valid) break;
    json = repaired;
    lint = lintLayoutJson(json, { skip: IMAGE_RULE_CODES });
  }
  return json;
}

export async function composeLanding(target: Target, deps: ComposeDeps): Promise<{ json: string }> {
  const log = deps.log ?? (() => {});

  // 1. Brief (one call) — the cohesion source. A pinned brief (deps.brief) skips
  // generation so a multi-page theme shares one identity.
  let brief: Brief;
  if (deps.brief) {
    brief = deps.brief;
  } else {
    const briefPrompt = buildBriefPrompt(target);
    const briefText = await deps.llm.complete({ prompt: briefPrompt.prompt, system: briefPrompt.system, maxBudgetUsd: deps.maxBudgetUsd });
    brief = parseBrief(briefText);
  }

  // 2. Sections (one small call each) via the existing generation path.
  const flow = deps.flow ?? flowForBusinessType(brief.businessType);
  const brandFacts = deps.brandFacts ? ` ${deps.brandFacts}` : '';
  const sections: string[] = [];
  for (const [index, step] of flow.entries()) {
    const sectionTarget: Target = {
      type: step.sectionType,
      niche: target.niche,
      style: target.style,
      color: target.color,
      layout: buildSectionRolePrompt(step, brief, { index, total: flow.length }) + brandFacts,
    };
    try {
      const json = await generateValidSection(sectionTarget, deps);
      const pc = (JSON.parse(json) as { post_content?: string }).post_content;
      if (typeof pc === 'string' && pc.trim()) sections.push(pc);
      else if (REQUIRED_ROLES.has(step.role)) throw new LlmError(`required section ${step.role} produced no post_content`);
      else log(`skip optional section ${step.role}: produced no post_content`);
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

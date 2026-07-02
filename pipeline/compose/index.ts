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

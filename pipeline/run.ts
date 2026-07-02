// pipeline/run.ts
import type { LlmClient } from './llm';
import type { Target, Guide } from './recipes';
import { buildRepairPrompt } from './recipes';
import { extractJson } from './llm';
import { generateLayout } from './generate';
import { composeLanding } from '@/pipeline/compose';
import { generateSeo } from './seo';
import { contentHash } from './dedupe';
import { stackLayoutJsonMobile } from './stack-mobile';
import type { ValidationResult } from './validate';
import type { UploadResult } from './upload';
import type { IngestPayload } from '@/lib/ingest/schema';

/** Card slugs must be unique across the 18-variant matrix, but the AI-written base
 * slug collides between near-identical variants (all "feature cards"). Append the
 * variant for cards so every combo gets a distinct, descriptive, collision-free slug. */
export function variantSlug(baseSlug: string, target: Target): string {
  const v = target.variant;
  if (!v || target.type !== 'cards') return baseSlug;
  return `${baseSlug}-${v.columns}col-${v.icons}-${v.iconStyle}`;
}

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
  /** Swap keyword placeholder image URLs for real stock photos (e.g. Pexels). */
  resolveImages?: (json: string) => Promise<string>;
  isDuplicate: (hash: string) => Promise<boolean>;
  upload: (hash: string, json: string) => Promise<UploadResult>;
  /** Render the section to real screenshots; returns preview keys + a perceptual hash. */
  render?: (input: { title: string; postContent: string; hash: string }) => Promise<{ previewImageKeys: string[]; perceptualHash?: string }>;
  ingest: (payload: IngestPayload) => Promise<{ deduped: boolean }>;
  maxRepairs: number;
  maxParseRetries?: number;
  maxBudgetUsd?: number;
  log?: (msg: string) => void;
}

export async function runPipeline(deps: RunDeps): Promise<RunSummary> {
  const log = deps.log ?? (() => {});
  const summary: RunSummary = { generated: 0, repaired: 0, dropped: 0, deduped: 0, ingested: 0 };

  for (const target of deps.targets) {
    try {
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

      // Swap placeholder images for real stock photos (after validation; URL-for-URL,
      // so structure is unchanged). Hash + render + download all see the real images.
      if (deps.resolveImages) json = await deps.resolveImages(json);

      // Enforce single-column, full-width stacking on phone (deterministic; the
      // model is inconsistent about responsive column sizing). Adds phone-only
      // attributes — desktop layout and validation verdict are unaffected.
      json = stackLayoutJsonMobile(json);

      const hash = contentHash(json);
      if (await deps.isDuplicate(hash)) {
        summary.deduped++;
        log(`dedupe ${hash.slice(0, 12)}`);
        continue;
      }

      const seo = await generateSeo(json, target, { llm: deps.llm, maxBudgetUsd: deps.maxBudgetUsd });
      const { diviJsonBlobKey, previewImageKeys: placeholderPreviews } = await deps.upload(hash, json);

      // Render real screenshots when a renderer is wired; else keep the placeholders.
      let previewImageKeys = placeholderPreviews;
      let perceptualHash: string | undefined;
      if (deps.render) {
        const parsed = JSON.parse(json) as { post_title?: string; post_content?: string };
        if (parsed.post_content) {
          const r = await deps.render({ title: parsed.post_title ?? seo.title, postContent: parsed.post_content, hash });
          if (r.previewImageKeys.length) previewImageKeys = r.previewImageKeys;
          perceptualHash = r.perceptualHash;
        }
      }

      const payload: IngestPayload = {
        slug: variantSlug(seo.slug, target),
        title: seo.title,
        description: seo.metaDescription,
        type: seo.axes.type,
        niche: seo.axes.niche,
        style: seo.axes.style,
        // Record the driven variation color first, then any colors the SEO step inferred.
        colors: target.color ? [target.color, ...seo.axes.colors.filter((c) => c !== target.color)] : seo.axes.colors,
        diviJsonBlobKey,
        previewImageKeys,
        contentHash: hash,
        perceptualHash,
        variant: target.variant,
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

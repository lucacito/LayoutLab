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
  /** Render the section to real screenshots; returns preview keys + a perceptual hash. */
  render?: (input: { title: string; postContent: string; hash: string }) => Promise<{ previewImageKeys: string[]; perceptualHash?: string }>;
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
        perceptualHash,
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
